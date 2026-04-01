import prisma from "../config/db";
import { buildingQueue } from "../config/queue";
import { getBuildingUpgradeCost, getBuildingUpgradeTime, BUILDINGS } from "../config/game.config";
import { syncResources } from "./city.service";

export const startUpgrade = async (buildingId: string, userId: string) => {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { city: { include: { buildings: true } } },
  });

  if (!building)                        throw new Error("BUILDING_NOT_FOUND");
  if (building.city.ownerId !== userId) throw new Error("UNAUTHORIZED");

  const cfg = BUILDINGS[building.name];

  const pendingCount = await prisma.buildingUpgradeOrder.count({
    where: { cityId: building.city.id, buildingName: building.name },
  });
  const effectiveLevel = building.level + pendingCount;
  if (effectiveLevel >= cfg.maxLevel) throw new Error("MAX_LEVEL_REACHED");

  const hq = building.city.buildings.find(b => b.name === "HEADQUARTERS")!;
  if (cfg.requiresHQ && hq.level < cfg.requiresHQ) {
    throw new Error(`HQ_REQUIRED:${cfg.requiresHQ}`);
  }

  await syncResources(building.city.id);

  const cost    = getBuildingUpgradeCost(building.name, effectiveLevel);
  const timeSec = getBuildingUpgradeTime(building.name, effectiveLevel, hq.level);

  let orderId!: string;
  let finishAt!: Date;

  // lastOrder si calculul startAt/finishAt sunt in interiorul tranzactiei
  // pentru a evita race conditions intre request-uri simultane
  await prisma.$transaction(async (tx) => {
    const lastOrder = await tx.buildingUpgradeOrder.findFirst({
      where:   { cityId: building.city.id },
      orderBy: { finishAt: "desc" },
    });

    const now     = new Date();
    const startAt = lastOrder
      ? new Date(Math.max(now.getTime(), lastOrder.finishAt.getTime()))
      : now;
    finishAt = new Date(startAt.getTime() + timeSec * 1000);

    const updated = await tx.city.updateMany({
      where: {
        id:     building.city.id,
        money:  { gte: cost.money  },
        energy: { gte: cost.energy },
        ammo:   { gte: cost.ammo  },
      },
      data: {
        money:  { decrement: cost.money  },
        energy: { decrement: cost.energy },
        ammo:   { decrement: cost.ammo  },
      },
    });
    if (updated.count === 0) throw new Error("INSUFFICIENT_RESOURCES");

    const order = await tx.buildingUpgradeOrder.create({
      data: { cityId: building.city.id, buildingName: building.name, startAt, finishAt },
    });
    orderId = order.id;
  });

  const delay = finishAt.getTime() - Date.now();

  try {
    const job = await buildingQueue.add("upgrade", { buildingId, orderId }, { delay });
    await prisma.buildingUpgradeOrder.update({
      where: { id: orderId },
      data:  { jobId: String(job.id) },
    });
  } catch (err) {
    await prisma.$transaction([
      prisma.city.update({
        where: { id: building.city.id },
        data:  { money: { increment: cost.money }, energy: { increment: cost.energy }, ammo: { increment: cost.ammo } },
      }),
      prisma.buildingUpgradeOrder.delete({ where: { id: orderId } }),
    ]);
    throw err;
  }

  return { building: building.name, startAt: finishAt, finishAt, cost, timeSec };
};
