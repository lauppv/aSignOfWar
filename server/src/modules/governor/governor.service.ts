import prisma from "../../core/db";
import { recruitmentQueue } from "../../core/queue";
import env from "../../core/env";
import {
  getGovernorCost,
  getGovernorRecruitmentTime,
  GOVERNOR_HQ_REQUIRED,
  GOVERNOR_POPULATION,
  getHousingCapacity,
  UNITS,
} from "../../../../shared/gameConfig";
import { syncResources } from "../city/city.service";

type Resource = "money" | "energy" | "ammo";

interface PendingGovernorOrder {
  id:       string;
  cityId:   string;
  cityName: string;
  startAt:  Date;
  finishAt: Date;
}

const findPendingGovernorOrders = async (userId: string): Promise<PendingGovernorOrder[]> => {
  const orders = await prisma.recruitmentOrder.findMany({
    where:   { unitName: "GOVERNOR", city: { ownerId: userId } },
    include: { city: { select: { id: true, name: true } } },
    orderBy: { finishAt: "asc" },
  });
  return orders.map((o) => ({
    id:       o.id,
    cityId:   o.cityId,
    cityName: o.city.name,
    startAt:  o.startAt,
    finishAt: o.finishAt,
  }));
};

export const getGovernorState = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      governorsRecruited: true,
      governorMoney:  true,
      governorEnergy: true,
      governorAmmo:   true,
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  const pendingOrders = await findPendingGovernorOrders(userId);
  const nextNumber    = user.governorsRecruited + 1;
  const nextCost      = getGovernorCost(nextNumber);

  return {
    recruited: user.governorsRecruited,
    nextNumber,
    deposits: {
      money:  user.governorMoney,
      energy: user.governorEnergy,
      ammo:   user.governorAmmo,
    },
    nextCost: { money: nextCost, energy: nextCost, ammo: nextCost },
    barsReady:
      user.governorMoney  >= nextCost &&
      user.governorEnergy >= nextCost &&
      user.governorAmmo   >= nextCost,
    recruitTimeSec: getGovernorRecruitmentTime(env.gameSpeed),
    pendingOrders,
  };
};

// Deposits `amount` of city `cityId`'s `resource` into the user's global bar.
// The city must have an HQ at lvl 30. The deposit is capped at min(resource in city, how much is left to fill the bar).
export const depositGovernor = async (
  userId: string,
  cityId: string,
  resource: Resource,
  amount: number
) => {
  if (amount <= 0) throw new Error("INVALID_AMOUNT");

  await syncResources(cityId);

  const city = await prisma.city.findUnique({
    where:   { id: cityId },
    include: { buildings: true },
  });
  if (!city)                    throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId)  throw new Error("UNAUTHORIZED");

  const hq = city.buildings.find(b => b.name === "HEADQUARTERS");
  if (!hq || hq.level < GOVERNOR_HQ_REQUIRED) {
    throw new Error(`HQ_REQUIRED:${GOVERNOR_HQ_REQUIRED}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const targetCost = getGovernorCost(user.governorsRecruited + 1);

  const currentDeposit =
    resource === "money"  ? user.governorMoney  :
    resource === "energy" ? user.governorEnergy :
                            user.governorAmmo;

  const remaining = targetCost - currentDeposit;
  if (remaining <= 0) throw new Error("BAR_ALREADY_FULL");

  const cityResource =
    resource === "money"  ? city.money  :
    resource === "energy" ? city.energy :
                            city.ammo;

  const actual = Math.min(amount, remaining, cityResource);
  if (actual <= 0) throw new Error("INSUFFICIENT_RESOURCES");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.city.updateMany({
      where: {
        id: cityId,
        [resource]: { gte: actual },
      },
      data: { [resource]: { decrement: actual } },
    });
    if (updated.count === 0) throw new Error("INSUFFICIENT_RESOURCES");

    const depositField =
      resource === "money"  ? "governorMoney"  :
      resource === "energy" ? "governorEnergy" :
                              "governorAmmo";

    await tx.user.update({
      where: { id: userId },
      data:  { [depositField]: { increment: actual } },
    });
  });

  const state = await getGovernorState(userId);
  return { deposited: actual, state };
};

// Starts recruiting a Governor (all bars must be full).
// Consumes the deposits (resets them to 0) and increments the counter immediately, so that
// the next deposit cycle can begin in parallel. The Governor appears in the city when
// the recruitmentQueue job finishes.
export const recruitGovernor = async (userId: string, cityId: string) => {
  await syncResources(cityId);

  // The pending order is per city: two cities can recruit in parallel, but in
  // the same city two governors cannot overlap.
  const existingPendingInCity = await prisma.recruitmentOrder.findFirst({
    where: { cityId, unitName: "GOVERNOR" },
  });
  if (existingPendingInCity) throw new Error("GOVERNOR_ALREADY_RECRUITING");

  const city = await prisma.city.findUnique({
    where:   { id: cityId },
    include: { buildings: true, units: true },
  });
  if (!city)                    throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId)  throw new Error("UNAUTHORIZED");

  const hq = city.buildings.find(b => b.name === "HEADQUARTERS");
  if (!hq || hq.level < GOVERNOR_HQ_REQUIRED) {
    throw new Error(`HQ_REQUIRED:${GOVERNOR_HQ_REQUIRED}`);
  }

  const housing = city.buildings.find(b => b.name === "HOUSING");
  const maxPop  = getHousingCapacity(housing?.level ?? 0);
  const currentPop = city.units.reduce(
    (sum, u) => sum + u.quantity * UNITS[u.name].population, 0,
  );
  const pendingOrders = await prisma.recruitmentOrder.findMany({ where: { cityId } });
  const pendingPop    = pendingOrders.reduce(
    (sum, o) => sum + o.quantity * UNITS[o.unitName].population, 0,
  );
  if (currentPop + pendingPop + GOVERNOR_POPULATION > maxPop) {
    throw new Error("INSUFFICIENT_POPULATION");
  }

  const timeSec  = getGovernorRecruitmentTime(env.gameSpeed);
  const now      = new Date();
  const finishAt = new Date(now.getTime() + timeSec * 1000);

  // The transaction does: re-reads the counter, computes the cost, runs a
  // conditional (ATOMIC) updateMany on (counter, bars). If another request
  // moved the counter or emptied the bars in the meantime, updateMany matches 0 rows
  // and we throw BARS_NOT_FULL — no risk of double-spend. Postgres locks
  // the user row for the duration of the UPDATE, and the WHERE clause evaluates against the
  // current committed version.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: userId } });
    if (!fresh) throw new Error("USER_NOT_FOUND");
    const counter    = fresh.governorsRecruited;
    const targetCost = getGovernorCost(counter + 1);

    const updated = await tx.user.updateMany({
      where: {
        id:                 userId,
        governorsRecruited: counter,
        governorMoney:      { gte: targetCost },
        governorEnergy:     { gte: targetCost },
        governorAmmo:       { gte: targetCost },
      },
      data: {
        governorsRecruited: counter + 1,
        governorMoney:      0,
        governorEnergy:     0,
        governorAmmo:       0,
      },
    });
    if (updated.count === 0) throw new Error("BARS_NOT_FULL");

    const order = await tx.recruitmentOrder.create({
      data: {
        cityId,
        unitName: "GOVERNOR",
        quantity: 1,
        startAt:  now,
        finishAt,
      },
    });
    return { orderId: order.id, targetCost };
  });

  const { orderId, targetCost } = result;

  try {
    const job = await recruitmentQueue.add(
      "recruit",
      { cityId, unitName: "GOVERNOR", quantity: 1, orderId },
      { delay: timeSec * 1000 },
    );
    await prisma.recruitmentOrder.update({
      where: { id: orderId },
      data:  { jobId: String(job.id) },
    });
  } catch (err) {
    // Manual rollback: restore the deposits and counter, delete the order.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  {
          governorsRecruited: { decrement: 1 },
          governorMoney:      targetCost,
          governorEnergy:     targetCost,
          governorAmmo:       targetCost,
        },
      }),
      prisma.recruitmentOrder.delete({ where: { id: orderId } }),
    ]);
    throw err;
  }

  return { orderId, startAt: now, finishAt, state: await getGovernorState(userId) };
};
