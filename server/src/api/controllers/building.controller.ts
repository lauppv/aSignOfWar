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
      return res.status(500).json({ error: "UNKNOWN_ERROR" });
    }

    if (err.message === "BUILDING_NOT_FOUND") {
      return res.status(404).json({ error: "BUILDING_NOT_FOUND" });
    }
    if (err.message === "UNAUTHORIZED") {
      return res.status(403).json({ error: "UNAUTHORIZED" });
    }
    if (err.message === "UPGRADE_IN_PROGRESS") {
      return res.status(409).json({ error: "UPGRADE_IN_PROGRESS" });
    }
    if (err.message === "MAX_LEVEL_REACHED") {
      return res.status(400).json({ error: "MAX_LEVEL_REACHED" });
    }
    if (err.message === "INSUFFICIENT_RESOURCES") {
      return res.status(400).json({ error: "INSUFFICIENT_RESOURCES" });
    }
    if (err.message.startsWith("HQ_REQUIRED:")) {
      return res.status(400).json({ error: err.message });
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
      return res.status(500).json({ error: "UNKNOWN_ERROR" });
    }
    if (err.message === "ORDER_NOT_FOUND") return res.status(404).json({ error: "ORDER_NOT_FOUND" });
    if (err.message === "UNAUTHORIZED")    return res.status(403).json({ error: "UNAUTHORIZED" });
    throw err;
  }
};
