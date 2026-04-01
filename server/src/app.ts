import express, { Request, Response, NextFunction } from "express";
import env from "./config/env";
import authRoutes from "./api/routes/auth.routes";
import buildingRoutes from "./api/routes/building.routes";
import cityRoutes from "./api/routes/city.routes";
import recruitmentRoutes from "./api/routes/recruitment.routes";
import commandRoutes from "./api/routes/command.routes";
import { registerBuildingWorker } from "./workers/building.worker";
import { registerRecruitmentWorker } from "./workers/recruitment.worker";
import { registerResourceWorker } from "./workers/resource.worker";
import { registerCommandWorker } from "./workers/command.worker";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/cities", recruitmentRoutes);
app.use("/api/cities", commandRoutes);

// Middleware global de erori — prinde orice eroare neasteptata din controllere
// Fara el, Express ar return un HTML urat cu tot stack trace-ul vizibil
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ mesaj: "Eroare interna de server" });
});

registerBuildingWorker();
registerRecruitmentWorker();
registerResourceWorker();
registerCommandWorker();

app.listen(env.port, () => {
  console.log(`Server pornit pe http://localhost:${env.port}`);
});
