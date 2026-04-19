import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getReports, deleteReport, deleteAllReports } from "../controllers/report.controller";
import { share, get as getShared } from "../controllers/sharedReport.controller";

const router = Router();

router.get("/",       authMiddleware, getReports);
router.delete("/",    authMiddleware, deleteAllReports);
router.delete("/:id", authMiddleware, deleteReport);

router.post("/:commandId/share", authMiddleware, share);
router.get("/shared/:id",        authMiddleware, getShared);

export default router;
