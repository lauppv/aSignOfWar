import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getRankingsHandler } from "../controllers/ranking.controller";

const router = Router();

router.get("/", authMiddleware, getRankingsHandler);

export default router;
