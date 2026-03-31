import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import prisma from "../config/db";

export const registerBuildingWorker = () => {
  new Worker<{ buildingId: string }>(
    "building-upgrade",
    async (job) => {
      await prisma.building.update({
        where: { id: job.data.buildingId },
        data: {
          level:             { increment: 1 },
          upgradeFinishesAt: null,
          upgradeJobId:      null,
        },
      }).catch((err) => {
        console.error(`[building-worker] Job ${job.id} esuat pentru buildingId ${job.data.buildingId}:`, err);
        throw err;
      });
    },
    { connection: createRedisConnection() }
  );
};
