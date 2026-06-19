import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getSiegeStatusForCity, createSharedSiege, getSharedSiege } from "./siege.service";

export const getSiegeStatus = async (req: AuthRequest, res: Response) => {
  const cityId = typeof req.params.cityId === "string" ? req.params.cityId : "";
  if (!cityId) return res.status(400).json({ error: "MISSING_CITY_ID" });
  try {
    const data = await getSiegeStatusForCity(cityId, req.userId!);
    return res.json(data);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "CITY_NOT_FOUND")  return res.status(404).json({ error: "CITY_NOT_FOUND" });
      if (err.message === "UNAUTHORIZED")    return res.status(403).json({ error: "UNAUTHORIZED" });
    }
    throw err;
  }
};

export const shareSiege = async (req: AuthRequest, res: Response) => {
  const siegeId = typeof req.params.siegeId === "string" ? req.params.siegeId : "";
  if (!siegeId) return res.status(400).json({ error: "MISSING_SIEGE_ID" });
  try {
    const id = await createSharedSiege(siegeId, req.userId!);
    return res.json({ id });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "SIEGE_NOT_FOUND") return res.status(404).json({ error: "SIEGE_NOT_FOUND" });
      if (err.message === "UNAUTHORIZED")    return res.status(403).json({ error: "UNAUTHORIZED" });
    }
    throw err;
  }
};

export const getSharedSiegeView = async (req: AuthRequest, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!id) return res.status(400).json({ error: "MISSING_ID" });
  try {
    const data = await getSharedSiege(id);
    return res.json(data);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "SHARED_SIEGE_NOT_FOUND") {
      return res.status(404).json({ error: "SHARED_SIEGE_NOT_FOUND" });
    }
    throw err;
  }
};
