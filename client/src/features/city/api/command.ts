import { api } from "@/shared/api/client";
import type { CityCommands, UnitName } from "@/shared/types";

export type CommandType = "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";

export interface SendCommandBody {
  type: CommandType;
  targetCityId: string;
  units?: Partial<Record<UnitName, number>>;
  resources?: { money: number; energy: number; ammo: number };
  targetBuilding?: string;
}

export interface SendCommandResult {
  commandId: string;
  arrivalAt: string;
}

export const getCityCommands = (cityId: string): Promise<CityCommands> =>
  api.get<CityCommands>(`/cities/${cityId}/commands`);

export const sendCommand = (
  fromCityId: string,
  body: SendCommandBody
): Promise<SendCommandResult> =>
  api.post<SendCommandResult>(`/cities/${fromCityId}/commands`, body);

export const cancelCommand = (
  fromCityId: string,
  commandId: string
): Promise<{ commandId: string; arrivalAt: string }> =>
  api.post(`/cities/${fromCityId}/commands/${commandId}/cancel`, {});

export const withdrawStationedSupport = (
  fromCityId: string,
  body: {
    targetCityId: string;
    mode: "all" | "partial";
    units?: Partial<Record<UnitName, number>>;
  }
): Promise<{ withdrawnCommandIds: string[]; arrivalAt?: string }> =>
  api.post(`/cities/${fromCityId}/commands/withdraw`, body);
