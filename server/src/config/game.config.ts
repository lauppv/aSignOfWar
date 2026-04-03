// Wrapper peste shared/gameConfig — adauga gameSpeed din env
// Toate datele statice vin din sursa unica de adevar (shared/)

import env from "./env";

// Re-exporta tot din shared ca sa nu schimbam importurile din restul serverului
export {
  BUILDINGS,
  UNITS,
  getBuildingUpgradeCost,
  getHousingCapacity,
  getWarehouseCapacity,
  getAirDefenseBonus,
  getHarborCapacity,
  calcAirDefenseDamage,
} from "../../../shared/gameConfig";

export type {
  BuildingName,
  UnitName,
  UnitCategory,
  BuildingConfig,
  UnitConfig,
} from "../../../shared/gameConfig";

import {
  getResourceProduction as _getResourceProduction,
  getBuildingUpgradeTime as _getBuildingUpgradeTime,
  getRecruitmentTime as _getRecruitmentTime,
  getTravelTimeSec as _getTravelTimeSec,
} from "../../../shared/gameConfig";

// Functii cu gameSpeed aplicat automat din env
export const getResourceProduction = (level: number): number =>
  _getResourceProduction(level, env.gameSpeed);

export const getBuildingUpgradeTime = (type: Parameters<typeof _getBuildingUpgradeTime>[0], currentLevel: number, hqLevel: number): number =>
  _getBuildingUpgradeTime(type, currentLevel, hqLevel, env.gameSpeed);

export const getRecruitmentTime = (unit: Parameters<typeof _getRecruitmentTime>[0], militaryBaseLevel: number): number =>
  _getRecruitmentTime(unit, militaryBaseLevel, env.gameSpeed);

export const getTravelTimeSec = (): number =>
  _getTravelTimeSec(env.gameSpeed);
