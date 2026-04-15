import { api } from "./client.ts";

export type GovernorResource = "money" | "energy" | "ammo";

export interface GovernorPendingOrder {
  id:       string;
  cityId:   string;
  cityName: string;
  startAt:  string;
  finishAt: string;
}

export interface GovernorState {
  recruited:      number;
  nextNumber:     number;
  deposits:       { money: number; energy: number; ammo: number };
  nextCost:       { money: number; energy: number; ammo: number };
  barsReady:      boolean;
  recruitTimeSec: number;
  pendingOrders:  GovernorPendingOrder[];
}

export interface GovernorDepositResult {
  deposited: number;
  state:     GovernorState;
}

export interface GovernorRecruitResult {
  orderId:  string;
  startAt:  string;
  finishAt: string;
  state:    GovernorState;
}

export function getGovernorState() {
  return api.get<GovernorState>("/governor");
}

export function depositGovernor(cityId: string, resource: GovernorResource, amount: number) {
  return api.post<GovernorDepositResult>("/governor/deposit", { cityId, resource, amount });
}

export function recruitGovernor(cityId: string) {
  return api.post<GovernorRecruitResult>("/governor/recruit", { cityId });
}
