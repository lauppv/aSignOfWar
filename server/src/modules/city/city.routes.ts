import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getMyCity, renameCity } from "./city.controller";

const router = Router();

router.get("/mine", authMiddleware, getMyCity);
router.patch("/mine/name", authMiddleware, renameCity);

export default router;
