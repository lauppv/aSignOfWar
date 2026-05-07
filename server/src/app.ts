import path from "path";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import env from "./config/env";
import authRoutes from "./api/routes/auth.routes";
import buildingRoutes from "./api/routes/building.routes";
import cityRoutes from "./api/routes/city.routes";
import recruitmentRoutes from "./api/routes/recruitment.routes";
import commandRoutes from "./api/routes/command.routes";
import siegeRoutes, { siegeRouter } from "./api/routes/siege.routes";
import mapRoutes from "./api/routes/map.routes";
import reportRoutes from "./api/routes/report.routes";
import configRoutes from "./api/routes/config.routes";
import governorRoutes from "./api/routes/governor.routes";
import rankingRoutes from "./api/routes/ranking.routes";
import allianceRoutes from "./api/routes/alliance.routes";
import messageRoutes from "./api/routes/message.routes";
import userRoutes from "./api/routes/user.routes";
import { registerBuildingWorker } from "./workers/building.worker";
import { registerRecruitmentWorker } from "./workers/recruitment.worker";
import { registerCommandWorker } from "./workers/command.worker";
import { registerSiegeWorker } from "./workers/siege.worker";
import { startGhostTicker } from "./services/ghost.service";

// Entry point Express. Arhitectura:
//   Controllers -> Services -> Prisma (DB) + BullMQ (cozi)
//   Workers proceseaza job-uri async (upgrade cladiri, recrutare, sosire comenzi)
//   Shared config (gameConfig.ts) e sursa unica de adevar pentru balansul jocului
//
// De ce nu NestJS? YAGNI — Express + layering manual e mai usor pentru un proiect
// portofoliu cu ~12 endpoint-uri. Decoratorii NestJS adauga ceremonie fara beneficiu
// la scala asta. Daca as scala la 50+ endpoint-uri, as migra.

const app = express();

app.use(cors({
  origin: env.nodeEnv === "production"
    ? process.env.CLIENT_URL
    : true,                          // in development, permite orice origin (ngrok, localhost)
  credentials: true,
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));

app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/cities", recruitmentRoutes);
app.use("/api/cities", commandRoutes);
app.use("/api/cities", siegeRoutes);
app.use("/api/sieges", siegeRouter);
app.use("/api/map", mapRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/config", configRoutes);
app.use("/api/governor", governorRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/alliances", allianceRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

app.get("/{*splat}", (_req, res, next) => {
  const index = path.join(clientDist, "index.html");
  res.sendFile(index, (err) => { if (err) next(); });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

registerBuildingWorker();
registerRecruitmentWorker();
registerCommandWorker();
registerSiegeWorker();
startGhostTicker();

app.listen(env.port, () => {
  console.log(`Server pornit pe http://localhost:${env.port}`);
});
