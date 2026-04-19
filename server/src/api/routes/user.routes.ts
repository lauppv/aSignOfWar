import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middleware/auth";
import * as ctrl from "../controllers/user.controller";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const router = Router();
router.use(authMiddleware);

router.patch("/me/description", ctrl.updateMyDescriptionHandler);
router.post("/me/avatar", upload.single("avatar"), ctrl.uploadAvatarHandler);
router.get("/:id/profile", ctrl.getPlayerProfileHandler);

export default router;
