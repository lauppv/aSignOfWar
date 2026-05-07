import { api } from "./client";

export type SiegeStatus = {
  active: boolean;
  endsAt: string | null;
  attacker: { userId: string; username: string } | null;
  defender: { userId: string; username: string } | null;
  defendingForce: { name: string; quantity: number }[];
  incomingCommands: {
    id: string;
    type: "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";
    fromCityName: string;
    fromOwnerName: string | null;
    arrivalAt: string;
    units: { name: string; quantity: number }[];
  }[];
};

export const getSiegeStatus = (cityId: string) =>
  api.get<SiegeStatus>(`/cities/${cityId}/siege-status`);

export type SharedSiege = {
  shareId: string;
  sharedBy: { id: string; username: string };
  sharedAt: string;
  siege: {
    id: string;
    status: "ACTIVE" | "BROKEN_BY_DEFENSE" | "BROKEN_BY_NEW_SIEGE" | "COMPLETED_CONQUEST";
    startedAt: string;
    endsAt: string;
    attacker: { id: string; username: string };
    defender: { id: string; username: string } | null;
    city: { id: string; name: string; x: number; y: number };
  };
  // Live state — present only when status === ACTIVE; null otherwise (siege already ended).
  live: {
    defendingForce: { name: string; quantity: number }[];
    incomingCommands: {
      id: string;
      type: "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";
      fromCityName: string;
      fromOwnerName: string | null;
      arrivalAt: string;
      units: { name: string; quantity: number }[];
    }[];
  } | null;
};

export const shareSiege = (siegeId: string) =>
  api.post<{ id: string }>(`/sieges/${siegeId}/share`, {});

export const getSharedSiege = (id: string) =>
  api.get<SharedSiege>(`/sieges/shared/${id}`);
