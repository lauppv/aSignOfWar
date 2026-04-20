import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { startRecruitment, cancelRecruitment } from "../../services/recruitment.service";

export const recruitUnits = async (req: AuthRequest, res: Response) => {
  try {
    const cityId = req.params.cityId as string;
    const { unitName, quantity } = req.body;

    const result = await startRecruitment(cityId, unitName, quantity, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      return res.status(500).json({ error: "UNKNOWN_ERROR" });
    }

    if (err.message === "CITY_NOT_FOUND")           return res.status(404).json({ error: "CITY_NOT_FOUND" });
    if (err.message === "UNAUTHORIZED")              return res.status(403).json({ error: "UNAUTHORIZED" });
    if (err.message === "INVALID_QUANTITY")          return res.status(400).json({ error: "INVALID_QUANTITY" });
    if (err.message === "MILITARY_BASE_REQUIRED")    return res.status(400).json({ error: "MILITARY_BASE_REQUIRED" });
    if (err.message === "INSUFFICIENT_RESOURCES")    return res.status(400).json({ error: "INSUFFICIENT_RESOURCES" });
    if (err.message === "INSUFFICIENT_POPULATION")   return res.status(400).json({ error: "INSUFFICIENT_POPULATION" });

    if (err.message.startsWith("HQ_REQUIRED:")) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.startsWith("MB_REQUIRED:")) {
      return res.status(400).json({ error: err.message });
    }

    throw err;
  }
};

export const cancelRecruitmentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const result = await cancelRecruitment(orderId, req.userId!);
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
