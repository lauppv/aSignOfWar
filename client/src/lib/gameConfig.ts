// Client-side mirror of static lookup tables from server game.config
// Only what the frontend needs for display and validation

import type { CityOverview, UnitName } from "../types/index.ts";

const HOUSING_POPULATION = [
     240,    281,    329,    386,    452,    530,    621,    728,    854,   1001,
    1173,   1375,   1611,   1889,   2214,   2594,   3041,   3564,   4177,   4895,
    5738,   6724,   7881,   9237,  10848,  12688,  14870,  17428,  20426,  24000,
];

const WAREHOUSE_CAPACITY = [
      1000,   1229,   1511,   1858,   2285,   2809,   3454,   4247,   5221,   6420,
      7893,   9704,  11932,  14670,  18037,  22176,  27265,  33523,  41216,  50675,
     62305,  76603,  94183, 115798, 142373, 175047, 215219, 264610, 325337, 400000,
];

export const UNIT_POPULATION: Record<UnitName, number> = {
  LIGHT_INFANTRY:     1,
  DEFENDER_INFANTRY:  1,
  ANTI_TANK_INFANTRY: 1,
  SNIPER:             1,
  SPECIAL_FORCES:     5,
  RAIDER:             4,
  TANK:               6,
  MISSILE_LAUNCHER:   5,
  DRONE:              8,
  GOVERNOR:           100,
};

export function getMaxPopulation(housingLevel: number): number {
  if (housingLevel <= 0) return 0;
  return HOUSING_POPULATION[housingLevel - 1];
}

export function getWarehouseCapacity(level: number): number {
  if (level <= 0) return 1000;
  return WAREHOUSE_CAPACITY[level - 1];
}

export function computePopulation(city: CityOverview): number {
  return city.units.reduce(
    (sum, u) => sum + u.quantity * (UNIT_POPULATION[u.name] ?? 1),
    0
  );
}

export function getBuildingLevel(city: CityOverview, name: CityOverview["buildings"][number]["name"]): number {
  return city.buildings.find((b) => b.name === name)?.level ?? 0;
}

const AIR_DEFENSE_BONUS_PCT = [
  0, 4, 8, 12, 16, 20, 24, 29, 34, 39, 44,
  49, 55, 60, 66, 72, 79, 85, 92, 99, 107,
];

export function getAirDefenseBonus(level: number): number {
  if (level <= 0) return 0;
  if (level >= 20) return AIR_DEFENSE_BONUS_PCT[20];
  return AIR_DEFENSE_BONUS_PCT[level];
}
