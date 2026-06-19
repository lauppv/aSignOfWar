import { describe, it, expect } from "vitest";
import {
  computeCityPoints,
  computePopulation,
  getBuildingLevel,
  fmtDuration,
  UNIT_POPULATION,
} from "@/features/city/lib/cityHelpers";
import type { CityOverview } from "@/shared/types";

const city = {
  buildings: [
    { name: "HEADQUARTERS", level: 2 },
    { name: "BANK", level: 1 },
  ],
  totalPopulation: 137,
} as unknown as CityOverview;

describe("cityHelpers", () => {
  it("sums building points across the city", () => {
    // HQ lvl 2 (10+2) + BANK lvl 1 (6) = 18
    expect(computeCityPoints(city)).toBe(18);
  });

  it("returns the server-provided total population", () => {
    expect(computePopulation(city)).toBe(137);
  });

  it("looks up a building level, defaulting to 0 when absent", () => {
    expect(getBuildingLevel(city, "HEADQUARTERS")).toBe(2);
    expect(getBuildingLevel(city, "AIR_DEFENSE")).toBe(0);
  });

  it("derives unit population from the shared config", () => {
    expect(UNIT_POPULATION.GOVERNOR).toBe(100);
    expect(UNIT_POPULATION.TANK).toBe(6);
  });

  it("formats durations across hour/minute/second boundaries", () => {
    expect(fmtDuration(3661)).toBe("1h 1m 1s");
    expect(fmtDuration(61)).toBe("1m 1s");
    expect(fmtDuration(5)).toBe("5s");
  });
});
