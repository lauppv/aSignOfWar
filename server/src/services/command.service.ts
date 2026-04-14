import prisma from "../config/db";
import { commandQueue } from "../config/queue";
import { UNITS, getTravelTimeSec, getHarborCapacity } from "../../../shared/gameConfig";
import env from "../config/env";
import { CommandType, UnitName } from "@prisma/client";
import { syncResources } from "./city.service";

export const sendCommand = async (
  fromCityId: string,
  toCityId: string,
  type: CommandType,
  userId: string,
  unitCounts: Partial<Record<UnitName, number>>,
  resources: { money: number; energy: number; ammo: number }
) => {
  if (fromCityId === toCityId) throw new Error("SAME_CITY");

  const [fromCity, toCity] = await Promise.all([
    prisma.city.findUnique({ where: { id: fromCityId }, include: { units: true, buildings: true } }),
    prisma.city.findUnique({ where: { id: toCityId } }),
  ]);

  if (!fromCity)             throw new Error("CITY_NOT_FOUND");
  if (!toCity)               throw new Error("TARGET_CITY_NOT_FOUND");
  if (fromCity.ownerId !== userId) throw new Error("UNAUTHORIZED");
  if (type === "ATTACK" && fromCity.ownerId === toCity.ownerId) throw new Error("CANNOT_ATTACK_OWN_CITY");

  const units = Object.entries(unitCounts)
    .filter(([, qty]) => qty && qty > 0)
    .map(([name, qty]) => ({ name: name as UnitName, quantity: qty! }));

  // Validare unitati
  if (type !== "RESOURCES") {
    if (units.length === 0) throw new Error("NO_UNITS");
    for (const { name, quantity } of units) {
      const cityUnit = fromCity.units.find(u => u.name === name);
      if (!cityUnit || cityUnit.quantity < quantity) {
        throw new Error(`INSUFFICIENT_UNITS:${name}`);
      }
    }
  }

  // Validare resurse (RESOURCES)
  if (type === "RESOURCES") {
    const harbor = fromCity.buildings.find(b => b.name === "HARBOR");
    if (!harbor || harbor.level < 1) throw new Error("HARBOR_REQUIRED");
    const total = resources.money + resources.energy + resources.ammo;
    if (total <= 0) throw new Error("NO_RESOURCES");
    if (total > getHarborCapacity(harbor.level)) throw new Error("EXCEEDS_HARBOR_CAPACITY");
    if (resources.money < 0 || resources.energy < 0 || resources.ammo < 0) throw new Error("NEGATIVE_RESOURCES");
  }

  await syncResources(fromCityId);

  const now       = new Date();
  const arrivalAt = new Date(now.getTime() + getTravelTimeSec(env.gameSpeed) * 1000);
  let commandId!: string;

  await prisma.$transaction(async (tx) => {
    // Scade unitatile din oras
    for (const { name, quantity } of units) {
      const updated = await tx.unit.updateMany({
        where: { cityId: fromCityId, name, quantity: { gte: quantity } },
        data:  { quantity: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error(`INSUFFICIENT_UNITS:${name}`);
    }

    // Scade resursele din oras (RESOURCES)
    if (type === "RESOURCES") {
      const updated = await tx.city.updateMany({
        where: {
          id:     fromCityId,
          money:  { gte: resources.money },
          energy: { gte: resources.energy },
          ammo:   { gte: resources.ammo },
        },
        data: {
          money:  { decrement: resources.money },
          energy: { decrement: resources.energy },
          ammo:   { decrement: resources.ammo },
        },
      });
      if (updated.count === 0) throw new Error("INSUFFICIENT_RESOURCES");
    }

    const command = await tx.command.create({
      data: {
        type,
        status:      "TRAVELING",
        fromCityId,
        toCityId,
        arrivalAt,
        resourceMoney:  type === "RESOURCES" ? resources.money  : 0,
        resourceEnergy: type === "RESOURCES" ? resources.energy : 0,
        resourceAmmo:   type === "RESOURCES" ? resources.ammo   : 0,
        units: { create: units.map(u => ({ name: u.name, quantity: u.quantity })) },
      },
    });
    commandId = command.id;
  });

  const delay = arrivalAt.getTime() - Date.now();
  await commandQueue.add("arrive", { commandId }, { delay });

  return { commandId, arrivalAt };
};

// Anuleaza o comanda TRAVELING: unitatile/resursele se intorc simetric acasa
// (daca au mers x secunde, se mai intorc exact x secunde pana acasa).
export const cancelCommand = async (commandId: string, userId: string) => {
  const command = await prisma.command.findUnique({
    where:   { id: commandId },
    include: { fromCity: { select: { ownerId: true } } },
  });
  if (!command)                             throw new Error("COMMAND_NOT_FOUND");
  if (command.fromCity.ownerId !== userId)  throw new Error("UNAUTHORIZED");
  if (command.status !== "TRAVELING")       throw new Error("NOT_CANCELLABLE");

  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - command.departureAt.getTime());
  if (elapsedMs > 5 * 60 * 1000)            throw new Error("CANCEL_WINDOW_EXPIRED");
  const newArrivalAt = new Date(now.getTime() + elapsedMs);

  await prisma.command.update({
    where: { id: commandId },
    data:  { status: "RETURNING", arrivalAt: newArrivalAt },
  });

  await commandQueue.add("return", { commandId }, { delay: elapsedMs });

  return { commandId, arrivalAt: newArrivalAt };
};

export const getCommandsForCity = async (cityId: string, userId: string) => {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city)                   throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId) throw new Error("UNAUTHORIZED");

  // Outgoing: aratam TRAVELING (pleaca) si RETURNING (se intorc acasa).
  // Incoming: aratam doar TRAVELING — un atac ajuns la noi care s-a intors RETURNING
  // nu mai e treaba defenderului, e doar un trip de intoarcere al atacatorului.
  const [outgoing, incoming] = await Promise.all([
    prisma.command.findMany({
      where:   { fromCityId: cityId, status: { in: ["TRAVELING", "RETURNING", "ARRIVED"] } },
      include: { units: true, toCity: { select: { id: true, name: true, x: true, y: true, owner: { select: { username: true } } } } },
      orderBy: { arrivalAt: "asc" },
    }),
    prisma.command.findMany({
      where:   { toCityId: cityId, status: "TRAVELING" },
      include: { units: true, fromCity: { select: { name: true, x: true, y: true, owner: { select: { username: true } } } } },
      orderBy: { arrivalAt: "asc" },
    }),
  ]);

  return { outgoing, incoming };
};
