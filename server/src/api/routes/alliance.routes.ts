import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as ctrl from "../controllers/alliance.controller";

const router = Router();

router.use(authMiddleware);

// Self-scoped (must come before /:id)
router.get("/", ctrl.listAlliancesHandler);
router.post("/", ctrl.createAllianceHandler);
router.patch("/", ctrl.updateAllianceHandler);

router.get("/me", ctrl.getMyAllianceHandler);
router.get("/me/invitations", ctrl.listMyInvitationsHandler);
router.get("/me/application", ctrl.listMyApplicationHandler);
router.post("/me/application/cancel", ctrl.cancelMyApplicationHandler);

router.post("/leave", ctrl.leaveAllianceHandler);
router.post("/disband", ctrl.disbandAllianceHandler);

router.post("/invite", ctrl.inviteByUsernameHandler);
router.get("/invitations", ctrl.listAllianceInvitationsHandler);
router.delete("/invitations/:invitationId", ctrl.cancelInvitationHandler);
router.post("/invitations/:invitationId/accept", ctrl.acceptInvitationHandler);
router.post("/invitations/:invitationId/reject", ctrl.rejectInvitationHandler);

router.get("/applications", ctrl.listAllianceApplicationsHandler);
router.post("/applications/:applicationId/accept", ctrl.acceptApplicationHandler);
router.post("/applications/:applicationId/reject", ctrl.rejectApplicationHandler);

router.post("/members/:memberId/kick", ctrl.kickMemberHandler);
router.post("/members/:memberId/transfer", ctrl.transferLeadershipHandler);

router.get("/messages/unread", ctrl.unreadMessagesHandler);
router.get("/messages", ctrl.listMessagesHandler);
router.post("/messages", ctrl.postMessageHandler);
router.delete("/messages/:messageId", ctrl.deleteMessageHandler);

// Dynamic — keep last
router.get("/:id/profile", ctrl.getAllianceProfileHandler);
router.get("/:id", ctrl.getAllianceHandler);
router.post("/:id/join", ctrl.joinAllianceHandler);
router.post("/:id/apply", ctrl.submitApplicationHandler);

export default router;
