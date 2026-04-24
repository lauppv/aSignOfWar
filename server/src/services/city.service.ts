import prisma from "../config/db";
import { Prisma } from "@prisma/client";
import { getResourceProduction, getWarehouseCapacity, UNITS } from "../../../shared/gameConfig";
import env from "../config/env";
import { pickFreeSlot } from "./map.service";

type TransactionClient = Prisma.TransactionClient;

// Calculeaza resursele generate de la lastResourceUpdate pana acum si flush in DB.
// Trebuie apelat inainte de orice operatie care citeste sau scade resurse — altfel
// un jucator ar putea cheltui resurse care nu au fost inca produse ("time travel exploit").
// As fi putut folosi un cron care sync-eaza toate orasele periodic, dar on-demand sync
// e mai simplu si evita acumularea fantasma pe conturile inactive. YAGNI.

// Varianta inline: cand getCityOverview deja are city-ul incarcat cu buildings,
// nu mai face inca un findUnique — calculeaza si face un singur update.
export const syncResourcesFromCity = async (
  city: { id: string; money: number; energy: number; ammo: number; loyalty: number; lastResourceUpdate: Date; buildings: { name: string; level: number }[] }
): Promise<{ money: number; energy: number; ammo: number } | null> => {
  const now = new Date();
  const elapsedHours = (now.getTime() - city.lastResourceUpdate.getTime()) / 3_600_000;
  if (elapsedHours < 1 / 3600) return null;

  const bank        = city.buildings.find(b => b.name === "BANK");
  const powerPlant  = city.buildings.find(b => b.name === "POWER_PLANT");
  const weapFactory = city.buildings.find(b => b.name === "WEAPONS_FACTORY");
  const warehouse   = city.buildings.find(b => b.name === "WAREHOUSE");

  if (!bank || !powerPlant || !weapFactory || !warehouse) {
    await prisma.city.update({ where: { id: city.id }, data: { lastResourceUpdate: now } });
    return null;
  }

  const cap = getWarehouseCapacity(warehouse.level);
  const money  = Math.min(cap, city.money  + getResourceProduction(bank.level, env.gameSpeed)        * elapsedHours);
  const energy = Math.min(cap, city.energy + getResourceProduction(powerPlant.level, env.gameSpeed)  * elapsedHours);
  const ammo   = Math.min(cap, city.ammo   + getResourceProduction(weapFactory.level, env.gameSpeed) * elapsedHours);
  const loyalty = Math.min(100, city.loyalty + 1 * env.gameSpeed * elapsedHours);

  await prisma.city.update({
    where: { id: city.id },
    data: { money, energy, ammo, loyalty, lastResourceUpdate: now },
  });

  return { money, energy, ammo };
};

// Versiunea originala — apelata din building.service, command.worker unde nu avem city-ul preloaded.
// Face un singur findUnique apoi delega la syncResourcesFromCity.
export const syncResources = async (cityId: string): Promise<void> => {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { buildings: true },
  });
  if (!city) throw new Error("CITY_NOT_FOUND");
  await syncResourcesFromCity(city);
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

  // Inainte: syncResources facea findUnique (city-ul pe care il avem deja), update,
  // apoi getCityOverview facea INCA un findUnique ca sa ia resursele actualizate = 3 queries.
  // Acum: syncResourcesFromCity primeste city-ul deja incarcat si returneaza valorile noi = 1 query.
  const updated = await syncResourcesFromCity(city);

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

  // Populatie totala = unitati acasa + unitati in tranzit/stationate. Previne un jucator
  // sa recruteze max pop, sa trimita unitati, si sa recruteze din nou.
  // Serverul calculeaza asta live — nu ne bazam pe ce trimite clientul.
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
  // pickFreeSlot nu mai primeste tx — merge prin SlotAllocator (in-memory, mutex)
  const { x, y } = await pickFreeSlot();
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
