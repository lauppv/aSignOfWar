import express, { Request, Response, NextFunction } from "express";
import env from "./config/env";
import authRoutes from "./api/routes/auth.routes";
import buildingRoutes from "./api/routes/building.routes";
import { registerBuildingWorker } from "./workers/building.worker";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);

// Middleware global de erori — prinde orice eroare neasteptata din controllere
// Fara el, Express ar return un HTML urat cu tot stack trace-ul vizibil
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ mesaj: "Eroare interna de server" });
});

registerBuildingWorker();

app.listen(env.port, () => {
  console.log(`Server pornit pe http://localhost:${env.port}`);
});
