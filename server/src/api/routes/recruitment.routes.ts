import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { recruitUnits } from "../controllers/recruitment.controller";
import { getMyCity } from "../controllers/city.controller";

const router = Router();

router.get("/mine", authMiddleware, getMyCity);
router.post("/:cityId/recruit", authMiddleware, recruitUnits);

export default router;
