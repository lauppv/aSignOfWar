import prisma from "../config/db";
import boss from "../config/pgboss";

export const registerBuildingWorker = async () => {
  await boss.createQueue("building-upgrade");
  await boss.work<{ buildingId: string }>("building-upgrade", async (jobs) => {
    for (const job of jobs) {
      await prisma.building.update({
        where: { id: job.data.buildingId },
        data: {
          level:             { increment: 1 },
          upgradeFinishesAt: null,
          upgradeJobId:      null,
        },
      });
    }
  });
};
