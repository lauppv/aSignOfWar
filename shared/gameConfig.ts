// Sursa unica de adevar pentru toate datele statice ale jocului
// Importat de server SI client 

// ─── Tipuri ──────────────────────────────────────────────────────────────────

export type BuildingName =
  | "HEADQUARTERS"
  | "BANK"
  | "POWER_PLANT"
  | "WEAPONS_FACTORY"
  | "MILITARY_BASE"
  | "HOUSING"
  | "WAREHOUSE"
  | "HARBOR"
  | "AIR_DEFENSE";

export type UnitName =
  | "LIGHT_INFANTRY"
  | "DEFENDER_INFANTRY"
  | "HEAVY_INFANTRY"
  | "SNIPER"
  | "SPECIAL_FORCES"
  | "RAIDER"
  | "TANK"
  | "MISSILE_LAUNCHER"
  | "DRONE"
  | "GOVERNOR"
  | "HACKER";

export type UnitCategory = "INFANTRY" | "RANGE" | "MECHANIZED" | "SIEGE" | "CONQUER" | "SPY";

// ─── Building config ─────────────────────────────────────────────────────────

export interface BuildingConfig {
  maxLevel: number;
  baseCostMoney: number;
  baseCostEnergy: number;
  baseCostAmmo: number;
  baseTimeSec: number;
  costGrowth: number;
  timeGrowth: number;
  requiresHQ?: number;
}

export const BUILDINGS: Record<BuildingName, BuildingConfig> = {
  HEADQUARTERS: {
    maxLevel: 30,
    baseCostMoney: 90, baseCostEnergy: 80, baseCostAmmo: 70,
    baseTimeSec: 60, costGrowth: 1.25, timeGrowth: 1.22,
  },
  BANK: {
    maxLevel: 30,
    baseCostMoney: 50, baseCostEnergy: 60, baseCostAmmo: 30,
    baseTimeSec: 45, costGrowth: 1.25, timeGrowth: 1.20,
  },
  POWER_PLANT: {
    maxLevel: 30,
    baseCostMoney: 55, baseCostEnergy: 35, baseCostAmmo: 25,
    baseTimeSec: 45, costGrowth: 1.25, timeGrowth: 1.20,
  },
  WEAPONS_FACTORY: {
    maxLevel: 30,
    baseCostMoney: 65, baseCostEnergy: 55, baseCostAmmo: 35,
    baseTimeSec: 55, costGrowth: 1.25, timeGrowth: 1.20,
  },
  HOUSING: {
    maxLevel: 30,
    baseCostMoney: 45, baseCostEnergy: 40, baseCostAmmo: 20,
    baseTimeSec: 50, costGrowth: 1.25, timeGrowth: 1.20,
  },
  WAREHOUSE: {
    maxLevel: 30,
    baseCostMoney: 60, baseCostEnergy: 50, baseCostAmmo: 40,
    baseTimeSec: 50, costGrowth: 1.25, timeGrowth: 1.20,
  },
  MILITARY_BASE: {
    maxLevel: 25,
    baseCostMoney: 85, baseCostEnergy: 75, baseCostAmmo: 55,
    baseTimeSec: 80, costGrowth: 1.27, timeGrowth: 1.23,
    requiresHQ: 5,
  },
  HARBOR: {
    maxLevel: 25,
    baseCostMoney: 80, baseCostEnergy: 60, baseCostAmmo: 45,
    baseTimeSec: 70, costGrowth: 1.26, timeGrowth: 1.22,
    requiresHQ: 15,
  },
  AIR_DEFENSE: {
    maxLevel: 20,
    baseCostMoney: 120, baseCostEnergy: 140, baseCostAmmo: 90,
    baseTimeSec: 120, costGrowth: 1.28, timeGrowth: 1.25,
    requiresHQ: 5,
  },
};

// ─── Unit config ─────────────────────────────────────────────────────────────

export interface UnitConfig {
  category: UnitCategory;
  costMoney: number;
  costEnergy: number;
  costAmmo: number;
  population: number;
  speed: number;
  carry: number;
  baseRecruitmentTime: number;
  attack: number;
  defenseVsInfantry: number;
  defenseVsMechanized: number;
  defenseVsRange: number;
  airDefenseDamage?: number;
  buildingDamage?: number;
  requiresHQ?: number;
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
  HACKER: {
    category: "SPY", costMoney: 50, costEnergy: 50, costAmmo: 20,
    population: 2, speed: 9, carry: 0, baseRecruitmentTime: 180,
    attack: 0, defenseVsInfantry: 2, defenseVsMechanized: 1, defenseVsRange: 2,
    requiresHQ: 10,
  },
};

// ─── Lookup tables (hardcodate, nu urmeaza o formula) ────────────────────────

const MILITARY_BASE_SPEED_FACTOR = [
  63, 59, 56, 53, 50, 47, 44, 42, 39, 37,
  35, 33, 31, 29, 28, 26, 25, 23, 22, 21,
  20, 19, 17, 16, 16,
];

const RESOURCE_PRODUCTION = [
     30,   34,   40,   47,   54,   63,   74,   86,  100,  116,
    135,  158,  183,  213,  248,  289,  336,  391,  455,  529,
    616,  716,  833,  969, 1127, 1311, 1525, 1774, 2063, 2400,
];

const WAREHOUSE_CAPACITY = [
      1000,   1229,   1511,   1858,   2285,   2809,   3454,   4247,   5221,   6420,
      7893,   9704,  11932,  14670,  18037,  22176,  27265,  33523,  41216,  50675,
     62305,  76603,  94183, 115798, 142373, 175047, 215219, 264610, 325337, 400000,
];

const HOUSING_POPULATION = [
     240,    281,    329,    386,    452,    530,    621,    728,    854,   1001,
    1173,   1375,   1611,   1889,   2214,   2594,   3041,   3564,   4177,   4895,
    5738,   6724,   7881,   9237,  10848,  12688,  14870,  17428,  20426,  24000,
];

const AIR_DEFENSE_BONUS_PCT = [
  0, 4, 8, 12, 16, 20, 24, 29, 34, 39, 44,
  49, 55, 60, 66, 72, 79, 85, 92, 99, 107,
];

const HARBOR_CAPACITY = [
    200,   250,   312,   390,   488,   610,   762,   953,  1192,  1490,
   1862,  2328,  2910,  3637,  4547,  5684,  7105,  8881, 11102, 13877,
  17347, 21684, 27105, 33881, 42351,
];

// ─── Building points (incremental per level, sursa: wiki Triburile) ─────────

const POINTS_HEADQUARTERS = [
   10,   2,   3,   4,   5,   4,   5,   6,   7,   9,
   11,  12,  15,  18,  21,  26,  31,  37,  44,  53,
   64,  77,  92, 110, 133, 159, 191, 229, 274, 330,
];

const POINTS_RESOURCE = [
    6,   1,   2,   1,   2,   3,   3,   3,   5,   5,
    6,   8,   8,  11,  13,  15,  19,  22,  27,  32,
   38,  46,  55,  66,  80,  95, 115, 137, 165, 198,
];

const POINTS_WAREHOUSE = POINTS_RESOURCE;

const POINTS_HOUSING = [
    5,   1,   1,   2,   1,   2,   3,   3,   3,   5,
    5,   6,   8,   8,  11,  13,  15,  19,  22,  27,
   32,  38,  46,  55,  66,  80,  95, 115, 137, 165,
];

const POINTS_MILITARY_BASE = [
   16,   3,   4,   5,   6,   7,   9,  12,  14,  17,
   21,  25,  29,  36,  43,  51,  59,  71,  85, 102,
  122, 147, 175, 210, 212,
];

const POINTS_HARBOR = [
   10,   2,   2,   3,   4,   4,   5,   6,   7,   9,
   10,  12,  15,  18,  21,  26,  31,  37,  44,  53,
   64,  77,  92, 110, 133,
];

const POINTS_AIR_DEFENSE = [
    8,   2,   2,   2,   3,   3,   4,   5,   5,   7,
    9,  12,  12,  15,  20,  20,  29,  29,  36,  43,
];

const BUILDING_POINTS: Record<BuildingName, readonly number[]> = {
  HEADQUARTERS:    POINTS_HEADQUARTERS,
  BANK:            POINTS_RESOURCE,
  POWER_PLANT:     POINTS_RESOURCE,
  WEAPONS_FACTORY: POINTS_RESOURCE,
  WAREHOUSE:       POINTS_WAREHOUSE,
  HOUSING:         POINTS_HOUSING,
  MILITARY_BASE:   POINTS_MILITARY_BASE,
  HARBOR:          POINTS_HARBOR,
  AIR_DEFENSE:     POINTS_AIR_DEFENSE,
};

// ─── Functii pure (gameSpeed e parametru, default 1) ─────────────────────────

export const getHousingCapacity = (level: number): number => {
  if (level <= 0) return 0;
  return HOUSING_POPULATION[level - 1];
};

export const getResourceProduction = (level: number, gameSpeed: number = 1): number => {
  if (level <= 0) return 0;
  return RESOURCE_PRODUCTION[level - 1] * gameSpeed;
};

export const getWarehouseCapacity = (level: number): number => {
  if (level <= 0) return 1000;
  return WAREHOUSE_CAPACITY[level - 1];
};

export const getAirDefenseBonus = (level: number): number => {
  if (level <= 0) return 0;
  if (level >= 20) return AIR_DEFENSE_BONUS_PCT[20];
  return AIR_DEFENSE_BONUS_PCT[level];
};

export const getHarborCapacity = (level: number): number => {
  if (level <= 0) return 0;
  return HARBOR_CAPACITY[level - 1];
};

export const getBuildingUpgradeCost = (type: BuildingName, currentLevel: number) => {
  const cfg = BUILDINGS[type];
  const factor = Math.pow(cfg.costGrowth, currentLevel);
  return {
    money:  Math.round(cfg.baseCostMoney  * factor),
    energy: Math.round(cfg.baseCostEnergy * factor),
    ammo:   Math.round(cfg.baseCostAmmo   * factor),
  };
};

export const getBuildingUpgradeTime = (
  type: BuildingName,
  currentLevel: number,
  hqLevel: number,
  gameSpeed: number = 1
): number => {
  const cfg = BUILDINGS[type];
  const baseTime = cfg.baseTimeSec * Math.pow(cfg.timeGrowth, currentLevel);
  const hqReduction = Math.max(0.1, 1 - hqLevel * 0.02);
  return Math.round(baseTime * hqReduction / gameSpeed);
};

export const getRecruitmentTime = (unit: UnitName, militaryBaseLevel: number, gameSpeed: number = 1): number => {
  const cfg = UNITS[unit];
  let time = cfg.baseRecruitmentTime;
  if (militaryBaseLevel > 0) {
    const factor = MILITARY_BASE_SPEED_FACTOR[militaryBaseLevel - 1] / 100;
    time = Math.round(time * factor);
  }
  return Math.max(1, Math.round(time / gameSpeed));
};

export const getBuildingPoints = (type: BuildingName, level: number): number => {
  if (level <= 0) return 0;
  const table = BUILDING_POINTS[type];
  let sum = 0;
  for (let i = 0; i < Math.min(level, table.length); i++) sum += table[i];
  return sum;
};

// Costul (per resursa) pentru al N-lea Governor (N = 1, 2, 3, ...).
// Contorul e per cont, iar Money = Energy = Ammo.
// Formula: N ≤ 5 creste cu ×1.5 (usor); N ≥ 6 se dubleaza (greu).
export const getGovernorCost = (governorNumber: number): number => {
  const n = Math.max(1, Math.floor(governorNumber));
  if (n <= 5) return Math.round(10_000 * Math.pow(1.5, n - 1));
  const cost5 = Math.round(10_000 * Math.pow(1.5, 4)); // 50625
  return cost5 * Math.pow(2, n - 5);
};

export const GOVERNOR_HQ_REQUIRED = 30;
export const GOVERNOR_POPULATION  = 100;

export const getGovernorRecruitmentTime = (gameSpeed: number = 1): number => {
  return Math.max(1, Math.round(UNITS.GOVERNOR.baseRecruitmentTime / gameSpeed));
};

// Negustorii (RESOURCES) merg uniform, independent de cantitate, rapid.
export const RESOURCE_TRAVEL_MIN_PER_FIELD = 2;

export const getFieldDistance = (
  fromX: number, fromY: number,
  toX: number, toY: number
): number => Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);

// Cea mai lenta unitate (valoare mare in min/camp = mai lent). Intoarce 0 daca
// nu exista unitati > 0.
export const getSlowestUnitSpeed = (
  unitCounts: Partial<Record<UnitName, number>>
): number => {
  let slowest = 0;
  for (const [name, qty] of Object.entries(unitCounts)) {
    if (!qty || qty <= 0) continue;
    const s = UNITS[name as UnitName].speed;
    if (s > slowest) slowest = s;
  }
  return slowest;
};

export const getUnitTravelTimeSec = (
  distanceFields: number,
  slowestSpeedMinPerField: number,
  gameSpeed: number = 1
): number => Math.max(1, Math.round(distanceFields * slowestSpeedMinPerField * 60 / gameSpeed));

export const getResourceTravelTimeSec = (
  distanceFields: number,
  gameSpeed: number = 1
): number => Math.max(1, Math.round(distanceFields * RESOURCE_TRAVEL_MIN_PER_FIELD * 60 / gameSpeed));

export const calcAirDefenseDamage = (airDefenseLevel: number, mlCount: number, droneCount: number): number => {
  if (airDefenseLevel <= 0 || (mlCount === 0 && droneCount === 0)) return 0;
  const totalDmg = mlCount * 60 + droneCount * 15;
  const W = airDefenseLevel;
  const threshold = 2 * Math.pow(1.09, W);
  const levels = Math.floor((totalDmg - threshold) / (2 * threshold) + 1);
  return Math.max(0, Math.min(Math.floor(W / 2), levels));
};
