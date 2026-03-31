import prisma from "../config/db";
import { Prisma } from "@prisma/client";
import { getResourceProduction, getWarehouseCapacity } from "../config/game.config";

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

  const bank        = city.buildings.find(b => b.name === "BANK")!;
  const powerPlant  = city.buildings.find(b => b.name === "POWER_PLANT")!;
  const weapFactory = city.buildings.find(b => b.name === "WEAPONS_FACTORY")!;
  const warehouse   = city.buildings.find(b => b.name === "WAREHOUSE")!;

  const cap = getWarehouseCapacity(warehouse.level);

  await prisma.city.update({
    where: { id: cityId },
    data: {
      money:              Math.min(cap, city.money  + getResourceProduction(bank.level)        * elapsedHours),
      energy:             Math.min(cap, city.energy + getResourceProduction(powerPlant.level)  * elapsedHours),
      ammo:               Math.min(cap, city.ammo   + getResourceProduction(weapFactory.level) * elapsedHours),
      lastResourceUpdate: now,
    },
  });
};

export const getCityOverview = async (userId: string) => {
  const city = await prisma.city.findFirst({
    where: { ownerId: userId },
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

  return { ...city, ...updated };
};

export const createStarterCity = async (
  userId: string,
  cityName: string,
  tx: TransactionClient = prisma
) => {
  return tx.city.create({
    data: {
      name: cityName,
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
          { name: "ANTI_TANK_INFANTRY", category: "INFANTRY", quantity: 10 },
        ],
      },
    },
  });
};
