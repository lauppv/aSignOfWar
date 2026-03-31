import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const env = {
  port: process.env.PORT || "3000",
  databaseUrl: process.env.DATABASE_URL!,
  database_password: process.env.DATABASE_PASSWORD!,
  jwtSecret: process.env.JWT_SECRET!,
  redisUrl: process.env.REDIS_URL!,
  nodeEnv: process.env.NODE_ENV || "development",
  gameSpeed: Number(process.env.GAME_SPEED) || 1,
};

const required = ["DATABASE_URL", "JWT_SECRET", "DATABASE_PASSWORD", "REDIS_URL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Lipseste variabila: ${key}`);
}

export default env;