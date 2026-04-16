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
  alliance: { id: string; name: string; tag: string } | null;
}

export interface AllianceRankingEntry {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  points: number;
  pointsPerMember: number;
  cities: number;
  pointsPerCity: number;
  killsAsAttacker: number;
  killsAsDefender: number;
  killsAsSupporter: number;
  totalKills: number;
}

export function getRankings(): Promise<RankingEntry[]> {
  return api.get<RankingEntry[]>("/rankings");
}

export function getAllianceRankings(): Promise<AllianceRankingEntry[]> {
  return api.get<AllianceRankingEntry[]>("/rankings/alliances");
}
