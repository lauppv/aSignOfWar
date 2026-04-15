import prisma from "../config/db";
import { commandQueue } from "../config/queue";
import {
  UNITS,
  getHarborCapacity,
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
  getResourceTravelTimeSec,
} from "../../../shared/gameConfig";
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
  if (type === "SPY"    && fromCity.ownerId === toCity.ownerId) throw new Error("CANNOT_SPY_OWN_CITY");

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

  // SPY: acceptam doar hackeri
  if (type === "SPY") {
    const nonHacker = units.find(u => u.name !== "HACKER");
    if (nonHacker) throw new Error("SPY_REQUIRES_HACKERS_ONLY");
    const totalHackers = units.reduce((s, u) => s + u.quantity, 0);
    if (totalHackers < 1) throw new Error("NO_UNITS");
  }
  // ATTACK/SUPPORT: hackerii nu pot fi trimisi (nu participa la bataliile normale)
  if (type === "ATTACK" || type === "SUPPORT") {
    if (units.some(u => u.name === "HACKER")) throw new Error("HACKERS_CANNOT_JOIN_BATTLE");
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

  const distance = getFieldDistance(fromCity.x, fromCity.y, toCity.x, toCity.y);
  let travelSec: number;
  if (type === "RESOURCES") {
    travelSec = getResourceTravelTimeSec(distance, env.gameSpeed);
  } else {
    const slowest = getSlowestUnitSpeed(unitCounts);
    if (slowest <= 0) throw new Error("NO_UNITS");
    travelSec = getUnitTravelTimeSec(distance, slowest, env.gameSpeed);
  }

  const now       = new Date();
  const arrivalAt = new Date(now.getTime() + travelSec * 1000);
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

// Retrage unitati stationate ca SUPPORT intr-un oras. Doua variante:
//   - mode "all"  → toate comenzile stationate pleaca inapoi (flip ARRIVED → RETURNING).
//   - mode partial cu unitCounts → creeaza o comanda noua RETURNING cu unitatile cerute,
//     scazand din comenzile stationate existente (oldest first).
export const withdrawStationedSupport = async (
  fromCityId: string,
  targetCityId: string,
  userId: string,
  unitCounts: Partial<Record<UnitName, number>> | "all"
) => {
  const fromCity = await prisma.city.findUnique({
    where: { id: fromCityId },
    select: { id: true, ownerId: true, x: true, y: true },
  });
  if (!fromCity)                     throw new Error("CITY_NOT_FOUND");
  if (fromCity.ownerId !== userId)   throw new Error("UNAUTHORIZED");

  const targetCity = await prisma.city.findUnique({
    where:  { id: targetCityId },
    select: { id: true, x: true, y: true },
  });
  if (!targetCity) throw new Error("TARGET_CITY_NOT_FOUND");

  const stationed = await prisma.command.findMany({
    where:  { fromCityId, toCityId: targetCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
    orderBy: { arrivalAt: "asc" },
  });
  if (stationed.length === 0) throw new Error("NO_STATIONED_UNITS");

  const distance = getFieldDistance(fromCity.x, fromCity.y, targetCity.x, targetCity.y);
  const travelMsFor = (units: { name: UnitName; quantity: number }[]): number => {
    const counts: Partial<Record<UnitName, number>> = {};
    for (const u of units) counts[u.name] = (counts[u.name] ?? 0) + u.quantity;
    const slowest = getSlowestUnitSpeed(counts);
    return getUnitTravelTimeSec(distance, slowest, env.gameSpeed) * 1000;
  };

  if (unitCounts === "all") {
    const ids: string[] = [];
    const delays = new Map<string, number>();
    const withdrawnAt = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      for (const c of stationed) {
        const ms = travelMsFor(c.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity })));
        const arrival = new Date(Date.now() + ms);
        await tx.command.update({
          where: { id: c.id },
          data:  {
            status:    "RETURNING",
            arrivalAt: arrival,
            report:    { withdrawal: true, withdrawnAt } as any,
          },
        });
        ids.push(c.id);
        delays.set(c.id, ms);
      }
    });
    for (const id of ids) {
      await commandQueue.add("return", { commandId: id }, { delay: delays.get(id)! });
    }
    return { withdrawnCommandIds: ids };
  }

  // Partial: aduna cat sa scoti per unit type
  const remaining = new Map<UnitName, number>();
  for (const [name, qty] of Object.entries(unitCounts) as [UnitName, number | undefined][]) {
    if (qty && qty > 0) remaining.set(name, qty);
  }
  if (remaining.size === 0) throw new Error("NO_UNITS");

  const withdrawn = new Map<UnitName, number>();
  let newCommandId!: string;
  let partialDelayMs = 0;
  let partialArrivalAt: Date = new Date();

  await prisma.$transaction(async (tx) => {
    for (const cmd of stationed) {
      for (const cu of cmd.units) {
        const need = remaining.get(cu.name as UnitName) ?? 0;
        if (need <= 0 || cu.quantity <= 0) continue;
        const take = Math.min(need, cu.quantity);
        await tx.commandUnit.update({
          where: { id: cu.id },
          data:  { quantity: cu.quantity - take },
        });
        remaining.set(cu.name as UnitName, need - take);
        withdrawn.set(cu.name as UnitName, (withdrawn.get(cu.name as UnitName) ?? 0) + take);
      }
      // Daca toate unitatile comenzii stationate au devenit 0, marcheaza COMPLETED
      // si o ascundem din rapoarte — valoarea de notificare e pe noua comanda
      // RETURNING creata mai jos, care poarta flag-ul de withdrawal.
      const refreshed = await tx.commandUnit.findMany({ where: { commandId: cmd.id } });
      if (refreshed.every(u => u.quantity === 0)) {
        await tx.command.update({
          where: { id: cmd.id },
          data:  {
            status:                 "COMPLETED",
            reportHiddenByAttacker: true,
            reportHiddenByDefender: true,
          },
        });
      }
    }

    for (const [, left] of remaining) {
      if (left > 0) throw new Error("INSUFFICIENT_STATIONED_UNITS");
    }

    if (withdrawn.size === 0) throw new Error("NO_UNITS_WITHDRAWN");

    const withdrawnUnits = Array.from(withdrawn.entries()).map(([name, quantity]) => ({ name, quantity }));
    partialDelayMs       = travelMsFor(withdrawnUnits);
    partialArrivalAt     = new Date(Date.now() + partialDelayMs);

    const created = await tx.command.create({
      data: {
        type:       "SUPPORT",
        status:     "RETURNING",
        fromCityId,
        toCityId:   targetCityId,
        arrivalAt:  partialArrivalAt,
        report:     { withdrawal: true, withdrawnAt: new Date().toISOString() } as any,
        units: {
          create: withdrawnUnits,
        },
      },
    });
    newCommandId = created.id;
  });

  await commandQueue.add("return", { commandId: newCommandId }, { delay: partialDelayMs });
  return { withdrawnCommandIds: [newCommandId], arrivalAt: partialArrivalAt };
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

  // Aparatorul NU trebuie sa stie cu ce trupe e atacat/spionat — stergem units
  // din comenzile ATTACK/SPY incoming. SUPPORT/RESOURCES raman vizibile.
  const sanitizedIncoming = incoming.map(c =>
    c.type === "ATTACK" || c.type === "SPY" ? { ...c, units: [] } : c
  );

  return { outgoing, incoming: sanitizedIncoming };
};
