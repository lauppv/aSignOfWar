import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { upgradeBuilding } from "../controllers/building.controller";

const router = Router();

router.post("/:buildingId/upgrade", authMiddleware, upgradeBuilding);

export default router;
