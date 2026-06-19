import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getRankingsHandler, getAllianceRankingsHandler } from "./ranking.controller";

const router = Router();

router.get("/", authMiddleware, getRankingsHandler);
router.get("/alliances", authMiddleware, getAllianceRankingsHandler);

export default router;
