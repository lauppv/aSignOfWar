import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

export const buildingQueue = new Queue("building-upgrade", {
  connection: createRedisConnection(),
});

export const recruitmentQueue = new Queue("unit-recruitment", {
  connection: createRedisConnection(),
});

export const resourceQueue = new Queue("resource-tick", {
  connection: createRedisConnection(),
});

export const commandQueue = new Queue("command-travel", {
  connection: createRedisConnection(),
});
