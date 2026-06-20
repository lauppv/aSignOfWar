import prisma from "../../core/db";
import { Prisma } from "@prisma/client";
import { getResourceProduction, getWarehouseCapacity, UNITS } from "../../../../shared/gameConfig";
import env from "../../core/env";
import { pickFreeSlot } from "../map/map.service";
import {
  updateCityResources,
  findCityForSync,
  findCityOverview,
  findStationedSupports,
  findOutgoingCommands,
  findOwnedCities,
  findCityIdForOwner,
  updateCityName,
} from "./city.repository";

type TransactionClient = Prisma.TransactionClient;

type CityWithBuildings = { id: string; money: number; energy: number; ammo: number; lastResourceUpdate: Date; buildings: { name: string; level: number }[] };

// Pure function — computes resources without writing to the DB.
// Used on READ (getCityOverview) so we don't do a WRITE on every refresh.
// Resources are a function of time: resources = old + production * elapsed_time.
export const computeResources = (city: CityWithBuildings): { money: number; energy: number; ammo: number } | null => {
  const now = new Date();
  const elapsedHours = (now.getTime() - city.lastResourceUpdate.getTime()) / 3_600_000;
  if (elapsedHours < 1 / 3600) return null;

  const bank        = city.buildings.find(b => b.name === "BANK");
  const powerPlant  = city.buildings.find(b => b.name === "POWER_PLANT");
  const weapFactory = city.buildings.find(b => b.name === "WEAPONS_FACTORY");
  const warehouse   = city.buildings.find(b => b.name === "WAREHOUSE");

  if (!bank || !powerPlant || !weapFactory || !warehouse) return null;

  const cap = getWarehouseCapacity(warehouse.level);
  return {
    money:   Math.min(cap, city.money  + getResourceProduction(bank.level, env.gameSpeed)        * elapsedHours),
    energy:  Math.min(cap, city.energy + getResourceProduction(powerPlant.level, env.gameSpeed)  * elapsedHours),
    ammo:    Math.min(cap, city.ammo   + getResourceProduction(weapFactory.level, env.gameSpeed) * elapsedHours),
  };
};

// Writes the resources to the DB — called ONLY before operations that spend resources
// (upgrade, recruitment, attack). On READ we don't write — we compute and return.
export const syncResourcesFromCity = async (city: CityWithBuildings): Promise<{ money: number; energy: number; ammo: number } | null> => {
  const computed = computeResources(city);
  if (!computed) return null;

  await updateCityResources(city.id, computed);

  return computed;
};

// The original version — called from building.service, command.worker where we don't have the city preloaded.
// Does a single findUnique then delegates to syncResourcesFromCity.
export const syncResources = async (cityId: string): Promise<void> => {
  const city = await findCityForSync(cityId);
  if (!city) throw new Error("CITY_NOT_FOUND");
  await syncResourcesFromCity(city);
};

export const getCityOverview = async (userId: string, cityId?: string) => {
  const city = await findCityOverview(cityId ? { id: cityId, ownerId: userId } : { ownerId: userId });
  if (!city) throw new Error("CITY_NOT_FOUND");

  // Compute resources without writing to the DB — on READ there's no point doing a WRITE.
  // We only write when resources are spent (upgrade, recruitment, attack).
  const updated = computeResources(city);

  // All independent queries in parallel — zero sequentiality
  const [stationedSupports, ownCommands, ownedCities] = await Promise.all([
    findStationedSupports(city.id),
    findOutgoingCommands(city.id),
    findOwnedCities(userId),
  ]);
  const supportMap = new Map<string, number>();
  for (const c of stationedSupports) {
    for (const u of c.units) {
      supportMap.set(u.name, (supportMap.get(u.name) ?? 0) + u.quantity);
    }
  }
  const supportUnits = Array.from(supportMap.entries()).map(([name, quantity]) => ({ name, quantity }));
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

  return { ...city, ...updated, supportUnits, totalPopulation, ownedCities };
};

export const renameMyCity = async (userId: string, name: string, cityId?: string) => {
  const city = await findCityIdForOwner(cityId ? { id: cityId, ownerId: userId } : { ownerId: userId });
  if (!city) throw new Error("CITY_NOT_FOUND");
  return updateCityName(city.id, name);
};

export const createStarterCity = async (
  userId: string,
  cityName: string,
  tx: TransactionClient = prisma
) => {
  // pickFreeSlot no longer takes tx — it goes through SlotAllocator (in-memory, mutex)
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
