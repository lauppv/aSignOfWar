import prisma from "../../core/db";
import { commandQueue } from "../../core/queue";
import {
  UNITS,
  getHarborCapacity,
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
  getResourceTravelTimeSec,
} from "../../../../shared/gameConfig";
import env from "../../core/env";
import { CommandType, UnitName, BuildingName } from "@prisma/client";
import { syncResourcesFromCity } from "../city/city.service";
import { isCityBesieged } from "../siege/siege.service";

// A command's lifecycle: TRAVELING -> ARRIVING (worker) -> RETURNING -> COMPLETED
// Cancellation window: 5 min after departure, the return is symmetric (X sec outbound = X sec return).
// All resource/unit deductions use optimistic locking (updateMany with WHERE >= qty)
// to prevent race conditions between concurrent requests without explicit DB locks.

export const sendCommand = async (
  fromCityId: string,
  toCityId: string,
  type: CommandType,
  userId: string,
  unitCounts: Partial<Record<UnitName, number>>,
  resources: { money: number; energy: number; ammo: number },
  targetBuilding?: string
) => {
  if (fromCityId === toCityId) throw new Error("SAME_CITY");

  const [fromCity, toCity] = await Promise.all([
    prisma.city.findUnique({
      where: { id: fromCityId },
      select: {
        id: true, x: true, y: true, ownerId: true,
        money: true, energy: true, ammo: true, lastResourceUpdate: true,
        units:     { select: { name: true, quantity: true } },
        buildings: { select: { name: true, level: true } },
      },
    }),
    prisma.city.findUnique({ where: { id: toCityId }, select: { id: true, x: true, y: true, ownerId: true } }),
  ]);

  if (!fromCity)             throw new Error("CITY_NOT_FOUND");
  if (!toCity)               throw new Error("TARGET_CITY_NOT_FOUND");
  if (fromCity.ownerId !== userId) throw new Error("UNAUTHORIZED");
  // As long as the source city is under siege, no new commands can be sent.
  if (await isCityBesieged(fromCityId)) throw new Error("CITY_UNDER_SIEGE");
  if (type === "ATTACK" && fromCity.ownerId === toCity.ownerId) throw new Error("CANNOT_ATTACK_OWN_CITY");
  if (type === "SPY"    && fromCity.ownerId === toCity.ownerId) throw new Error("CANNOT_SPY_OWN_CITY");

  if ((type === "ATTACK" || type === "SPY") && toCity.ownerId && toCity.ownerId !== userId) {
    const [me, defender] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } }),
      prisma.user.findUnique({ where: { id: toCity.ownerId }, select: { allianceId: true } }),
    ]);
    if (me?.allianceId && defender?.allianceId && me.allianceId === defender.allianceId) {
      throw new Error("CANNOT_ATTACK_ALLIANCE_MEMBER");
    }
  }

  const units = Object.entries(unitCounts)
    .filter(([, qty]) => qty && qty > 0)
    .map(([name, qty]) => ({ name: name as UnitName, quantity: qty! }));

  // Unit validation
  if (type !== "RESOURCES") {
    if (units.length === 0) throw new Error("NO_UNITS");
    for (const { name, quantity } of units) {
      const cityUnit = fromCity.units.find(u => u.name === name);
      if (!cityUnit || cityUnit.quantity < quantity) {
        throw new Error(`INSUFFICIENT_UNITS:${name}`);
      }
    }
  }

  // SPY: we only accept hackers
  if (type === "SPY") {
    const nonHacker = units.find(u => u.name !== "HACKER");
    if (nonHacker) throw new Error("SPY_REQUIRES_HACKERS_ONLY");
    const totalHackers = units.reduce((s, u) => s + u.quantity, 0);
    if (totalHackers < 1) throw new Error("NO_UNITS");
  }
  // ATTACK/SUPPORT: hackers can't be sent (they don't take part in normal battles)
  if (type === "ATTACK" || type === "SUPPORT") {
    if (units.some(u => u.name === "HACKER")) throw new Error("HACKERS_CANNOT_JOIN_BATTLE");
  }

  // targetBuilding only with drones in ATTACK
  if (targetBuilding) {
    if (type !== "ATTACK") throw new Error("TARGET_BUILDING_ONLY_FOR_ATTACK");
    if (!units.some(u => u.name === "DRONE" && u.quantity > 0)) throw new Error("TARGET_BUILDING_REQUIRES_DRONES");
  }

  // Resource validation (RESOURCES)
  if (type === "RESOURCES") {
    const harbor = fromCity.buildings.find(b => b.name === "HARBOR");
    if (!harbor || harbor.level < 1) throw new Error("HARBOR_REQUIRED");
    const total = resources.money + resources.energy + resources.ammo;
    if (total <= 0) throw new Error("NO_RESOURCES");
    if (total > getHarborCapacity(harbor.level)) throw new Error("EXCEEDS_HARBOR_CAPACITY");
    if (resources.money < 0 || resources.energy < 0 || resources.ammo < 0) throw new Error("NEGATIVE_RESOURCES");
  }

  await syncResourcesFromCity(fromCity);

  const distance = getFieldDistance(fromCity.x, fromCity.y, toCity.x, toCity.y);
  let travelSec: number;
  if (type === "RESOURCES") {
    travelSec = getResourceTravelTimeSec(distance, env.gameSpeed);
  } else {
    const slowest = getSlowestUnitSpeed(unitCounts);
    if (slowest <= 0) throw new Error("NO_UNITS");
    travelSec = getUnitTravelTimeSec(distance, slowest, env.gameSpeed);
  }

  const now       = new Date();
  const arrivalAt = new Date(now.getTime() + travelSec * 1000);
  let commandId!: string;

  await prisma.$transaction(async (tx) => {
    // Optimistic locking: WHERE quantity >= X makes it so two concurrent commands can't
    // deduct from the same pool. If updateMany.count === 0, someone else took the units
    // first — we throw an error and the transaction rolls back.
    for (const { name, quantity } of units) {
      const updated = await tx.unit.updateMany({
        where: { cityId: fromCityId, name, quantity: { gte: quantity } },
        data:  { quantity: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error(`INSUFFICIENT_UNITS:${name}`);
    }

    // Deduct the resources from the city (RESOURCES)
    if (type === "RESOURCES") {
      const updated = await tx.city.updateMany({
        where: {
          id:     fromCityId,
          money:  { gte: resources.money },
          energy: { gte: resources.energy },
          ammo:   { gte: resources.ammo },
        },
        data: {
          money:  { decrement: resources.money },
          energy: { decrement: resources.energy },
          ammo:   { decrement: resources.ammo },
        },
      });
      if (updated.count === 0) throw new Error("INSUFFICIENT_RESOURCES");
    }

    const command = await tx.command.create({
      data: {
        type,
        status:      "TRAVELING",
        fromCityId,
        toCityId,
        arrivalAt,
        attackerUserId: fromCity.ownerId!,
        defenderUserId: toCity.ownerId,
        targetBuilding: (targetBuilding as BuildingName) ?? null,
        resourceMoney:  type === "RESOURCES" ? resources.money  : 0,
        resourceEnergy: type === "RESOURCES" ? resources.energy : 0,
        resourceAmmo:   type === "RESOURCES" ? resources.ammo   : 0,
        units: { create: units.map(u => ({ name: u.name, quantity: u.quantity })) },
      },
    });
    commandId = command.id;
  });

  const delay = arrivalAt.getTime() - Date.now();
  await commandQueue.add("arrive", { commandId }, { delay });

  return { commandId, arrivalAt };
};

// Cancel a TRAVELING command: the units/resources return home symmetrically
// (if they traveled x seconds out, they take exactly x seconds back home).
export const cancelCommand = async (commandId: string, userId: string) => {
  const command = await prisma.command.findUnique({
    where:   { id: commandId },
    include: { fromCity: { select: { ownerId: true } } },
  });
  if (!command)                             throw new Error("COMMAND_NOT_FOUND");
  if (command.fromCity.ownerId !== userId)  throw new Error("UNAUTHORIZED");
  if (command.status !== "TRAVELING")       throw new Error("NOT_CANCELLABLE");

  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - command.departureAt.getTime());
  if (elapsedMs > 5 * 60 * 1000)            throw new Error("CANCEL_WINDOW_EXPIRED");
  const newArrivalAt = new Date(now.getTime() + elapsedMs);

  await prisma.command.update({
    where: { id: commandId },
    data:  { status: "RETURNING", arrivalAt: newArrivalAt },
  });

  await commandQueue.add("return", { commandId }, { delay: elapsedMs });

  return { commandId, arrivalAt: newArrivalAt };
};

// Withdraw units stationed as SUPPORT in a city. Two variants:
//   - mode "all"  → all stationed commands head back (flip ARRIVED → RETURNING).
//   - partial mode with unitCounts → create a new RETURNING command with the requested units,
//     subtracting from the existing stationed commands (oldest first).
export const withdrawStationedSupport = async (
  fromCityId: string,
  targetCityId: string,
  userId: string,
  unitCounts: Partial<Record<UnitName, number>> | "all"
) => {
  const fromCity = await prisma.city.findUnique({
    where: { id: fromCityId },
    select: { id: true, ownerId: true, x: true, y: true },
  });
  if (!fromCity)                     throw new Error("CITY_NOT_FOUND");
  if (fromCity.ownerId !== userId)   throw new Error("UNAUTHORIZED");

  const targetCity = await prisma.city.findUnique({
    where:  { id: targetCityId },
    select: { id: true, x: true, y: true },
  });
  if (!targetCity) throw new Error("TARGET_CITY_NOT_FOUND");

  const stationed = await prisma.command.findMany({
    where:  { fromCityId, toCityId: targetCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
    orderBy: { arrivalAt: "asc" },
  });
  if (stationed.length === 0) throw new Error("NO_STATIONED_UNITS");

  // The besieger can't withdraw the garrison while the siege is active — the governor
  // and the escorts are locked in the city until the siege ends (successful capture,
  // broken by the defender, or replaced by another attacker).
  const activeSiege = await prisma.siege.findFirst({
    where:  { cityId: targetCityId, status: "ACTIVE", garrisonCommandId: { in: stationed.map(s => s.id) } },
    select: { id: true },
  });
  if (activeSiege) throw new Error("CANNOT_WITHDRAW_BESIEGER_GARRISON");

  const distance = getFieldDistance(fromCity.x, fromCity.y, targetCity.x, targetCity.y);
  const travelMsFor = (units: { name: UnitName; quantity: number }[]): number => {
    const counts: Partial<Record<UnitName, number>> = {};
    for (const u of units) counts[u.name] = (counts[u.name] ?? 0) + u.quantity;
    const slowest = getSlowestUnitSpeed(counts);
    return getUnitTravelTimeSec(distance, slowest, env.gameSpeed) * 1000;
  };

  if (unitCounts === "all") {
    const ids: string[] = [];
    const delays = new Map<string, number>();
    const withdrawnAt = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      for (const c of stationed) {
        const ms = travelMsFor(c.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity })));
        const arrival = new Date(Date.now() + ms);
        await tx.command.update({
          where: { id: c.id },
          data:  {
            status:    "RETURNING",
            arrivalAt: arrival,
            report:    { withdrawal: true, withdrawnAt } as any,
          },
        });
        ids.push(c.id);
        delays.set(c.id, ms);
      }
    });
    for (const id of ids) {
      await commandQueue.add("return", { commandId: id }, { delay: delays.get(id)! });
    }
    return { withdrawnCommandIds: ids };
  }

  // Partial: tally up how much to pull out per unit type
  const remaining = new Map<UnitName, number>();
  for (const [name, qty] of Object.entries(unitCounts) as [UnitName, number | undefined][]) {
    if (qty && qty > 0) remaining.set(name, qty);
  }
  if (remaining.size === 0) throw new Error("NO_UNITS");

  const withdrawn = new Map<UnitName, number>();
  let newCommandId!: string;
  let partialDelayMs = 0;
  let partialArrivalAt: Date = new Date();

  await prisma.$transaction(async (tx) => {
    for (const cmd of stationed) {
      for (const cu of cmd.units) {
        const need = remaining.get(cu.name as UnitName) ?? 0;
        if (need <= 0 || cu.quantity <= 0) continue;
        const take = Math.min(need, cu.quantity);
        await tx.commandUnit.update({
          where: { id: cu.id },
          data:  { quantity: cu.quantity - take },
        });
        remaining.set(cu.name as UnitName, need - take);
        withdrawn.set(cu.name as UnitName, (withdrawn.get(cu.name as UnitName) ?? 0) + take);
      }
      // If all units of the stationed command have become 0, mark it COMPLETED
      // and hide it from reports — the notification value is on the new RETURNING
      // command created below, which carries the withdrawal flag.
      const refreshed = await tx.commandUnit.findMany({ where: { commandId: cmd.id } });
      if (refreshed.every(u => u.quantity === 0)) {
        await tx.command.update({
          where: { id: cmd.id },
          data:  {
            status:                 "COMPLETED",
            reportHiddenByAttacker: true,
            reportHiddenByDefender: true,
          },
        });
      }
    }

    for (const [, left] of remaining) {
      if (left > 0) throw new Error("INSUFFICIENT_STATIONED_UNITS");
    }

    if (withdrawn.size === 0) throw new Error("NO_UNITS_WITHDRAWN");

    const withdrawnUnits = Array.from(withdrawn.entries()).map(([name, quantity]) => ({ name, quantity }));
    partialDelayMs       = travelMsFor(withdrawnUnits);
    partialArrivalAt     = new Date(Date.now() + partialDelayMs);

    // The new withdrawal departs from the "attacker" city (sender) toward the
    // "defender" city (the target where they were stationed). The owners stay tied to
    // the original support participants, not to whoever owns the cities today.
    const srcCity = await tx.city.findUnique({ where: { id: fromCityId },   select: { ownerId: true } });
    const dstCity = await tx.city.findUnique({ where: { id: targetCityId }, select: { ownerId: true } });

    const created = await tx.command.create({
      data: {
        type:       "SUPPORT",
        status:     "RETURNING",
        fromCityId,
        toCityId:   targetCityId,
        arrivalAt:  partialArrivalAt,
        attackerUserId: srcCity!.ownerId!,
        defenderUserId: dstCity?.ownerId ?? null,
        report:     { withdrawal: true, withdrawnAt: new Date().toISOString() } as any,
        units: {
          create: withdrawnUnits,
        },
      },
    });
    newCommandId = created.id;
  });

  await commandQueue.add("return", { commandId: newCommandId }, { delay: partialDelayMs });
  return { withdrawnCommandIds: [newCommandId], arrivalAt: partialArrivalAt };
};

export const getCommandsForCity = async (cityId: string, userId: string) => {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { ownerId: true } });
  if (!city)                   throw new Error("CITY_NOT_FOUND");
  if (city.ownerId !== userId) throw new Error("UNAUTHORIZED");

  // Outgoing: we show TRAVELING (leaving) and RETURNING (heading back home).
  // Incoming: we show only TRAVELING — an attack that reached us and has turned RETURNING
  // is no longer the defender's concern, it's just the attacker's return trip.
  const [outgoing, incoming] = await Promise.all([
    prisma.command.findMany({
      where:   { fromCityId: cityId, status: { in: ["TRAVELING", "RETURNING", "ARRIVED"] } },
      include: { units: { select: { name: true, quantity: true } }, toCity: { select: { id: true, name: true, x: true, y: true, owner: { select: { id: true, username: true } } } } },
      orderBy: { arrivalAt: "asc" },
    }),
    prisma.command.findMany({
      where:   { toCityId: cityId, status: "TRAVELING" },
      include: { units: { select: { name: true, quantity: true } }, fromCity: { select: { name: true, x: true, y: true, owner: { select: { id: true, username: true } } } } },
      orderBy: { arrivalAt: "asc" },
    }),
  ]);

  // SPY commands are completely invisible to the defender (they don't know a spy mission is coming).
  // ATTACK: we hide the composition (units), but the defender can see that an attack is incoming.
  const sanitizedIncoming = incoming
    .filter(c => c.type !== "SPY")
    .map(c => c.type === "ATTACK" ? { ...c, units: [] } : c);

  return { outgoing, incoming: sanitizedIncoming };
};
