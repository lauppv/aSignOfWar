import { Worker } from "bullmq";
import { createRedisConnection } from "../core/redis";
import prisma from "../core/db";
import { UnitName } from "@prisma/client";
import { UNITS } from "../../../shared/gameConfig";

export const registerRecruitmentWorker = () => {
  new Worker<{ cityId: string; unitName: UnitName; quantity: number; orderId: string }>(
    "unit-recruitment",
    async (job) => {
      const { cityId, unitName, quantity, orderId } = job.data;
      await prisma.$transaction([
        prisma.unit.upsert({
          where:  { cityId_name: { cityId, name: unitName } },
          update: { quantity: { increment: quantity } },
          create: { cityId, name: unitName, category: UNITS[unitName].category, quantity },
        }),
        prisma.recruitmentOrder.delete({ where: { id: orderId } }),
      ]);
    },
    { connection: createRedisConnection() }
  );
};
