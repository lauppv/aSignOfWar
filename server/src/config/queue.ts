import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

export const buildingQueue = new Queue("building-upgrade", {
  connection: createRedisConnection(),
});
