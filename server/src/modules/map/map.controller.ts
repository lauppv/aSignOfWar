import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAllCitiesOnMap, MAP_SIZE } from "./map.service";

export const getMap = async (_req: AuthRequest, res: Response) => {
  const cities = await getAllCitiesOnMap();
  return res.json({ size: MAP_SIZE, cities });
};
