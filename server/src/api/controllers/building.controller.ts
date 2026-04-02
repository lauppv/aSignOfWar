import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { startUpgrade, cancelUpgrade } from "../../services/building.service";

export const upgradeBuilding = async (req: AuthRequest, res: Response) => {
  try {
    const buildingId = req.params.buildingId as string;
    const result = await startUpgrade(buildingId, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      return res.status(500).json({ mesaj: "Eroare necunoscuta" });
    }

    if (err.message === "BUILDING_NOT_FOUND") {
      return res.status(404).json({ mesaj: "Cladirea nu exista" });
    }
    if (err.message === "UNAUTHORIZED") {
      return res.status(403).json({ mesaj: "Nu ai acces la aceasta cladire" });
    }
    if (err.message === "UPGRADE_IN_PROGRESS") {
      return res.status(409).json({ mesaj: "Upgrade deja in curs" });
    }
    if (err.message === "MAX_LEVEL_REACHED") {
      return res.status(400).json({ mesaj: "Nivel maxim atins" });
    }
    if (err.message === "INSUFFICIENT_RESOURCES") {
      return res.status(400).json({ mesaj: "Resurse insuficiente" });
    }
    if (err.message.startsWith("HQ_REQUIRED:")) {
      const level = err.message.split(":")[1];
      return res.status(400).json({ mesaj: `Necesita Headquarters nivel ${level}` });
    }

    throw err;
  }
};

export const cancelBuildingOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const result = await cancelUpgrade(orderId, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      return res.status(500).json({ mesaj: "Eroare necunoscuta" });
    }
    if (err.message === "ORDER_NOT_FOUND") return res.status(404).json({ mesaj: "Comanda nu exista" });
    if (err.message === "UNAUTHORIZED")    return res.status(403).json({ mesaj: "Nu ai acces" });
    throw err;
  }
};
