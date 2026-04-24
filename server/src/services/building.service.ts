import prisma from "../config/db";
import { buildingQueue } from "../config/queue";
import { getBuildingUpgradeCost, getBuildingUpgradeTime, BUILDINGS } from "../../../shared/gameConfig";
import env from "../config/env";
import { syncResources } from "./city.service";

export const startUpgrade = async (buildingId: string, userId: string) => {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { city: { select: { id: true, ownerId: true, buildings: { select: { name: true, level: true } } } } },
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
  const timeSec = getBuildingUpgradeTime(building.name, effectiveLevel, hq.level, env.gameSpeed);

  let orderId!: string;
  let startAt!: Date;
  let finishAt!: Date;

  // Prevenire race condition: lookup-ul lastOrder + deducerea resurselor se fac intr-o
  // singura tranzactie Prisma. Fara asta, doua click-uri rapide de upgrade ar putea vedea
  // ambele acelasi lastOrder si se suprapune in coada, sau ambele trec verificarea de resurse.
  await prisma.$transaction(async (tx) => {
    const lastOrder = await tx.buildingUpgradeOrder.findFirst({
      where:   { cityId: building.city.id },
      orderBy: { finishAt: "desc" },
    });

    const now = new Date();
    startAt = lastOrder
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

  // Compensating transaction: daca BullMQ esueaza sa programeze job-ul, refundam
  // resursele si stergem order-ul. E un pattern saga simplificat — un sistem distribuit
  // real ar folosi outbox sau 2PC, dar pentru un joc single-server catch-and-rollback
  // e suficient si mult mai simplu. YAGNI.
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

  return { building: building.name, startAt, finishAt, cost, timeSec };
};

export const cancelUpgrade = async (orderId: string, userId: string) => {
  const order = await prisma.buildingUpgradeOrder.findUnique({
    where: { id: orderId },
    include: { city: { select: { id: true, ownerId: true } } },
  });

  if (!order)                        throw new Error("ORDER_NOT_FOUND");
  if (order.city.ownerId !== userId) throw new Error("UNAUTHORIZED");

  const [building, ordersBefore] = await Promise.all([
    prisma.building.findFirst({
      where: { cityId: order.cityId, name: order.buildingName },
      select: { level: true },
    }),
    prisma.buildingUpgradeOrder.count({
      where: { cityId: order.cityId, buildingName: order.buildingName, startAt: { lt: order.startAt } },
    }),
  ]);
  if (!building) throw new Error("BUILDING_NOT_FOUND");
  const effectiveLevel = building.level + ordersBefore;
  const cost = getBuildingUpgradeCost(order.buildingName, effectiveLevel);

  const refund = {
    money:  Math.floor(cost.money  * 0.75),
    energy: Math.floor(cost.energy * 0.75),
    ammo:   Math.floor(cost.ammo   * 0.75),
  };

  // Sterge job-ul din coada daca exista
  if (order.jobId) {
    const job = await buildingQueue.getJob(order.jobId);
    if (job) await job.remove();
  }

  // Gaseste toate order-urile care vin DUPA cel anulat (trebuie recalculate)
  const laterOrders = await prisma.buildingUpgradeOrder.findMany({
    where: { cityId: order.cityId, startAt: { gte: order.startAt }, id: { not: orderId } },
    orderBy: { startAt: "asc" },
  });

  // Sterge order-ul anulat si returneaza resursele
  await prisma.$transaction([
    prisma.buildingUpgradeOrder.delete({ where: { id: orderId } }),
    prisma.city.update({
      where: { id: order.cityId },
      data: {
        money:  { increment: refund.money },
        energy: { increment: refund.energy },
        ammo:   { increment: refund.ammo },
      },
    }),
  ]);

  // Recalculeaza startAt/finishAt pentru order-urile ulterioare
  if (laterOrders.length > 0) {
    // Gaseste ultimul order din INAINTE de cel anulat (daca exista)
    const previousOrder = await prisma.buildingUpgradeOrder.findFirst({
      where: { cityId: order.cityId, finishAt: { lte: order.startAt } },
      orderBy: { finishAt: "desc" },
    });

    const now = Date.now();
    let cursor = previousOrder
      ? Math.max(now, previousOrder.finishAt.getTime())
      : now;

    for (const lo of laterOrders) {
      const duration = lo.finishAt.getTime() - lo.startAt.getTime();
      const newStart  = new Date(cursor);
      const newFinish = new Date(cursor + duration);

      await prisma.buildingUpgradeOrder.update({
        where: { id: lo.id },
        data:  { startAt: newStart, finishAt: newFinish },
      });

      // Reschedule BullMQ job
      if (lo.jobId) {
        const oldJob = await buildingQueue.getJob(lo.jobId);
        if (oldJob) await oldJob.remove();
      }
      const bld = await prisma.building.findFirst({
        where: { cityId: order.cityId, name: lo.buildingName },
      });
      if (bld) {
        const newDelay = Math.max(0, newFinish.getTime() - Date.now());
        const newJob = await buildingQueue.add("upgrade", { buildingId: bld.id, orderId: lo.id }, { delay: newDelay });
        await prisma.buildingUpgradeOrder.update({
          where: { id: lo.id },
          data:  { jobId: String(newJob.id) },
        });
      }

      cursor = newFinish.getTime();
    }
  }

  return { refund };
};
