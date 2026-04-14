import { api } from "./client.ts";
import type { BattleReport } from "../types/index.ts";

export const getReports = (): Promise<BattleReport[]> => api.get<BattleReport[]>("/reports");
