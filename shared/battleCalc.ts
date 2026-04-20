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
  // Sistemul de lupta inspirat din Tribal Wars. Decizii de design:
  //   1. Atacul e split pe categorii (INF/RANGE/MECH), apararea e ponderata dupa
  //      compozitia atacatorului — asta recompenseaza armatele echilibrate.
  //   2. Air defense damage e calculat PRE-batalie dar scalat cu battleRatio —
  //      atacatorii care pierd tot dau ceva damage de siege, nu e all-or-nothing.
  //   3. Hackerii au mini-batalie proprie (spy vs spy) — sunt invizibili pentru
  //      unitatile normale. Asta creeaza un meta-game dedicat de spionaj.
  //   4. Prada se imparte egal pe 3 resurse (carry / 3) — previne cherry-picking.
  //   5. Governor loyalty damage: 20 + random(0-15). Randomness-ul previne calculul
  //      exact "am nevoie de N guvernatori", adaugand incertitudine strategica.

  // 0. Separăm hackerii — au mini-bătălie proprie
  const atkHackers = attackerUnits.find(u => UNITS[u.name].category === "SPY")?.quantity ?? 0;
  const defHackers = defenderUnits.find(u => UNITS[u.name].category === "SPY")?.quantity ?? 0;
  attackerUnits = attackerUnits.filter(u => UNITS[u.name].category !== "SPY");
  defenderUnits = defenderUnits.filter(u => UNITS[u.name].category !== "SPY");

  // 1. Forta de atac per categorie
  const A: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of attackerUnits) {
    A[toAtkCat(name)] += UNITS[name].attack * quantity;
  }
  const A_total = A.INFANTRY + A.RANGE + A.MECHANIZED;

  // 2. Aparare cu air defense ORIGINAL (pentru a calcula battleRatio)
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

  // 3. Battle ratio — scalează eficacitatea siege-ului (ca în TW)
  //    A/D (capped la 1): când câștigi siege-ul e la putere maximă,
  //    când pierzi e proporțional cu raportul de forțe
  const battleRatio = D_eff_orig > 0 ? Math.min(1, A_total / D_eff_orig) : (A_total > 0 ? 1 : 0);

  // 4. Air defense damage PRE-bătălie, scalat cu battleRatio
  const mlCount    = attackerUnits.find(u => u.name === "MISSILE_LAUNCHER")?.quantity ?? 0;
  const dronesForAD = (!targetBuilding || targetBuilding === "AIR_DEFENSE")
    ? (attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0)
    : 0;
  const effectiveML = Math.floor(mlCount * battleRatio);
  const effectiveDronesAD = Math.floor(dronesForAD * battleRatio);
  const airDefLevelsDestroyed = calcAirDefenseDamage(airDefenseLevel, effectiveML, effectiveDronesAD);
  const newAirDefenseLevel = airDefenseLevel - airDefLevelsDestroyed;

  // 5. Aparare cu air defense REDUS (pentru bătălia propriu-zisă)
  const defenseBonus = getAirDefenseBonus(newAirDefenseLevel) / 100;
  const D: Record<AtkCat, number> = { INFANTRY: 0, RANGE: 0, MECHANIZED: 0 };
  for (const { name, quantity } of defenderUnits) {
    const cfg  = UNITS[name];
    const mult = 1 + defenseBonus;
    D.INFANTRY   += cfg.defenseVsInfantry   * quantity * mult;
    D.RANGE      += cfg.defenseVsRange      * quantity * mult;
    D.MECHANIZED += cfg.defenseVsMechanized * quantity * mult;
  }

  // 6. Forta totala de aparare ponderata
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
    battleRatio,
  };
}
