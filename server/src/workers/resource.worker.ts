import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { resourceQueue } from "../config/queue";
import prisma from "../config/db";
import { syncResources } from "../services/city.service";

export const registerResourceWorker = async () => {
  new Worker(
    "resource-tick",
    async () => {
      const cities = await prisma.city.findMany({ select: { id: true } });
      await Promise.all(cities.map(c => syncResources(c.id)));
    },
    { connection: createRedisConnection() }
  );

  // Porneste job-ul repeatable daca nu exista deja
  await resourceQueue.add("tick", {}, { repeat: { every: 5000 } });
};
