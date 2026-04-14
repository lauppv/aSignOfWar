import { api } from "./client.ts";
import type { CityCommands, UnitName } from "../types/index.ts";

export type CommandType = "ATTACK" | "SUPPORT" | "RESOURCES";

export interface SendCommandBody {
  type: CommandType;
  targetCityId: string;
  units?: Partial<Record<UnitName, number>>;
  resources?: { money: number; energy: number; ammo: number };
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
