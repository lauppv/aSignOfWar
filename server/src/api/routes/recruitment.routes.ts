import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { recruitUnits, cancelRecruitmentOrder } from "../controllers/recruitment.controller";

const router = Router();

router.post("/:cityId/recruit", authMiddleware, recruitUnits);
router.delete("/recruitment/orders/:orderId", authMiddleware, cancelRecruitmentOrder);

export default router;
