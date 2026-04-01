import { api } from "./client.ts";
import type { CityOverview, UnitName } from "../types/index.ts";

export const getMyCity = (): Promise<CityOverview> =>
  api.get<CityOverview>("/cities/mine");

export const upgradeBuilding = (buildingId: string): Promise<void> =>
  api.post<void>(`/buildings/${buildingId}/upgrade`, {});

export const cancelBuildingOrder = (orderId: string): Promise<void> =>
  api.delete<void>(`/buildings/orders/${orderId}`);

export const recruitUnits = (
  cityId: string,
  unitName: UnitName,
  quantity: number
): Promise<void> =>
  api.post<void>(`/cities/${cityId}/recruit`, { unitName, quantity });

export const cancelRecruitmentOrder = (orderId: string): Promise<void> =>
  api.delete<void>(`/recruitment/orders/${orderId}`);
