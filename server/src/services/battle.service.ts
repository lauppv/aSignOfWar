// Re-export simplu. Logica de batalie e in shared/battleCalc.ts pentru ca
// atat serverul (batalii reale) cat si clientul (simulator) o folosesc.
// Tinand-o in shared/ evit duplicarea si garantez ca simulatorul da aceleasi rezultate.
export { calculateBattle } from "../../../shared/battleCalc";
export type { BattleUnit, BattleResult } from "../../../shared/battleCalc";
