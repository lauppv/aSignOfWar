import prisma from "../config/db";
import { buildingQueue } from "../config/queue";
import { getBuildingUpgradeCost, getBuildingUpgradeTime, BUILDINGS } from "../config/game.config";

export const startUpgrade = async (buildingId: string, userId: string) => {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { city: { include: { buildings: true } } },
  });

  if (!building)                        throw new Error("BUILDING_NOT_FOUND");
  if (building.city.ownerId !== userId) throw new Error("UNAUTHORIZED");
  if (building.upgradeFinishesAt)       throw new Error("UPGRADE_IN_PROGRESS");

  const cfg = BUILDINGS[building.name];
  if (building.level >= cfg.maxLevel)   throw new Error("MAX_LEVEL_REACHED");

  const hq = building.city.buildings.find(b => b.name === "HEADQUARTERS")!;

  if (cfg.requiresHQ && hq.level < cfg.requiresHQ) {
    throw new Error(`HQ_REQUIRED:${cfg.requiresHQ}`);
  }

  const cost    = getBuildingUpgradeCost(building.name, building.level);
  const timeSec = getBuildingUpgradeTime(building.name, building.level, hq.level);
  const finishesAt = new Date(Date.now() + timeSec * 1000);

  // Scade resursele si blocheaza cladirea intr-o singura tranzactie atomica
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

    await tx.building.update({
      where: { id: buildingId, upgradeFinishesAt: null },
      data: { upgradeFinishesAt: finishesAt },
    });
  });

  // Programeaza job-ul in Redis; daca esueaza, anuleaza tranzactia de mai sus
  try {
    const job = await buildingQueue.add(
      "upgrade",
      { buildingId },
      { delay: timeSec * 1000 }
    );

    await prisma.building.update({
      where: { id: buildingId },
      data: { upgradeJobId: String(job.id) },
    });
  } catch (err) {
    await prisma.$transaction([
      prisma.city.update({
        where: { id: building.city.id },
        data: {
          money:  { increment: cost.money  },
          energy: { increment: cost.energy },
          ammo:   { increment: cost.ammo  },
        },
      }),
      prisma.building.update({
        where: { id: buildingId },
        data: { upgradeFinishesAt: null },
      }),
    ]);
    throw err;
  }

  return { building: building.name, finishesAt, cost, timeSec };
};
