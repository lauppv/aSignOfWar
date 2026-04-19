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
  // 0. Separăm hackerii — au mini-bătălie proprie
  const atkHackers = attackerUnits.find(u => UNITS[u.name].category === "SPY")?.quantity ?? 0;
  const defHackers = defenderUnits.find(u => UNITS[u.name].category === "SPY")?.quantity ?? 0;
  attackerUnits = attackerUnits.filter(u => UNITS[u.name].category !== "SPY");
  defenderUnits = defenderUnits.filter(u => UNITS[u.name].category !== "SPY");

  // 1. Air defense damage PRE-bătălie (cu unitățile INIȚIALE, ca în TW)
  //    Dronele contribuie doar dacă vizează AIR_DEFENSE sau nu au target
  const mlCount    = attackerUnits.find(u => u.name === "MISSILE_LAUNCHER")?.quantity ?? 0;
  const dronesForAD = (!targetBuilding || targetBuilding === "AIR_DEFENSE")
    ? (attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0)
    : 0;
  const airDefLevelsDestroyed = calcAirDefenseDamage(airDefenseLevel, mlCount, dronesForAD);
  const newAirDefenseLevel = airDefenseLevel - airDefLevelsDestroyed;
  const defenseBonus = getAirDefenseBonus(newAirDefenseLevel) / 100;

  // 2. Forta de atac per categorie
  const A: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of attackerUnits) {
    A[toAtkCat(name)] += UNITS[name].attack * quantity;
  }

  // 3. Aparare per categorie de atac (cu bonus Air Defense redus)
  const D: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of defenderUnits) {
    const cfg  = UNITS[name];
    const mult = 1 + defenseBonus;
    D.INFANTRY   += cfg.defenseVsInfantry   * quantity * mult;
    D.RANGE      += cfg.defenseVsRange      * quantity * mult;
    D.MECHANIZED += cfg.defenseVsMechanized * quantity * mult;
  }

  // 4. Forta totala de atac si aparare ponderata
  const A_total = A.INFANTRY + A.RANGE + A.MECHANIZED;
  let D_eff = 0;
  if (A_total > 0) {
    D_eff = (A.INFANTRY   / A_total) * D.INFANTRY
          + (A.RANGE      / A_total) * D.RANGE
          + (A.MECHANIZED / A_total) * D.MECHANIZED;
  }
  const attackerWon = A_total >= D_eff;

  // 5. Pierderi atacator per categorie
  const atkLoss: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  if (attackerWon && A_total > 0) {
    for (const cat of ["INFANTRY", "RANGE", "MECHANIZED"] as AtkCat[]) {
      if (A[cat] === 0) continue;
      atkLoss[cat] = Math.pow(D[cat] / A_total, 1.5);
    }
  }

  const attackerSurvivors: BattleUnit[] = attackerUnits.map(({ name, quantity }) => {
    if (!attackerWon) return { name, quantity: 0 };
    return {
      name,
      quantity: Math.round(quantity * (1 - atkLoss[toAtkCat(name)])),
    };
  });

  // 6. Pierderi aparator
  const defLossRate = attackerWon
    ? 1.0
    : (A_total > 0 ? Math.pow(A_total / D_eff, 1.5) : 0);

  const defenderSurvivors: BattleUnit[] = defenderUnits.map(({ name, quantity }) => ({
    name,
    quantity: Math.round(quantity * (1 - defLossRate)),
  }));

  // 7. Mini-bătălie hackeri
  if (atkHackers > 0) {
    const hackerLossRate = defHackers > 0
      ? Math.min(1, Math.pow(defHackers / atkHackers, 1.5))
      : 0;
    attackerSurvivors.push({
      name: "HACKER" as UnitName,
      quantity: Math.round(atkHackers * (1 - hackerLossRate)),
    });
  }
  if (defHackers > 0) {
    const hackerLossRate = atkHackers > 0
      ? Math.min(1, Math.pow(atkHackers / defHackers, 1.5))
      : 0;
    defenderSurvivors.push({
      name: "HACKER" as UnitName,
      quantity: Math.round(defHackers * (1 - hackerLossRate)),
    });
  }

  // 8. Resurse furate
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

  // 9. Efect Governor
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
  };
}
