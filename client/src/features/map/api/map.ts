import { api } from "@/shared/api/client";
import type { WorldMap } from "@/shared/types";

export const getMap = (): Promise<WorldMap> => api.get<WorldMap>("/map");
