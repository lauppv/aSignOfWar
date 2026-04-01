import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { sendCommandHandler, getCommandsHandler } from "../controllers/command.controller";

const router = Router();

// POST /api/cities/:cityId/commands  — trimite o comanda (attack/support/resources)
router.post("/:cityId/commands", authMiddleware, sendCommandHandler);

// GET  /api/cities/:cityId/commands  — comenzile orasului (outgoing + incoming)
router.get("/:cityId/commands", authMiddleware, getCommandsHandler);

export default router;
