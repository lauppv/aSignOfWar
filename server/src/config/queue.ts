import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

export const buildingQueue = new Queue("building-upgrade", {
  connection: createRedisConnection(),
});

export const recruitmentQueue = new Queue("unit-recruitment", {
  connection: createRedisConnection(),
});

export const commandQueue = new Queue("command-travel", {
  connection: createRedisConnection(),
});

export const siegeQueue = new Queue("siege-timer", {
  connection: createRedisConnection(),
});
