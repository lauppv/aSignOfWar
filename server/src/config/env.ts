import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const required = ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD", "JWT_SECRET", "REDIS_URL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Lipseste variabila: ${key}`);
}

// Construiesc DATABASE_URL din componente separate ca sa fie clar in .env
// ce trebuie completat, fara sa parsezi un URL lung.
const dbHost = process.env.DATABASE_HOST!;
const dbPort = process.env.DATABASE_PORT || "5432";
const dbName = process.env.DATABASE_NAME!;
const dbUser = process.env.DATABASE_USER!;
const dbPassword = encodeURIComponent(process.env.DATABASE_PASSWORD!);
const connLimit = process.env.DATABASE_CONNECTION_LIMIT || "10";
const sslParam = process.env.NODE_ENV === "production" ? "&sslmode=require" : "";
process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?connection_limit=${connLimit}${sslParam}`;

const env = {
  port: process.env.PORT || "3000",
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  redisUrl: process.env.REDIS_URL!,
  nodeEnv: process.env.NODE_ENV || "development",
  gameSpeed: Number(process.env.GAME_SPEED) || 1,
};

export default env;
