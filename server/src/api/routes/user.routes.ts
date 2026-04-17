import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as ctrl from "../controllers/user.controller";

const router = Router();
router.use(authMiddleware);

router.patch("/me/description", ctrl.updateMyDescriptionHandler);
router.get("/:id/profile", ctrl.getPlayerProfileHandler);

export default router;
