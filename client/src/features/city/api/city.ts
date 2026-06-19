import { api } from "@/shared/api/client";
import type { CityOverview, UnitName } from "@/shared/types";

export const getMyCity = (cityId?: string): Promise<CityOverview> =>
  api.get<CityOverview>(cityId ? `/cities/mine?cityId=${encodeURIComponent(cityId)}` : "/cities/mine");

export const renameMyCity = (name: string, cityId?: string): Promise<{ id: string; name: string }> =>
  api.patch<{ id: string; name: string }>("/cities/mine/name", cityId ? { name, cityId } : { name });

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
  api.delete<void>(`/cities/recruitment/orders/${orderId}`);
