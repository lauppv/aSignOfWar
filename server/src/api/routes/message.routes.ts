import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as ctrl from "../controllers/message.controller";

const router = Router();
router.use(authMiddleware);

router.get("/direct/unread",         ctrl.unreadDirectHandler);
router.get("/direct/conversations",  ctrl.listConversationsHandler);
router.get("/direct/:peerId",        ctrl.listThreadHandler);
router.post("/direct",               ctrl.sendDirectHandler);
router.delete("/direct/:id",         ctrl.deleteDirectHandler);

export default router;
