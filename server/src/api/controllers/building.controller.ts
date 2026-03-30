import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { startUpgrade } from "../../services/building.service";

export const upgradeBuilding = async (req: AuthRequest, res: Response) => {
  try {
    const buildingId = req.params.buildingId as string;
    const result = await startUpgrade(buildingId, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    const mesaj = err instanceof Error ? err.message : "Eroare necunoscuta";
    return res.status(400).json({ mesaj });
  }
};
