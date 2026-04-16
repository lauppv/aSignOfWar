import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import env from "./config/env";
import authRoutes from "./api/routes/auth.routes";
import buildingRoutes from "./api/routes/building.routes";
import cityRoutes from "./api/routes/city.routes";
import recruitmentRoutes from "./api/routes/recruitment.routes";
import commandRoutes from "./api/routes/command.routes";
import mapRoutes from "./api/routes/map.routes";
import reportRoutes from "./api/routes/report.routes";
import configRoutes from "./api/routes/config.routes";
import governorRoutes from "./api/routes/governor.routes";
import rankingRoutes from "./api/routes/ranking.routes";
import { registerBuildingWorker } from "./workers/building.worker";
import { registerRecruitmentWorker } from "./workers/recruitment.worker";
import { registerCommandWorker } from "./workers/command.worker";
import { startGhostTicker } from "./services/ghost.service";

const app = express();

app.use(cors({
  origin: env.nodeEnv === "production"
    ? process.env.CLIENT_URL        // in productie, seteaza CLIENT_URL in .env
    : "http://localhost:5173",       // in development, clientul Vite
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/cities", recruitmentRoutes);
app.use("/api/cities", commandRoutes);
app.use("/api/map", mapRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/config", configRoutes);
app.use("/api/governor", governorRoutes);
app.use("/api/rankings", rankingRoutes);

// Middleware global de erori — prinde orice eroare neasteptata din controllere
// Fara el, Express ar return un HTML urat cu tot stack trace-ul vizibil
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ mesaj: "Eroare interna de server" });
});

registerBuildingWorker();
registerRecruitmentWorker();
registerCommandWorker();
startGhostTicker();

app.listen(env.port, () => {
  console.log(`Server pornit pe http://localhost:${env.port}`);
});
