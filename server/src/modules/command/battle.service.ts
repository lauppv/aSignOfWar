// Simple re-export. The battle logic lives in shared/battleCalc.ts because
// both the server (real battles) and the client (simulator) use it.
// Keeping it in shared/ avoids duplication and guarantees the simulator produces the same results.
export { calculateBattle } from "../../../../shared/battleCalc";
export type { BattleUnit, BattleResult } from "../../../../shared/battleCalc";
