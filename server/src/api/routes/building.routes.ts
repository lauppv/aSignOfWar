import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { upgradeBuilding, cancelBuildingOrder } from "../controllers/building.controller";

const router = Router();

router.post("/:buildingId/upgrade", authMiddleware, upgradeBuilding);
router.delete("/orders/:orderId", authMiddleware, cancelBuildingOrder);

export default router;
