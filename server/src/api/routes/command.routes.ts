import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { sendCommandHandler, getCommandsHandler, cancelCommandHandler, withdrawSupportHandler } from "../controllers/command.controller";
import { validate } from "../../middleware/validate";
import { sendCommandSchema } from "../schemas";

const router = Router();

// POST /api/cities/:cityId/commands  — trimite o comanda (attack/support/resources)
router.post("/:cityId/commands", authMiddleware, validate(sendCommandSchema), sendCommandHandler);

// GET  /api/cities/:cityId/commands  — comenzile orasului (outgoing + incoming)
router.get("/:cityId/commands", authMiddleware, getCommandsHandler);

// POST /api/cities/:cityId/commands/:commandId/cancel  — anuleaza o comanda TRAVELING
router.post("/:cityId/commands/:commandId/cancel", authMiddleware, cancelCommandHandler);

// POST /api/cities/:cityId/commands/withdraw — retrage unitati SUPPORT stationate
router.post("/:cityId/commands/withdraw", authMiddleware, withdrawSupportHandler);

export default router;
