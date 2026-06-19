import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { recruitUnits, cancelRecruitmentOrder } from "./recruitment.controller";
import { validate } from "../../middleware/validate";
import { recruitSchema } from "./recruitment.schema";

const router = Router();

router.post("/:cityId/recruit", authMiddleware, validate(recruitSchema), recruitUnits);
router.delete("/recruitment/orders/:orderId", authMiddleware, cancelRecruitmentOrder);

export default router;
