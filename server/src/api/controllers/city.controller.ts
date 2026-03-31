import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getCityOverview } from "../../services/city.service";

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
