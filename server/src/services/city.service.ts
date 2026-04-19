import prisma from "../config/db";
import { Prisma } from "@prisma/client";
import { getResourceProduction, getWarehouseCapacity, UNITS } from "../../../shared/gameConfig";
import env from "../config/env";
import { pickFreeSlot } from "./map.service";

type TransactionClient = Prisma.TransactionClient;

// Calculeaza resursele generate de la lastResourceUpdate pana acum si actualizeaza DB-ul.
// Apeleaza inainte de orice operatie care citeste sau scade resurse.
export const syncResources = async (cityId: string): Promise<void> => {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { buildings: true },
  });
  if (!city) throw new Error("CITY_NOT_FOUND");

  const now = new Date();
  const elapsedHours = (now.getTime() - city.lastResourceUpdate.getTime()) / 3_600_000;

  if (elapsedHours < 1 / 3600) return; // sub 1 secunda, nu merita

  const bank        = city.buildings.find(b => b.name === "BANK");
  const powerPlant  = city.buildings.find(b => b.name === "POWER_PLANT");
  const weapFactory = city.buildings.find(b => b.name === "WEAPONS_FACTORY");
  const warehouse   = city.buildings.find(b => b.name === "WAREHOUSE");

  // Ghost cities (no owner) lack buildings — nothing to sync.
  if (!bank || !powerPlant || !weapFactory || !warehouse) {
    await prisma.city.update({ where: { id: cityId }, data: { lastResourceUpdate: now } });
    return;
  }

  const cap = getWarehouseCapacity(warehouse.level);

  await prisma.city.update({
    where: { id: cityId },
    data: {
      money:              Math.min(cap, city.money  + getResourceProduction(bank.level, env.gameSpeed)        * elapsedHours),
      energy:             Math.min(cap, city.energy + getResourceProduction(powerPlant.level, env.gameSpeed)  * elapsedHours),
      ammo:               Math.min(cap, city.ammo   + getResourceProduction(weapFactory.level, env.gameSpeed) * elapsedHours),
      lastResourceUpdate: now,
    },
  });
};

export const getCityOverview = async (userId: string, cityId?: string) => {
  const city = await prisma.city.findFirst({
    where: cityId ? { id: cityId, ownerId: userId } : { ownerId: userId },
    orderBy: { createdAt: "asc" },
    include: {
      buildings:             { orderBy: { name: "asc" } },
      units:                 { orderBy: { name: "asc" } },
      buildingUpgradeOrders: { orderBy: { finishAt: "asc" } },
      recruitmentOrders:     { orderBy: { finishAt: "asc" } },
    },
  });
  if (!city) throw new Error("CITY_NOT_FOUND");

  await syncResources(city.id);

  // Refetch resources actualizate dupa sync
  const updated = await prisma.city.findUnique({
    where: { id: city.id },
    select: { money: true, energy: true, ammo: true },
  });

  // Unitatile de sprijin stationate in orasul nostru — contribuie la afisaj/aparare,
  // dar nu sunt ale noastre (nu pot fi trimise in comenzi proprii).
  const stationedSupports = await prisma.command.findMany({
    where:  { toCityId: city.id, type: "SUPPORT", status: "ARRIVED" },
    select: { units: { select: { name: true, quantity: true } } },
  });
  const supportMap = new Map<string, number>();
  for (const c of stationedSupports) {
    for (const u of c.units) {
      supportMap.set(u.name, (supportMap.get(u.name) ?? 0) + u.quantity);
    }
  }
  const supportUnits = Array.from(supportMap.entries()).map(([name, quantity]) => ({ name, quantity }));

  // Population = toate unitatile proprii inca in viata, oriunde s-ar afla:
  // acasa + in drum/stationate in comenzi pornite din acest oras.
  const ownCommands = await prisma.command.findMany({
    where:  { fromCityId: city.id, status: { in: ["TRAVELING", "RETURNING", "ARRIVED"] } },
    select: { units: { select: { name: true, quantity: true } } },
  });
  let totalPopulation = 0;
  for (const u of city.units) {
    totalPopulation += u.quantity * (UNITS[u.name]?.population ?? 1);
  }
  for (const c of ownCommands) {
    for (const u of c.units) {
      totalPopulation += u.quantity * (UNITS[u.name]?.population ?? 1);
    }
  }
  for (const o of city.recruitmentOrders) {
    totalPopulation += o.quantity * (UNITS[o.unitName]?.population ?? 1);
  }

  const ownedCities = await prisma.city.findMany({
    where:   { ownerId: userId },
    select:  { id: true, name: true, x: true, y: true },
    orderBy: { createdAt: "asc" },
  });

  return { ...city, ...updated, supportUnits, totalPopulation, ownedCities };
};

export const renameMyCity = async (userId: string, name: string, cityId?: string) => {
  const city = await prisma.city.findFirst({
    where:   cityId ? { id: cityId, ownerId: userId } : { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select:  { id: true },
  });
  if (!city) throw new Error("CITY_NOT_FOUND");
  return prisma.city.update({
    where: { id: city.id },
    data: { name },
    select: { id: true, name: true },
  });
};

export const createStarterCity = async (
  userId: string,
  cityName: string,
  tx: TransactionClient = prisma
) => {
  const { x, y } = await pickFreeSlot(tx);
  return tx.city.create({
    data: {
      name: cityName,
      x,
      y,
      ownerId: userId,
      buildings: {
        create: [
          { name: "HEADQUARTERS",    level: 1 },
          { name: "BANK",            level: 1 },
          { name: "POWER_PLANT",     level: 1 },
          { name: "WEAPONS_FACTORY", level: 1 },
          { name: "HOUSING",         level: 1 },
          { name: "WAREHOUSE",       level: 1 },
          { name: "MILITARY_BASE",   level: 0 },
          { name: "HARBOR",          level: 0 },
          { name: "AIR_DEFENSE",     level: 0 },
        ],
      },
      units: {
        create: [
          { name: "LIGHT_INFANTRY",     category: "INFANTRY", quantity: 10 },
          { name: "HEAVY_INFANTRY",     category: "INFANTRY", quantity: 10 },
        ],
      },
    },
  });
};
