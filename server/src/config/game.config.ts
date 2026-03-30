// Toate datele statice ale jocului — costuri, timpi, efecte per level
// Niciodata nu se schimba in timp ce jocul ruleaza

import { BuildingName } from "@prisma/client";
export type { BuildingName };

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
  const hqReduction = 1 - hqLevel * 0.02;
  return Math.round(baseTime * hqReduction);
};
