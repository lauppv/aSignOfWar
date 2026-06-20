import prisma from "../../core/db";
import { recruitmentQueue } from "../../core/queue";
import { UNITS, getRecruitmentTime, getHousingCapacity, getGovernorCost } from "../../../../shared/gameConfig";
import env from "../../core/env";
import { UnitName, Prisma } from "@prisma/client";
import { syncResourcesFromCity } from "../city/city.service";
import { isCityBesieged } from "../siege/siege.service";

export const startRecruitment = async (
  cityId: string,
  unitName: UnitName,
  quantity: number,
  userId: string
) => {
  if (quantity < 1) throw new Error("INVALID_QUANTITY");
  if (unitName === "GOVERNOR") throw new Error("GOVERNOR_USE_DEPOSIT_ENDPOINT");

  const city = await prisma.city.findUnique({
    where: { id: cityId },
    select: {
      id: true,
      ownerId: true,
      money: true,
      energy: true,
      ammo: true,
      lastResourceUpdate: true,
      buildings: { select: { name: true, level: true } },
      units: { select: { name: true, quantity: true } },
    },
  });

  if (!city)                        throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId)      throw new Error("UNAUTHORIZED");
  if (await isCityBesieged(cityId)) throw new Error("CITY_UNDER_SIEGE");

  const cfg = UNITS[unitName];
  const hq  = city.buildings.find(b => b.name === "HEADQUARTERS")!;
  const mb  = city.buildings.find(b => b.name === "MILITARY_BASE")!;

  // Check unlock conditions (GOVERNOR has a dedicated endpoint, see governor.service)
  if (mb.level < 1) throw new Error("MILITARY_BASE_REQUIRED");
  if (cfg.requiresHQ && hq.level < cfg.requiresHQ) {
    throw new Error(`HQ_REQUIRED:${cfg.requiresHQ}`);
  }
  if (cfg.requiresMilitaryBase && mb.level < cfg.requiresMilitaryBase) {
    throw new Error(`MB_REQUIRED:${cfg.requiresMilitaryBase}`);
  }

  // Check available population
  const housing    = city.buildings.find(b => b.name === "HOUSING")!;
  const maxPop     = getHousingCapacity(housing.level);
  const currentPop = city.units.reduce((sum, u) => sum + u.quantity * UNITS[u.name].population, 0);

  const pendingOrders = await prisma.recruitmentOrder.findMany({ where: { cityId }, select: { quantity: true, unitName: true } });
  const pendingPop    = pendingOrders.reduce((sum, o) => sum + o.quantity * UNITS[o.unitName].population, 0);

  if (currentPop + pendingPop + quantity * cfg.population > maxPop) {
    throw new Error("INSUFFICIENT_POPULATION");
  }

  await syncResourcesFromCity(city);

  const cost    = { money: cfg.costMoney * quantity, energy: cfg.costEnergy * quantity, ammo: cfg.costAmmo * quantity };
  const timeSec = quantity * getRecruitmentTime(unitName, mb.level, env.gameSpeed);

  let orderId!: string;
  let startAt!: Date;
  let finishAt!: Date;

  // Same race-condition prevention as for building upgrades — see building.service.ts.
  // The lastOrder lookup + the resource deduction must be atomic.
  await prisma.$transaction(async (tx) => {
    const lastOrder = await tx.recruitmentOrder.findFirst({
      where: { cityId },
      orderBy: { finishAt: "desc" },
    });

    const now = new Date();
    startAt = lastOrder ? new Date(Math.max(now.getTime(), lastOrder.finishAt.getTime())) : now;
    finishAt = new Date(startAt.getTime() + timeSec * 1000);

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

  const delay = finishAt.getTime() - Date.now();

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

export const cancelRecruitment = async (orderId: string, userId: string) => {
  const order = await prisma.recruitmentOrder.findUnique({
    where: { id: orderId },
    include: { city: { select: { id: true, ownerId: true } } },
  });

  if (!order)                        throw new Error("ORDER_NOT_FOUND");
  if (order.city.ownerId !== userId) throw new Error("UNAUTHORIZED");

  let cost: { money: number; energy: number; ammo: number };
  if (order.unitName === "GOVERNOR") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("USER_NOT_FOUND");
    // The cost of the cancelled governor = that of governor #governorsRecruited
    // (it was incremented when recruitment started).
    const c = getGovernorCost(user.governorsRecruited);
    cost = { money: c, energy: c, ammo: c };
  } else {
    const cfg = UNITS[order.unitName];
    cost = {
      money:  cfg.costMoney  * order.quantity,
      energy: cfg.costEnergy * order.quantity,
      ammo:   cfg.costAmmo   * order.quantity,
    };
  }

  // Refund 75% on cancel — penalizes cancel-spamming but stays fair.
  // Same formula as in building.service.ts. I could have extracted a calcRefund() helper,
  // but with only 2 call sites the indirection isn't worth it. KISS.
  const refund = {
    money:  Math.floor(cost.money  * 0.75),
    energy: Math.floor(cost.energy * 0.75),
    ammo:   Math.floor(cost.ammo   * 0.75),
  };

  if (order.jobId) {
    const job = await recruitmentQueue.getJob(order.jobId);
    if (job) await job.remove();
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.recruitmentOrder.delete({ where: { id: orderId } }),
    prisma.city.update({
      where: { id: order.cityId },
      data: {
        money:  { increment: refund.money },
        energy: { increment: refund.energy },
        ammo:   { increment: refund.ammo },
      },
    }),
  ];
  if (order.unitName === "GOVERNOR") {
    ops.push(
      prisma.user.update({
        where: { id: userId },
        data:  { governorsRecruited: { decrement: 1 } },
      }),
    );
  }
  await prisma.$transaction(ops);

  return { refund };
};
