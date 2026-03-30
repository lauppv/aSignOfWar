import express from "express";
import env from "./config/env";
import authRoutes from "./api/routes/auth.routes";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);


app.listen(env.port, () => {
  console.log(`Server pornit pe http://localhost:${env.port}`);
});