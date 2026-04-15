import prisma from "../config/db";
import { recruitmentQueue } from "../config/queue";
import env from "../config/env";
import {
  getGovernorCost,
  getGovernorRecruitmentTime,
  GOVERNOR_HQ_REQUIRED,
  GOVERNOR_POPULATION,
  getHousingCapacity,
  UNITS,
} from "../../../shared/gameConfig";
import { syncResources } from "./city.service";

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

// Depune `amount` din resursa `resource` a orasului `cityId` in bara globala a userului.
// Orasul trebuie sa aiba HQ lvl 30. Depunerea e plafonata la min(resursa in oras, cat mai e de completat la bara).
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

// Porneste recrutarea unui Governor (toate barele trebuie sa fie pline).
// Consuma depozitele (reset la 0) si incrementeaza contorul imediat, astfel incat
// urmatorul ciclu de depuneri poate incepe in paralel. Guvernator apare in oras cand
// finalizeaza job-ul din recruitmentQueue.
export const recruitGovernor = async (userId: string, cityId: string) => {
  await syncResources(cityId);

  // Pending order este per oras: doua orase pot recruta in paralel, dar in
  // acelasi oras nu se pot suprapune doi guvernatori.
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

  // Tranzactia face: re-citeste counter-ul, calculeaza costul, executa un
  // updateMany conditional (ATOMIC) pe (counter, bars). Daca alta cerere a
  // mutat counter-ul sau a golit barele intre timp, updateMany matches 0 randuri
  // si dam BARS_NOT_FULL — niciun risc de double-spend. Postgres lockeaza
  // randul user pe durata UPDATE-ului, iar WHERE-ul evalueaza pe versiunea
  // commited curenta.
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
    // Rollback manual: restaureaza depozitele si contorul, sterge orderul.
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
