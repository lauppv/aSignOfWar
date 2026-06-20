import { UNITS, getAirDefenseBonus, calcAirDefenseDamage } from "./gameConfig";
import type { UnitName } from "./gameConfig";

export interface BattleUnit {
  name: UnitName;
  quantity: number;
}

export interface BattleResult {
  attackerWon: boolean;
  attackerSurvivors: BattleUnit[];
  defenderSurvivors: BattleUnit[];
  newAirDefenseLevel: number;
  airDefenseLevelsDestroyed: number;
  stolenMoney: number;
  stolenEnergy: number;
  stolenAmmo: number;
  loyaltyDamage: number;
  battleRatio: number;
}

type AtkCat = "INFANTRY" | "RANGE" | "MECHANIZED";

function toAtkCat(name: UnitName): AtkCat {
  const cat = UNITS[name].category;
  if (cat === "RANGE") return "RANGE";
  if (cat === "MECHANIZED") return "MECHANIZED";
  return "INFANTRY";
}

export function calculateBattle(
  attackerUnits: BattleUnit[],
  defenderUnits: BattleUnit[],
  airDefenseLevel: number,
  defenderMoney: number,
  defenderEnergy: number,
  defenderAmmo: number,
  targetBuilding?: string
): BattleResult {
  // Battle system inspired by Tribal Wars. Design decisions:
  //   1. The attack is split across categories (INF/RANGE/MECH), the defense is weighted by
  //      the attacker's composition — this rewards balanced armies.
  //   2. Air defense damage is computed PRE-battle but scaled by battleRatio —
  //      attackers who lose everything still deal some siege damage, it's not all-or-nothing.
  //   3. Hackers do NOT take part in battles — they have a dedicated system (SPY vs SPY).
  //   4. Loot is split equally across the 3 resources (carry / 3) — prevents cherry-picking.
  //   5. Governor loyalty damage: 20 + random(0-15). The randomness prevents the exact
  //      "I need N governors" calculation, adding strategic uncertainty.

  // Hackers do not take part in the normal battle (they have a dedicated SPY vs SPY system).
  attackerUnits = attackerUnits.filter(u => UNITS[u.name].category !== "SPY");
  defenderUnits = defenderUnits.filter(u => UNITS[u.name].category !== "SPY");

  // 1. Attack force per category
  const A: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of attackerUnits) {
    A[toAtkCat(name)] += UNITS[name].attack * quantity;
  }
  const A_total = A.INFANTRY + A.RANGE + A.MECHANIZED;

  // 2. Defense with the ORIGINAL air defense (to compute battleRatio)
  const origDefenseBonus = getAirDefenseBonus(airDefenseLevel) / 100;
  const D_orig: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of defenderUnits) {
    const cfg  = UNITS[name];
    const mult = 1 + origDefenseBonus;
    D_orig.INFANTRY   += cfg.defenseVsInfantry   * quantity * mult;
    D_orig.RANGE      += cfg.defenseVsRange      * quantity * mult;
    D_orig.MECHANIZED += cfg.defenseVsMechanized * quantity * mult;
  }
  let D_eff_orig = 0;
  if (A_total > 0) {
    D_eff_orig = (A.INFANTRY / A_total) * D_orig.INFANTRY
               + (A.RANGE   / A_total) * D_orig.RANGE
               + (A.MECHANIZED / A_total) * D_orig.MECHANIZED;
  }

  // 3. Battle ratio — scales the effectiveness of the siege (as in TW)
  //    A/D (capped at 1): when you win, the siege is at full power,
  //    when you lose it's proportional to the force ratio
  const battleRatio = D_eff_orig > 0 ? Math.min(1, A_total / D_eff_orig) : (A_total > 0 ? 1 : 0);

  // 4. Air defense damage PRE-battle, scaled by battleRatio
  const mlCount    = attackerUnits.find(u => u.name === "MISSILE_LAUNCHER")?.quantity ?? 0;
  const dronesForAD = (!targetBuilding || targetBuilding === "AIR_DEFENSE")
    ? (attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0)
    : 0;
  const effectiveML = Math.floor(mlCount * battleRatio);
  const effectiveDronesAD = Math.floor(dronesForAD * battleRatio);
  const airDefLevelsDestroyed = calcAirDefenseDamage(airDefenseLevel, effectiveML, effectiveDronesAD);
  const newAirDefenseLevel = airDefenseLevel - airDefLevelsDestroyed;

  // 5. Defense with the REDUCED air defense (for the actual battle)
  const defenseBonus = getAirDefenseBonus(newAirDefenseLevel) / 100;
  const D: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of defenderUnits) {
    const cfg  = UNITS[name];
    const mult = 1 + defenseBonus;
    D.INFANTRY   += cfg.defenseVsInfantry   * quantity * mult;
    D.RANGE      += cfg.defenseVsRange      * quantity * mult;
    D.MECHANIZED += cfg.defenseVsMechanized * quantity * mult;
  }

  // 6. Total weighted defense force
  let D_eff = 0;
  if (A_total > 0) {
    D_eff = (A.INFANTRY   / A_total) * D.INFANTRY
          + (A.RANGE      / A_total) * D.RANGE
          + (A.MECHANIZED / A_total) * D.MECHANIZED;
  }
  // A_total === 0 means an attacker with no offensive force (e.g. only a Governor, which has
  // attack: 0). Without an army you can't win a battle even against an empty city —
  // all units (including the Governor) die. This blocks the "send a Governor
  // alone and hope it's empty" exploit.
  const attackerWon = A_total > 0 && A_total >= D_eff;

  // 5. Attacker losses per category
  const atkLoss: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  if (attackerWon && A_total > 0) {
    for (const cat of ["INFANTRY", "RANGE", "MECHANIZED"] as AtkCat[]) {
      if (A[cat] === 0) continue;
      atkLoss[cat] = Math.pow(D[cat] / A_total, 1.5);
    }
  }

  const attackerSurvivors: BattleUnit[] = attackerUnits.map(({ name, quantity }) => {
    if (!attackerWon) return { name, quantity: 0 };
    if (name === "GOVERNOR") return { name, quantity };
    return {
      name,
      quantity: Math.max(0, Math.round(quantity * (1 - atkLoss[toAtkCat(name)]))),
    };
  });

  // Governor survives only if at least one combat unit survived to protect him.
  const hasCombatSurvivors = attackerSurvivors.some(u => u.name !== "GOVERNOR" && u.quantity > 0);
  for (const u of attackerSurvivors) {
    if (u.name === "GOVERNOR" && !hasCombatSurvivors) u.quantity = 0;
  }

  // 6. Defender losses
  const defLossRate = attackerWon
    ? 1.0
    : (A_total > 0 ? Math.pow(A_total / D_eff, 1.5) : 0);

  const defenderSurvivors: BattleUnit[] = defenderUnits.map(({ name, quantity }) => ({
    name,
    quantity: Math.max(0, Math.round(quantity * (1 - defLossRate))),
  }));

  // 7. Stolen resources
  let stolenMoney = 0, stolenEnergy = 0, stolenAmmo = 0;
  if (attackerWon) {
    const totalCarry = attackerSurvivors.reduce(
      (sum, { name, quantity }) => sum + UNITS[name].carry * quantity, 0
    );
    const perResource = Math.floor(totalCarry / 3);
    stolenMoney  = Math.floor(Math.min(defenderMoney,  perResource));
    stolenEnergy = Math.floor(Math.min(defenderEnergy, perResource));
    stolenAmmo   = Math.floor(Math.min(defenderAmmo,   perResource));
  }

  // 9. Governor effect
  const govSurvivors = attackerSurvivors.find(u => u.name === "GOVERNOR")?.quantity ?? 0;
  const allDefDead   = defenderSurvivors.every(u => u.quantity === 0);
  let loyaltyDamage  = 0;
  if (attackerWon && allDefDead && govSurvivors > 0) {
    loyaltyDamage = 20 + Math.floor(Math.random() * 16);
  }

  return {
    attackerWon,
    attackerSurvivors,
    defenderSurvivors,
    newAirDefenseLevel,
    airDefenseLevelsDestroyed: airDefLevelsDestroyed,
    stolenMoney,
    stolenEnergy,
    stolenAmmo,
    loyaltyDamage,
    battleRatio,
  };
}
