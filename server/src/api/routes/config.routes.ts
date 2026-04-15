import { Router } from "express";
import env from "../../config/env";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ gameSpeed: env.gameSpeed });
});

export default router;
