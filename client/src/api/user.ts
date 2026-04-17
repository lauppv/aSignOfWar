import { api } from "./client.ts";

export interface PlayerProfileCity {
  id: string;
  name: string;
  x: number;
  y: number;
  points: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  description: string | null;
  alliance: { id: string; name: string; tag: string } | null;
  cities: PlayerProfileCity[];
  totalCities: number;
  totalPoints: number;
  rank: number;
  totalPlayers: number;
  createdAt: string;
}

export function getPlayerProfile(userId: string): Promise<PlayerProfile> {
  return api.get(`/users/${encodeURIComponent(userId)}/profile`);
}

export function updateMyDescription(description: string | null): Promise<void> {
  return api.patch("/users/me/description", { description });
}
