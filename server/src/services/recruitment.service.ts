import prisma from "../config/db";
import { recruitmentQueue } from "../config/queue";
import { UNITS, getRecruitmentTime, getHousingCapacity } from "../config/game.config";
import { UnitName } from "@prisma/client";
import { syncResources } from "./city.service";

export const startRecruitment = async (
  cityId: string,
  unitName: UnitName,
  quantity: number,
  userId: string
) => {
  if (quantity < 1) throw new Error("INVALID_QUANTITY");

  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { buildings: true, units: true },
  });

  if (!city)                        throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId)      throw new Error("UNAUTHORIZED");

  const cfg = UNITS[unitName];
  const hq  = city.buildings.find(b => b.name === "HEADQUARTERS")!;
  const mb  = city.buildings.find(b => b.name === "MILITARY_BASE")!;

  // Verificare conditii de deblocare
  if (unitName === "GOVERNOR") {
    if (hq.level < 30) throw new Error("HQ_REQUIRED:30");
  } else {
    if (mb.level < 1) throw new Error("MILITARY_BASE_REQUIRED");
    if (cfg.requiresHQ && hq.level < cfg.requiresHQ) {
      throw new Error(`HQ_REQUIRED:${cfg.requiresHQ}`);
    }
    if (cfg.requiresMilitaryBase && mb.level < cfg.requiresMilitaryBase) {
      throw new Error(`MB_REQUIRED:${cfg.requiresMilitaryBase}`);
    }
  }

  // Verificare populatie disponibila
  const housing    = city.buildings.find(b => b.name === "HOUSING")!;
  const maxPop     = getHousingCapacity(housing.level);
  const currentPop = city.units.reduce((sum, u) => sum + u.quantity * UNITS[u.name].population, 0);

  const pendingOrders = await prisma.recruitmentOrder.findMany({ where: { cityId } });
  const pendingPop    = pendingOrders.reduce((sum, o) => sum + o.quantity * UNITS[o.unitName].population, 0);

  if (currentPop + pendingPop + quantity * cfg.population > maxPop) {
    throw new Error("INSUFFICIENT_POPULATION");
  }

  await syncResources(cityId);

  const cost    = { money: cfg.costMoney * quantity, energy: cfg.costEnergy * quantity, ammo: cfg.costAmmo * quantity };
  const timeSec = quantity * getRecruitmentTime(unitName, mb.level);

  // Inlantuire dupa ultimul order din coada orasului
  const lastOrder = await prisma.recruitmentOrder.findFirst({
    where: { cityId },
    orderBy: { finishAt: "desc" },
  });

  const now      = new Date();
  const startAt  = lastOrder ? new Date(Math.max(now.getTime(), lastOrder.finishAt.getTime())) : now;
  const finishAt = new Date(startAt.getTime() + timeSec * 1000);
  const delay    = finishAt.getTime() - now.getTime();

  let orderId!: string;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.city.updateMany({
      where: {
        id:     cityId,
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

    const order = await tx.recruitmentOrder.create({
      data: { cityId, unitName, quantity, startAt, finishAt },
    });
    orderId = order.id;
  });

  try {
    const job = await recruitmentQueue.add("recruit", { cityId, unitName, quantity, orderId }, { delay });
    await prisma.recruitmentOrder.update({
      where: { id: orderId },
      data:  { jobId: String(job.id) },
    });
  } catch (err) {
    await prisma.$transaction([
      prisma.city.update({
        where: { id: cityId },
        data:  { money: { increment: cost.money }, energy: { increment: cost.energy }, ammo: { increment: cost.ammo } },
      }),
      prisma.recruitmentOrder.delete({ where: { id: orderId } }),
    ]);
    throw err;
  }

  return { unitName, quantity, startAt, finishAt, cost, timeSec };
};
