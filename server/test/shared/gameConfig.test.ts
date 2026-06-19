import { describe, it, expect } from "vitest";
import {
  BUILDINGS,
  UNITS,
  getHousingCapacity,
  getResourceProduction,
  getWarehouseCapacity,
  getAirDefenseBonus,
  getHarborCapacity,
  getBuildingUpgradeCost,
  getBuildingUpgradeTime,
  getRecruitmentTime,
  getBuildingPoints,
  getGovernorCost,
  getGovernorRecruitmentTime,
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
  getResourceTravelTimeSec,
  calcAirDefenseDamage,
  calcBuildingDamage,
  GOVERNOR_HQ_REQUIRED,
  GOVERNOR_POPULATION,
  RESOURCE_TRAVEL_MIN_PER_FIELD,
} from "../../../shared/gameConfig";

describe("getHousingCapacity", () => {
  it("returns 0 at or below level 0", () => {
    expect(getHousingCapacity(0)).toBe(0);
    expect(getHousingCapacity(-3)).toBe(0);
  });
  it("reads the lookup table at level-1", () => {
    expect(getHousingCapacity(1)).toBe(240);
    expect(getHousingCapacity(30)).toBe(24000);
  });
});

describe("getResourceProduction", () => {
  it("returns 0 at or below level 0", () => {
    expect(getResourceProduction(0)).toBe(0);
  });
  it("reads the table and applies gameSpeed", () => {
    expect(getResourceProduction(1)).toBe(30);
    expect(getResourceProduction(30)).toBe(2400);
    expect(getResourceProduction(1, 2)).toBe(60);
  });
});

describe("getWarehouseCapacity", () => {
  it("returns the base 1000 at or below level 0 (not 0)", () => {
    expect(getWarehouseCapacity(0)).toBe(1000);
    expect(getWarehouseCapacity(-1)).toBe(1000);
  });
  it("reads the table at level-1", () => {
    expect(getWarehouseCapacity(1)).toBe(1000);
    expect(getWarehouseCapacity(30)).toBe(400000);
  });
});

describe("getAirDefenseBonus", () => {
  it("returns 0 at or below level 0", () => {
    expect(getAirDefenseBonus(0)).toBe(0);
    expect(getAirDefenseBonus(-5)).toBe(0);
  });
  it("indexes by level (not level-1)", () => {
    expect(getAirDefenseBonus(1)).toBe(4);
    expect(getAirDefenseBonus(5)).toBe(20);
    expect(getAirDefenseBonus(19)).toBe(99);
  });
  it("clamps at level 20 and above", () => {
    expect(getAirDefenseBonus(20)).toBe(107);
    expect(getAirDefenseBonus(25)).toBe(107);
  });
});

describe("getHarborCapacity", () => {
  it("returns 0 at or below level 0", () => {
    expect(getHarborCapacity(0)).toBe(0);
  });
  it("reads the table at level-1", () => {
    expect(getHarborCapacity(1)).toBe(200);
    expect(getHarborCapacity(25)).toBe(42351);
  });
});

describe("getBuildingUpgradeCost", () => {
  it("returns base cost at level 0 (growth^0 = 1)", () => {
    expect(getBuildingUpgradeCost("HEADQUARTERS", 0)).toEqual({
      money: 90,
      energy: 80,
      ammo: 70,
    });
  });
  it("compounds by costGrowth and rounds", () => {
    expect(getBuildingUpgradeCost("HEADQUARTERS", 1)).toEqual({
      money: 113,
      energy: 100,
      ammo: 88,
    });
  });
});

describe("getBuildingUpgradeTime", () => {
  it("applies no HQ reduction at hq level 0", () => {
    expect(getBuildingUpgradeTime("HEADQUARTERS", 0, 0)).toBe(60);
  });
  it("clamps the HQ reduction floor at 0.1", () => {
    expect(getBuildingUpgradeTime("HEADQUARTERS", 0, 50)).toBe(6);
    expect(getBuildingUpgradeTime("HEADQUARTERS", 0, 46)).toBe(6);
  });
  it("divides by gameSpeed", () => {
    expect(getBuildingUpgradeTime("HEADQUARTERS", 0, 0, 2)).toBe(30);
  });
});

describe("getRecruitmentTime", () => {
  it("returns base time when no military base", () => {
    expect(getRecruitmentTime("HEAVY_INFANTRY", 0)).toBe(130);
  });
  it("applies the military-base speed factor", () => {
    expect(getRecruitmentTime("HEAVY_INFANTRY", 1)).toBe(82);
  });
  it("never returns below 1 even at extreme gameSpeed", () => {
    expect(getRecruitmentTime("HEAVY_INFANTRY", 0, 100000)).toBe(1);
  });
});

describe("getBuildingPoints", () => {
  it("returns 0 at or below level 0", () => {
    expect(getBuildingPoints("HEADQUARTERS", 0)).toBe(0);
  });
  it("accumulates incremental points up to the level", () => {
    expect(getBuildingPoints("HEADQUARTERS", 1)).toBe(10);
    expect(getBuildingPoints("HEADQUARTERS", 2)).toBe(12);
    expect(getBuildingPoints("HEADQUARTERS", 5)).toBe(24);
  });
  it("clamps to the table length for over-max levels", () => {
    expect(getBuildingPoints("HEADQUARTERS", 100)).toBe(
      getBuildingPoints("HEADQUARTERS", 30)
    );
  });
});

describe("getGovernorCost", () => {
  it("grows by x1.5 for the first five governors", () => {
    expect(getGovernorCost(1)).toBe(10000);
    expect(getGovernorCost(2)).toBe(15000);
    expect(getGovernorCost(5)).toBe(50625);
  });
  it("doubles from the fifth cost for governor six and beyond", () => {
    expect(getGovernorCost(6)).toBe(101250);
  });
  it("floors fractional numbers and clamps below 1 to 1", () => {
    expect(getGovernorCost(2.9)).toBe(15000);
    expect(getGovernorCost(0)).toBe(10000);
    expect(getGovernorCost(-4)).toBe(10000);
  });
});

describe("getGovernorRecruitmentTime", () => {
  it("uses the governor base recruitment time", () => {
    expect(getGovernorRecruitmentTime()).toBe(3600);
    expect(getGovernorRecruitmentTime(2)).toBe(1800);
  });
  it("never returns below 1", () => {
    expect(getGovernorRecruitmentTime(100000)).toBe(1);
  });
});

describe("getFieldDistance", () => {
  it("computes euclidean distance", () => {
    expect(getFieldDistance(0, 0, 3, 4)).toBe(5);
    expect(getFieldDistance(2, 2, 2, 2)).toBe(0);
  });
});

describe("getSlowestUnitSpeed", () => {
  it("returns 0 when there are no positive-quantity units", () => {
    expect(getSlowestUnitSpeed({})).toBe(0);
    expect(getSlowestUnitSpeed({ HEAVY_INFANTRY: 0 })).toBe(0);
    expect(getSlowestUnitSpeed({ HEAVY_INFANTRY: -2 })).toBe(0);
  });
  it("returns the highest min/field value among present units", () => {
    expect(getSlowestUnitSpeed({ HEAVY_INFANTRY: 5 })).toBe(18);
    expect(
      getSlowestUnitSpeed({ HEAVY_INFANTRY: 1, MISSILE_LAUNCHER: 1 })
    ).toBe(30);
  });
});

describe("getUnitTravelTimeSec", () => {
  it("multiplies distance, speed, and 60 seconds", () => {
    expect(getUnitTravelTimeSec(2, 18)).toBe(2160);
  });
  it("never returns below 1", () => {
    expect(getUnitTravelTimeSec(0, 18)).toBe(1);
  });
});

describe("getResourceTravelTimeSec", () => {
  it("uses the flat resource travel rate", () => {
    expect(getResourceTravelTimeSec(1)).toBe(60 * RESOURCE_TRAVEL_MIN_PER_FIELD);
  });
  it("never returns below 1", () => {
    expect(getResourceTravelTimeSec(0)).toBe(1);
  });
});

describe("calcAirDefenseDamage", () => {
  it("returns 0 when the air defense is already down", () => {
    expect(calcAirDefenseDamage(0, 50, 50)).toBe(0);
  });
  it("returns 0 with no siege units", () => {
    expect(calcAirDefenseDamage(5, 0, 0)).toBe(0);
  });
  it("returns 0 when the siege count is below the threshold", () => {
    expect(calcAirDefenseDamage(5, 1, 0)).toBe(0);
  });
  it("caps destroyed levels at the current air-defense level", () => {
    expect(calcAirDefenseDamage(5, 50, 0)).toBe(5);
    expect(calcAirDefenseDamage(3, 1000, 0)).toBe(3);
  });
  it("combines missile launchers and drones", () => {
    expect(calcAirDefenseDamage(5, 5, 5)).toBe(calcAirDefenseDamage(5, 10, 0));
  });
});

describe("calcBuildingDamage", () => {
  it("returns 0 with no building or no drones", () => {
    expect(calcBuildingDamage(0, 100)).toBe(0);
    expect(calcBuildingDamage(5, 0)).toBe(0);
  });
  it("returns 0 when battleRatio floors effective drones to 0", () => {
    expect(calcBuildingDamage(5, 1, 0.4)).toBe(0);
    expect(calcBuildingDamage(5, 100, 0)).toBe(0);
  });
  it("caps destroyed levels at the building level", () => {
    expect(calcBuildingDamage(3, 1000)).toBe(3);
  });
});

describe("static config invariants", () => {
  it("exposes the documented governor constants", () => {
    expect(GOVERNOR_HQ_REQUIRED).toBe(30);
    expect(GOVERNOR_POPULATION).toBe(100);
    expect(UNITS.GOVERNOR.population).toBe(GOVERNOR_POPULATION);
  });
  it("keeps every building max level positive", () => {
    for (const cfg of Object.values(BUILDINGS)) {
      expect(cfg.maxLevel).toBeGreaterThan(0);
    }
  });
});
