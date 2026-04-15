import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getCityOverview, renameMyCity } from "../../services/city.service";
import { renameCitySchema } from "../schemas";

export const getMyCity = async (req: AuthRequest, res: Response) => {
  try {
    const city = await getCityOverview(req.userId!);
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
    const city = await renameMyCity(req.userId!, parsed.data.name);
    return res.json({ id: city.id, name: city.name });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CITY_NOT_FOUND") {
      return res.status(404).json({ mesaj: "Nu ai niciun oras" });
    }
    throw err;
  }
};
