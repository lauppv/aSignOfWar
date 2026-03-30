import express, { Request, Response, NextFunction } from "express";
import env from "./config/env";
import boss from "./config/pgboss";
import authRoutes from "./api/routes/auth.routes";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);

// Middleware global de erori — prinde orice eroare neasteptata din controllere
// Fara el, Express ar return un HTML urat cu tot stack trace-ul vizibil
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ mesaj: "Eroare interna de server" });
});

boss.start()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Server pornit pe http://localhost:${env.port}`);
    });
  })
  .catch((err: unknown) => {
    console.error("pg-boss nu a putut porni:", err);
    process.exit(1);
  });
