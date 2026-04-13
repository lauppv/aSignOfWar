// Helpers specifice UI-ului (nu config — config-ul e in shared/gameConfig.ts)

import type { UnitName } from "@shared/gameConfig.ts";
import { UNITS } from "@shared/gameConfig.ts";
import type { CityOverview } from "../types/index.ts";

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
