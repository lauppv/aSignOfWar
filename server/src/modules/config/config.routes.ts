import { Router } from "express";
import env from "../../core/env";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ gameSpeed: env.gameSpeed });
});

export default router;
