import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getMyCity } from "../controllers/city.controller";

const router = Router();

router.get("/mine", authMiddleware, getMyCity);

export default router;
