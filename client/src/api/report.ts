import { api } from "./client.ts";
import type { BattleReport } from "../types/index.ts";

export const getReports = (): Promise<BattleReport[]> => api.get<BattleReport[]>("/reports");

export const deleteReport = (id: string): Promise<void> =>
  api.delete<void>(`/reports/${id}`);

export const deleteAllReports = (): Promise<void> =>
  api.delete<void>("/reports");

export interface ShareOptions {
  hideOwnTroops: boolean;
  hideOwnInitial: boolean;
  hideEnemyTroops: boolean;
}

export const shareReport = (commandId: string, opts: ShareOptions): Promise<{ id: string }> =>
  api.post<{ id: string }>(`/reports/${commandId}/share`, opts);

export const getSharedReport = (id: string): Promise<BattleReport & { sharedBy: { id: string; username: string } }> =>
  api.get(`/reports/shared/${id}`);
