import { api } from "./client.ts";

export interface RankingEntry {
  id: string;
  username: string;
  cities: number;
  points: number;
  killsAsAttacker: number;
  killsAsDefender: number;
  killsAsSupporter: number;
  totalKills: number;
  lootedMoney: number;
  lootedEnergy: number;
  lootedAmmo: number;
  totalLooted: number;
}

export function getRankings(): Promise<RankingEntry[]> {
  return api.get<RankingEntry[]>("/rankings");
}
