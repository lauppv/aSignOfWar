import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { getSiegeStatus, shareSiege, getSharedSiegeView } from "../controllers/siege.controller";

// Mounted at /api/cities (siege-status, scoped per-city) AND /api/sieges (siege-level
// share endpoints). Two routers below; the cities one is mounted in app.ts as before.
export const cityScopedRouter = Router();
cityScopedRouter.get("/:cityId/siege-status", authMiddleware, getSiegeStatus);

export const siegeRouter = Router();
siegeRouter.post("/:siegeId/share",   authMiddleware, shareSiege);
siegeRouter.get("/shared/:id",        authMiddleware, getSharedSiegeView);

// Default export keeps backwards compat with the existing app.ts mount on /api/cities.
export default cityScopedRouter;
