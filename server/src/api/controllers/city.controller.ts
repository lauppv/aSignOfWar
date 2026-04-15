import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getCityOverview, renameMyCity } from "../../services/city.service";
import { renameCitySchema } from "../schemas";

export const getMyCity = async (req: AuthRequest, res: Response) => {
  try {
    const cityId = typeof req.query.cityId === "string" ? req.query.cityId : undefined;
    const city = await getCityOverview(req.userId!, cityId);
    return res.json(city);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CITY_NOT_FOUND") {
      return res.status(404).json({ mesaj: "Nu ai niciun oras" });
    }
    throw err;
  }
};

export const renameCity = async (req: AuthRequest, res: Response) => {
  const parsed = renameCitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ mesaj: "Invalid name" });
  }
  try {
    const cityId = typeof req.body.cityId === "string" ? req.body.cityId : undefined;
    const city = await renameMyCity(req.userId!, parsed.data.name, cityId);
    return res.json({ id: city.id, name: city.name });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CITY_NOT_FOUND") {
      return res.status(404).json({ mesaj: "Nu ai niciun oras" });
    }
    throw err;
  }
};
