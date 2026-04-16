import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getRankingsHandler, getAllianceRankingsHandler } from "../controllers/ranking.controller";

const router = Router();

router.get("/", authMiddleware, getRankingsHandler);
router.get("/alliances", authMiddleware, getAllianceRankingsHandler);

export default router;
