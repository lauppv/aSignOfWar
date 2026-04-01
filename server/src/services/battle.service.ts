// Logica pura de calcul al bataliei — fara acces la baza de date
// Formula confirmata din teste Tribal Wars (luck=0, air defense=0):
//   pierderi_castigator = (forta_perdant / forta_castigator) ^ 1.5
// Atacatorii pierd per categorie (INFANTRY/RANGE/MECHANIZED).
// Aparatorii pierd uniform, calculat prin compararea fortei totale de atac
// cu apararea medie ponderata dupa compozitia armatei atacatoare.

import { UnitName } from "@prisma/client";
import { UNITS, getAirDefenseBonus, calcAirDefenseDamage } from "../config/game.config";

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

// Categorii de atac: SIEGE si CONQUER sunt tratate ca INFANTRY
// (GOVERNOR are attack=0, deci nu contribuie la forta)
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
  defenderAmmo: number
): BattleResult {
  // 1. Damage zid (inainte de lupta)
  const mlCount    = attackerUnits.find(u => u.name === "MISSILE_LAUNCHER")?.quantity ?? 0;
  const droneCount = attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0;
  const levelsDestroyed    = calcAirDefenseDamage(airDefenseLevel, mlCount, droneCount);
  const newAirDefenseLevel = airDefenseLevel - levelsDestroyed;
  const defenseBonus       = getAirDefenseBonus(newAirDefenseLevel) / 100;

  // 2. Forta de atac per categorie
  const A: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of attackerUnits) {
    A[toAtkCat(name)] += UNITS[name].attack * quantity;
  }

  // 3. Aparare per categorie de atac (cu bonus Air Defense)
  const D: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of defenderUnits) {
    const cfg  = UNITS[name];
    const mult = 1 + defenseBonus;
    D.INFANTRY   += cfg.defenseVsInfantry   * quantity * mult;
    D.RANGE      += cfg.defenseVsRange      * quantity * mult;
    D.MECHANIZED += cfg.defenseVsMechanized * quantity * mult;
  }

  // 4. Rata de pierderi a atacatorilor per categorie
  const atkLoss: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const cat of ["INFANTRY", "RANGE", "MECHANIZED"] as AtkCat[]) {
    if (A[cat] === 0) continue;
    atkLoss[cat] = A[cat] >= D[cat]
      ? Math.pow(D[cat] / A[cat], 1.5)
      : 1.0;
  }

  // 5. Castigatorul global: compara forta totala de atac cu apararea ponderata
  const A_total = A.INFANTRY + A.RANGE + A.MECHANIZED;
  let D_eff = 0;
  if (A_total > 0) {
    D_eff = (A.INFANTRY   / A_total) * D.INFANTRY
          + (A.RANGE      / A_total) * D.RANGE
          + (A.MECHANIZED / A_total) * D.MECHANIZED;
  }
  // >= gestioneaza cazul 0 atacatori vs 0 aparatori (Governor vs oras gol)
  const attackerWon = A_total >= D_eff;

  // 6. Aplica pierderi atacatori
  const attackerSurvivors: BattleUnit[] = attackerUnits.map(({ name, quantity }) => {
    if (!attackerWon) return { name, quantity: 0 };
    return {
      name,
      quantity: Math.round(quantity * (1 - atkLoss[toAtkCat(name)])),
    };
  });

  // 7. Aplica pierderi aparatori
  let defLossRate: number;
  if (attackerWon) {
    defLossRate = 1.0;
  } else {
    defLossRate = A_total > 0 ? Math.pow(A_total / D_eff, 1.5) : 0;
  }
  const defenderSurvivors: BattleUnit[] = defenderUnits.map(({ name, quantity }) => ({
    name,
    quantity: Math.round(quantity * (1 - defLossRate)),
  }));

  // 8. Resurse furate (daca atacatorul castiga)
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

  // 9. Efect Governor (reduce loyalty)
  const govSurvivors = attackerSurvivors.find(u => u.name === "GOVERNOR")?.quantity ?? 0;
  const allDefDead   = defenderSurvivors.every(u => u.quantity === 0);
  let loyaltyDamage  = 0;
  if (attackerWon && allDefDead && govSurvivors > 0) {
    // 20-35% per Governor (fara luck, dar range conform plan.txt)
    for (let i = 0; i < govSurvivors; i++) {
      loyaltyDamage += 20 + Math.floor(Math.random() * 16);
    }
  }

  return {
    attackerWon,
    attackerSurvivors,
    defenderSurvivors,
    newAirDefenseLevel,
    airDefenseLevelsDestroyed: levelsDestroyed,
    stolenMoney,
    stolenEnergy,
    stolenAmmo,
    loyaltyDamage,
  };
}
