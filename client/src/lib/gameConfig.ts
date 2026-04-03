// Client-side game config — importa totul din sursa unica de adevar (shared/)
// Adauga doar helpers specifice UI-ului

import type { UnitName } from "@shared/gameConfig.ts";

// Re-exporta tot din shared
export {
  BUILDINGS,
  UNITS,
  getBuildingUpgradeCost,
  getBuildingUpgradeTime,
  getRecruitmentTime,
  getHousingCapacity as getMaxPopulation,
  getWarehouseCapacity,
  getAirDefenseBonus,
  getHarborCapacity,
  getResourceProduction,
} from "@shared/gameConfig.ts";

export type {
  BuildingName,
  UnitName,
  UnitCategory,
  BuildingConfig,
  UnitConfig,
} from "@shared/gameConfig.ts";

// ─── Helpers specifice UI-ului ───────────────────────────────────────────────

import type { CityOverview } from "../types/index.ts";
import { UNITS } from "@shared/gameConfig.ts";

export const UNIT_POPULATION: Record<UnitName, number> = Object.fromEntries(
  Object.entries(UNITS).map(([name, cfg]) => [name, cfg.population])
) as Record<UnitName, number>;

export function computePopulation(city: CityOverview): number {
  return city.units.reduce(
    (sum, u) => sum + u.quantity * (UNITS[u.name as UnitName]?.population ?? 1),
    0
  );
}

export function getBuildingLevel(city: CityOverview, name: CityOverview["buildings"][number]["name"]): number {
  return city.buildings.find((b) => b.name === name)?.level ?? 0;
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
