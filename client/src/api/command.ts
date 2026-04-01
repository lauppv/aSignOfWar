import { api } from "./client.ts";
import type { CityCommands } from "../types/index.ts";

export const getCityCommands = (cityId: string): Promise<CityCommands> =>
  api.get<CityCommands>(`/cities/${cityId}/commands`);
