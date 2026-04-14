import { api } from "./client.ts";
import type { WorldMap } from "../types/index.ts";

export const getMap = (): Promise<WorldMap> => api.get<WorldMap>("/map");
