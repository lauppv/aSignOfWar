import { describe, it, expect, afterEach, vi } from "vitest";
import { calculateBattle } from "../../../shared/battleCalc";
import type { BattleUnit } from "../../../shared/battleCalc";

afterEach(() => {
  vi.restoreAllMocks();
});

const find = (units: BattleUnit[], name: string) =>
  units.find((u) => u.name === name)?.quantity ?? 0;

describe("calculateBattle", () => {
  it("attacker overwhelmingly wins vs an empty city and loots carry/3", () => {
    const res = calculateBattle(
      [{ name: "LIGHT_INFANTRY", quantity: 100 }],
      [],
      0,
      10000,
      10000,
      10000
    );
    expect(res.attackerWon).toBe(true);
    expect(find(res.attackerSurvivors, "LIGHT_INFANTRY")).toBe(100);
    expect(res.defenderSurvivors).toEqual([]);
    expect(res.battleRatio).toBe(1);
    expect(res.stolenMoney).toBe(333);
    expect(res.stolenEnergy).toBe(333);
    expect(res.stolenAmmo).toBe(333);
    expect(res.loyaltyDamage).toBe(0);
  });

  it("caps loot at the defender's available resources", () => {
    const res = calculateBattle(
      [{ name: "LIGHT_INFANTRY", quantity: 100 }],
      [],
      0,
      100,
      0,
      10000
    );
    expect(res.stolenMoney).toBe(100);
    expect(res.stolenEnergy).toBe(0);
    expect(res.stolenAmmo).toBe(333);
  });

  it("attacker loses to an overwhelming defense and is wiped out", () => {
    const res = calculateBattle(
      [{ name: "LIGHT_INFANTRY", quantity: 1 }],
      [{ name: "TANK", quantity: 100 }],
      0,
      1000,
      1000,
      1000
    );
    expect(res.attackerWon).toBe(false);
    expect(find(res.attackerSurvivors, "LIGHT_INFANTRY")).toBe(0);
    expect(find(res.defenderSurvivors, "TANK")).toBe(100);
    expect(res.battleRatio).toBeCloseTo(0.002, 5);
    expect(res.stolenMoney).toBe(0);
    expect(res.loyaltyDamage).toBe(0);
  });

  it("blocks the lone-governor exploit (zero attack force always loses)", () => {
    const res = calculateBattle(
      [{ name: "GOVERNOR", quantity: 1 }],
      [],
      0,
      1000,
      1000,
      1000
    );
    expect(res.attackerWon).toBe(false);
    expect(find(res.attackerSurvivors, "GOVERNOR")).toBe(0);
  });

  it("filters out SPY units from both sides", () => {
    const res = calculateBattle(
      [
        { name: "HACKER", quantity: 50 },
        { name: "LIGHT_INFANTRY", quantity: 100 },
      ],
      [{ name: "HACKER", quantity: 10 }],
      0,
      1000,
      1000,
      1000
    );
    expect(res.attackerWon).toBe(true);
    expect(res.attackerSurvivors.some((u) => u.name === "HACKER")).toBe(false);
    expect(res.defenderSurvivors.some((u) => u.name === "HACKER")).toBe(false);
  });

  it("keeps the governor and deals loyalty damage when the city is emptied", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const res = calculateBattle(
      [
        { name: "LIGHT_INFANTRY", quantity: 100 },
        { name: "GOVERNOR", quantity: 1 },
      ],
      [],
      0,
      0,
      0,
      0
    );
    expect(res.attackerWon).toBe(true);
    expect(find(res.attackerSurvivors, "GOVERNOR")).toBe(1);
    expect(res.loyaltyDamage).toBe(20);
  });

  it("adds the random component to loyalty damage (max 35)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const res = calculateBattle(
      [
        { name: "LIGHT_INFANTRY", quantity: 100 },
        { name: "GOVERNOR", quantity: 1 },
      ],
      [],
      0,
      0,
      0,
      0
    );
    expect(res.loyaltyDamage).toBe(35);
  });

  it("destroys air-defense levels with missile launchers", () => {
    const res = calculateBattle(
      [
        { name: "LIGHT_INFANTRY", quantity: 1000 },
        { name: "MISSILE_LAUNCHER", quantity: 50 },
      ],
      [],
      5,
      0,
      0,
      0
    );
    expect(res.airDefenseLevelsDestroyed).toBe(5);
    expect(res.newAirDefenseLevel).toBe(0);
  });

  it("only lets drones hit air defense when not aimed at another building", () => {
    const attacker: BattleUnit[] = [
      { name: "LIGHT_INFANTRY", quantity: 1000 },
      { name: "DRONE", quantity: 100 },
    ];
    const atBank = calculateBattle(attacker, [], 3, 0, 0, 0, "BANK");
    expect(atBank.airDefenseLevelsDestroyed).toBe(0);
    expect(atBank.newAirDefenseLevel).toBe(3);

    const atAir = calculateBattle(attacker, [], 3, 0, 0, 0);
    expect(atAir.airDefenseLevelsDestroyed).toBe(3);
    expect(atAir.newAirDefenseLevel).toBe(0);
  });

  it("returns a zero battleRatio for an empty engagement", () => {
    const res = calculateBattle([], [], 0, 0, 0, 0);
    expect(res.attackerWon).toBe(false);
    expect(res.battleRatio).toBe(0);
  });
});
