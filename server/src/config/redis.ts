import { Redis } from "ioredis";
import env from "./env";

export const createRedisConnection = () =>
  new Redis(env.redisUrl, { maxRetriesPerRequest: null });
