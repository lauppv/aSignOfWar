import { api } from "./client.ts";
import type { BattleReport } from "../types/index.ts";

export const getReports = (): Promise<BattleReport[]> => api.get<BattleReport[]>("/reports");

export const deleteReport = (id: string): Promise<void> =>
  api.delete<void>(`/reports/${id}`);

export const deleteAllReports = (): Promise<void> =>
  api.delete<void>("/reports");
