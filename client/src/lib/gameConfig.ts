// Client-side mirror of static lookup tables from server game.config
// Only what the frontend needs for display and validation

import type { CityOverview, UnitName, UnitCategory } from "../types/index.ts";

export interface UnitConfig {
  category:              UnitCategory;
  costMoney:             number;
  costEnergy:            number;
  costAmmo:              number;
  population:            number;
  speed:                 number;
  carry:                 number;
  baseRecruitmentTime:   number;
  attack:                number;
  defenseVsInfantry:     number;
  defenseVsMechanized:   number;
  defenseVsRange:        number;
  airDefenseDamage?:     number;
  buildingDamage?:       number;
  requiresHQ?:           number;
  requiresMilitaryBase?: number;
}

import type { BuildingName } from "../types/index.ts";

export interface BuildingConfig {
  maxLevel:       number;
  baseCostMoney:  number;
  baseCostEnergy: number;
  baseCostAmmo:   number;
  costGrowth:     number;
  requiresHQ?:    number;
}

export const BUILDINGS: Record<BuildingName, BuildingConfig> = {
  HEADQUARTERS:    { maxLevel: 30, baseCostMoney:  90, baseCostEnergy:  80, baseCostAmmo:  70, costGrowth: 1.25 },
  BANK:            { maxLevel: 30, baseCostMoney:  50, baseCostEnergy:  60, baseCostAmmo:  30, costGrowth: 1.25 },
  POWER_PLANT:     { maxLevel: 30, baseCostMoney:  55, baseCostEnergy:  35, baseCostAmmo:  25, costGrowth: 1.25 },
  WEAPONS_FACTORY: { maxLevel: 30, baseCostMoney:  65, baseCostEnergy:  55, baseCostAmmo:  35, costGrowth: 1.25 },
  HOUSING:         { maxLevel: 30, baseCostMoney:  45, baseCostEnergy:  40, baseCostAmmo:  20, costGrowth: 1.25 },
  WAREHOUSE:       { maxLevel: 30, baseCostMoney:  60, baseCostEnergy:  50, baseCostAmmo:  40, costGrowth: 1.25 },
  MILITARY_BASE:   { maxLevel: 25, baseCostMoney:  85, baseCostEnergy:  75, baseCostAmmo:  55, costGrowth: 1.27, requiresHQ:  5 },
  HARBOR:          { maxLevel: 25, baseCostMoney:  80, baseCostEnergy:  60, baseCostAmmo:  45, costGrowth: 1.26, requiresHQ: 15 },
  AIR_DEFENSE:     { maxLevel: 20, baseCostMoney: 120, baseCostEnergy: 140, baseCostAmmo:  90, costGrowth: 1.28, requiresHQ:  5 },
};

export function getBuildingUpgradeCost(name: BuildingName, currentLevel: number) {
  const cfg = BUILDINGS[name];
  const factor = Math.pow(cfg.costGrowth, currentLevel);
  return {
    money:  Math.round(cfg.baseCostMoney  * factor),
    energy: Math.round(cfg.baseCostEnergy * factor),
    ammo:   Math.round(cfg.baseCostAmmo   * factor),
  };
}

const BUILDING_TIME_GROWTH: Record<BuildingName, number> = {
  HEADQUARTERS:    1.22,
  BANK:            1.20,
  POWER_PLANT:     1.20,
  WEAPONS_FACTORY: 1.20,
  HOUSING:         1.20,
  WAREHOUSE:       1.20,
  MILITARY_BASE:   1.23,
  HARBOR:          1.22,
  AIR_DEFENSE:     1.25,
};

const BUILDING_BASE_TIME: Record<BuildingName, number> = {
  HEADQUARTERS:     60,
  BANK:             45,
  POWER_PLANT:      45,
  WEAPONS_FACTORY:  55,
  HOUSING:          50,
  WAREHOUSE:        50,
  MILITARY_BASE:    80,
  HARBOR:           70,
  AIR_DEFENSE:     120,
};

export function getBuildingUpgradeTime(name: BuildingName, currentLevel: number, hqLevel: number): number {
  const baseTime    = BUILDING_BASE_TIME[name] * Math.pow(BUILDING_TIME_GROWTH[name], currentLevel);
  const hqReduction = Math.max(0.1, 1 - hqLevel * 0.02);
  return Math.round(baseTime * hqReduction);
}

const MILITARY_BASE_SPEED_FACTOR = [
  63, 59, 56, 53, 50, 47, 44, 42, 39, 37,
  35, 33, 31, 29, 28, 26, 25, 23, 22, 21,
  20, 19, 17, 16, 16,
];

export function getRecruitmentTime(unitName: UnitName, mbLevel: number): number {
  const base = UNITS[unitName].baseRecruitmentTime ?? 0;
  if (mbLevel <= 0) return base;
  const factor = MILITARY_BASE_SPEED_FACTOR[mbLevel - 1] / 100;
  return Math.max(1, Math.round(base * factor));
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const UNITS: Record<UnitName, UnitConfig> = {
  LIGHT_INFANTRY: {
    category: "INFANTRY", costMoney: 60, costEnergy: 30, costAmmo: 40,
    population: 1, speed: 18, carry: 10, baseRecruitmentTime: 120,
    attack: 40, defenseVsInfantry: 10, defenseVsMechanized: 5, defenseVsRange: 10,
  },
  DEFENDER_INFANTRY: {
    category: "INFANTRY", costMoney: 30, costEnergy: 30, costAmmo: 70,
    population: 1, speed: 22, carry: 15, baseRecruitmentTime: 150,
    attack: 25, defenseVsInfantry: 50, defenseVsMechanized: 15, defenseVsRange: 40,
    requiresHQ: 5,
  },
  HEAVY_INFANTRY: {
    category: "INFANTRY", costMoney: 50, costEnergy: 30, costAmmo: 10,
    population: 1, speed: 18, carry: 25, baseRecruitmentTime: 130,
    attack: 10, defenseVsInfantry: 15, defenseVsMechanized: 45, defenseVsRange: 20,
  },
  SNIPER: {
    category: "RANGE", costMoney: 100, costEnergy: 30, costAmmo: 60,
    population: 1, speed: 18, carry: 10, baseRecruitmentTime: 200,
    attack: 15, defenseVsInfantry: 50, defenseVsMechanized: 40, defenseVsRange: 5,
    requiresHQ: 10, requiresMilitaryBase: 10,
  },
  SPECIAL_FORCES: {
    category: "RANGE", costMoney: 250, costEnergy: 100, costAmmo: 150,
    population: 5, speed: 10, carry: 50, baseRecruitmentTime: 400,
    attack: 120, defenseVsInfantry: 40, defenseVsMechanized: 30, defenseVsRange: 50,
    requiresHQ: 15, requiresMilitaryBase: 10,
  },
  RAIDER: {
    category: "MECHANIZED", costMoney: 125, costEnergy: 100, costAmmo: 250,
    population: 4, speed: 10, carry: 80, baseRecruitmentTime: 300,
    attack: 130, defenseVsInfantry: 30, defenseVsMechanized: 40, defenseVsRange: 30,
    requiresHQ: 10,
  },
  TANK: {
    category: "MECHANIZED", costMoney: 200, costEnergy: 150, costAmmo: 600,
    population: 6, speed: 11, carry: 50, baseRecruitmentTime: 600,
    attack: 150, defenseVsInfantry: 200, defenseVsMechanized: 80, defenseVsRange: 180,
    requiresHQ: 20, requiresMilitaryBase: 15,
  },
  MISSILE_LAUNCHER: {
    category: "SIEGE", costMoney: 300, costEnergy: 200, costAmmo: 200,
    population: 5, speed: 30, carry: 0, baseRecruitmentTime: 800,
    attack: 2, defenseVsInfantry: 20, defenseVsMechanized: 50, defenseVsRange: 20,
    airDefenseDamage: 60,
    requiresHQ: 20, requiresMilitaryBase: 15,
  },
  DRONE: {
    category: "SIEGE", costMoney: 320, costEnergy: 400, costAmmo: 100,
    population: 8, speed: 30, carry: 0, baseRecruitmentTime: 1000,
    attack: 100, defenseVsInfantry: 100, defenseVsMechanized: 50, defenseVsRange: 100,
    airDefenseDamage: 15, buildingDamage: 80,
    requiresHQ: 20, requiresMilitaryBase: 20,
  },
  GOVERNOR: {
    category: "CONQUER", costMoney: 1000, costEnergy: 500, costAmmo: 500,
    population: 100, speed: 18, carry: 0, baseRecruitmentTime: 3600,
    attack: 0, defenseVsInfantry: 0, defenseVsMechanized: 0, defenseVsRange: 0,
    requiresHQ: 30,
  },
};

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
  HEAVY_INFANTRY: 1,
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

const RESOURCE_PRODUCTION = [
     30,   34,   40,   47,   54,   63,   74,   86,  100,  116,
    135,  158,  183,  213,  248,  289,  336,  391,  455,  529,
    616,  716,  833,  969, 1127, 1311, 1525, 1774, 2063, 2400,
];

export function getResourceProduction(level: number): number {
  if (level <= 0) return 0;
  return RESOURCE_PRODUCTION[level - 1];
}

const HARBOR_CAPACITY = [
    200,   250,   312,   390,   488,   610,   762,   953,  1192,  1490,
   1862,  2328,  2910,  3637,  4547,  5684,  7105,  8881, 11102, 13877,
  17347, 21684, 27105, 33881, 42351,
];

export function getHarborCapacity(level: number): number {
  if (level <= 0) return 0;
  return HARBOR_CAPACITY[level - 1];
}

export function getAirDefenseBonus(level: number): number {
  if (level <= 0) return 0;
  if (level >= 20) return AIR_DEFENSE_BONUS_PCT[20];
  return AIR_DEFENSE_BONUS_PCT[level];
}
