import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getMap } from "./map.controller";

const router = Router();

router.get("/", authMiddleware, getMap);

export default router;
