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

  // Nivelul efectiv = nivel curent + cate upgrade-uri sunt deja la coada pentru aceasta cladire
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

  // startAt = dupa ultimul order din coada orasului (sau acum daca coada e goala)
  const lastOrder = await prisma.buildingUpgradeOrder.findFirst({
    where: { cityId: building.city.id },
    orderBy: { finishAt: "desc" },
  });

  const now = new Date();
  const startAt  = lastOrder ? new Date(Math.max(now.getTime(), lastOrder.finishAt.getTime())) : now;
  const finishAt = new Date(startAt.getTime() + timeSec * 1000);
  const delay    = finishAt.getTime() - now.getTime();

  // Scade resursele si creeaza orderul atomic
  let orderId!: string;
  await prisma.$transaction(async (tx) => {
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

  // Programeaza job-ul; daca esueaza, refund + sterge orderul
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

  return { building: building.name, startAt, finishAt, cost, timeSec };
};
