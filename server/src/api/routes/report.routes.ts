import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getReports } from "../controllers/report.controller";

const router = Router();

router.get("/", authMiddleware, getReports);

export default router;
