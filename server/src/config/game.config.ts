// Toate datele statice ale jocului — costuri, timpi, efecte per level
// Niciodata nu se schimba in timp ce jocul ruleaza

import { BuildingName, UnitName, UnitCategory } from "@prisma/client";
import env from "./env";
export type { BuildingName, UnitName, UnitCategory };

export interface BuildingConfig {
  maxLevel: number;
  baseCostMoney: number;
  baseCostEnergy: number;
  baseCostAmmo: number;
  baseTimeSec: number;      // timp constructie nivel 1, in secunde
  costGrowth: number;       // factor crestere cost per level
  timeGrowth: number;       // factor crestere timp per level
  requiresHQ?: number;      // level minim Headquarters pentru a debloca
}

export const BUILDINGS: Record<BuildingName, BuildingConfig> = {
  HEADQUARTERS: {
    maxLevel: 30,
    baseCostMoney: 90,
    baseCostEnergy: 80,
    baseCostAmmo: 70,
    baseTimeSec: 60,
    costGrowth: 1.25,
    timeGrowth: 1.22,
  },
  BANK: {
    maxLevel: 30,
    baseCostMoney: 50,
    baseCostEnergy: 60,
    baseCostAmmo: 30,
    baseTimeSec: 45,
    costGrowth: 1.25,
    timeGrowth: 1.20,
  },
  POWER_PLANT: {
    maxLevel: 30,
    baseCostMoney: 55,
    baseCostEnergy: 35,
    baseCostAmmo: 25,
    baseTimeSec: 45,
    costGrowth: 1.25,
    timeGrowth: 1.20,
  },
  WEAPONS_FACTORY: {
    maxLevel: 30,
    baseCostMoney: 65,
    baseCostEnergy: 55,
    baseCostAmmo: 35,
    baseTimeSec: 55,
    costGrowth: 1.25,
    timeGrowth: 1.20,
  },
  HOUSING: {
    maxLevel: 30,
    baseCostMoney: 45,
    baseCostEnergy: 40,
    baseCostAmmo: 20,
    baseTimeSec: 50,
    costGrowth: 1.25,
    timeGrowth: 1.20,
  },
  WAREHOUSE: {
    maxLevel: 30,
    baseCostMoney: 60,
    baseCostEnergy: 50,
    baseCostAmmo: 40,
    baseTimeSec: 50,
    costGrowth: 1.25,
    timeGrowth: 1.20,
  },
  MILITARY_BASE: {
    maxLevel: 25,
    baseCostMoney: 85,
    baseCostEnergy: 75,
    baseCostAmmo: 55,
    baseTimeSec: 80,
    costGrowth: 1.27,
    timeGrowth: 1.23,
    requiresHQ: 5,
  },
  HARBOR: {
    maxLevel: 25,
    baseCostMoney: 80,
    baseCostEnergy: 60,
    baseCostAmmo: 45,
    baseTimeSec: 70,
    costGrowth: 1.26,
    timeGrowth: 1.22,
    requiresHQ: 15,
  },
  AIR_DEFENSE: {
    maxLevel: 20,
    baseCostMoney: 120,
    baseCostEnergy: 140,
    baseCostAmmo: 90,
    baseTimeSec: 120,
    costGrowth: 1.28,
    timeGrowth: 1.25,
    requiresHQ: 5,
  },
};

export interface UnitConfig {
  category:             UnitCategory;
  costMoney:            number;
  costEnergy:           number;
  costAmmo:             number;
  population:           number;
  speed:                number;       // minute de deplasare per unitate de distanta
  carry:                number;       // resurse transportate
  baseRecruitmentTime:  number;       // secunde la Military base nivel 0
  attack:               number;
  defenseVsInfantry:    number;
  defenseVsMechanized:  number;
  defenseVsRange:       number;
  wallDamage?:          number;       // doar unitati Siege
  buildingDamage?:      number;       // doar Drone
  requiresHQ?:          number;
  requiresMilitaryBase?: number;
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
  ANTI_TANK_INFANTRY: {
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
    wallDamage: 60,
    requiresHQ: 20, requiresMilitaryBase: 15,
  },
  DRONE: {
    category: "SIEGE", costMoney: 320, costEnergy: 400, costAmmo: 100,
    population: 8, speed: 30, carry: 0, baseRecruitmentTime: 1000,
    attack: 100, defenseVsInfantry: 100, defenseVsMechanized: 50, defenseVsRange: 100,
    wallDamage: 15, buildingDamage: 80,
    requiresHQ: 20, requiresMilitaryBase: 20,
  },
  GOVERNOR: {
    category: "CONQUER", costMoney: 1000, costEnergy: 500, costAmmo: 500,
    population: 100, speed: 18, carry: 0, baseRecruitmentTime: 3600,
    attack: 0, defenseVsInfantry: 0, defenseVsMechanized: 0, defenseVsRange: 0,
    requiresHQ: 30,
  },
};

// Procentul de reducere a timpului de recrutare per nivel Military base (1-25)
// Hardcodat pentru ca nu urmeaza o scadere uniforma, plus ca se opreste la 16% cu un alt %16 inainte
// Momentan ramane asa
const MILITARY_BASE_SPEED_FACTOR = [
  63, 59, 56, 53, 50, 47, 44, 42, 39, 37,
  35, 33, 31, 29, 28, 26, 25, 23, 22, 21,
  20, 19, 17, 16, 16,
];

// Calculeaza timpul de recrutare (in secunde) pentru o unitate
// militaryBaseLevel = 0 inseamna fara reducere
export const getRecruitmentTime = (unit: UnitName, militaryBaseLevel: number): number => {
  const cfg = UNITS[unit];
  let time = cfg.baseRecruitmentTime;
  if (militaryBaseLevel > 0) {
    const factor = MILITARY_BASE_SPEED_FACTOR[militaryBaseLevel - 1] / 100;
    time = Math.round(time * factor);
  }
  return Math.max(1, Math.round(time / env.gameSpeed));
};

// Productie per ora pentru cladirile de resurse (index = level - 1, niveluri 1-30)
// BANK -> money, POWER_PLANT -> energy, WEAPONS_FACTORY -> ammo
const RESOURCE_PRODUCTION = [
     30,   34,   40,   47,   54,   63,   74,   86,  100,  116,
    135,  158,  183,  213,  248,  289,  336,  391,  455,  529,
    616,  716,  833,  969, 1127, 1311, 1525, 1774, 2063, 2400,
];

// Capacitate depozitare per resursa pentru fiecare level de Warehouse (index = level - 1, niveluri 1-30)
const WAREHOUSE_CAPACITY = [
      1000,   1229,   1511,   1858,   2285,   2809,   3454,   4247,   5221,   6420,
      7893,   9704,  11932,  14670,  18037,  22176,  27265,  33523,  41216,  50675,
     62305,  76603,  94183, 115798, 142373, 175047, 215219, 264610, 325337, 400000,
];

// Populatie maxima per nivel Housing (index = level - 1, niveluri 1-30)
const HOUSING_POPULATION = [
     240,    281,    329,    386,    452,    530,    621,    728,    854,   1001,
    1173,   1375,   1611,   1889,   2214,   2594,   3041,   3564,   4177,   4895,
    5738,   6724,   7881,   9237,  10848,  12688,  14870,  17428,  20426,  23939,
];

export const getHousingCapacity = (level: number): number => {
  if (level <= 0) return 0;
  return HOUSING_POPULATION[level - 1];
};

export const getResourceProduction = (level: number): number => {
  if (level <= 0) return 0;
  return RESOURCE_PRODUCTION[level - 1] * env.gameSpeed;
};

export const getWarehouseCapacity = (level: number): number => {
  if (level <= 0) return 1000;
  return WAREHOUSE_CAPACITY[level - 1];
};

// Calculeaza costul pentru urmatorul level al unei cladiri
// level = levelul CURENT (upgradezi DE LA acest level)
export const getBuildingUpgradeCost = (type: BuildingName, currentLevel: number) => {
  const cfg = BUILDINGS[type];
  const factor = Math.pow(cfg.costGrowth, currentLevel);
  return {
    money:  Math.round(cfg.baseCostMoney  * factor),
    energy: Math.round(cfg.baseCostEnergy * factor),
    ammo:   Math.round(cfg.baseCostAmmo   * factor),
  };
};

// Calculeaza timpul de constructie (in secunde) pentru urmatorul level
// Headquarters reduce timpul tuturor cladirilor cu 2% per level
export const getBuildingUpgradeTime = (
  type: BuildingName,
  currentLevel: number,
  hqLevel: number
): number => {
  const cfg = BUILDINGS[type];
  const baseTime = cfg.baseTimeSec * Math.pow(cfg.timeGrowth, currentLevel);
  const hqReduction = Math.max(0.1, 1 - hqLevel * 0.02);
  return Math.round(baseTime * hqReduction / env.gameSpeed);
};
