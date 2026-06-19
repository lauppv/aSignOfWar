import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getGovernor, deposit, recruit } from "./governor.controller";

const router = Router();

router.get("/",         authMiddleware, getGovernor);
router.post("/deposit", authMiddleware, deposit);
router.post("/recruit", authMiddleware, recruit);

export default router;
