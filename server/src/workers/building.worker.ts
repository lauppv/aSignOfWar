import { Worker } from "bullmq";
import { createRedisConnection } from "../core/redis";
import prisma from "../core/db";

export const registerBuildingWorker = () => {
  new Worker<{ buildingId: string; orderId: string }>(
    "building-upgrade",
    async (job) => {
      const { buildingId, orderId } = job.data;
      await prisma.$transaction([
        prisma.building.update({
          where: { id: buildingId },
          data:  { level: { increment: 1 } },
        }),
        prisma.buildingUpgradeOrder.delete({ where: { id: orderId } }),
      ]);
    },
    { connection: createRedisConnection() }
  );
};
