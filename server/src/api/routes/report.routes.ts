import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getReports, deleteReport, deleteAllReports } from "../controllers/report.controller";

const router = Router();

router.get("/",       authMiddleware, getReports);
router.delete("/",    authMiddleware, deleteAllReports);
router.delete("/:id", authMiddleware, deleteReport);

export default router;
