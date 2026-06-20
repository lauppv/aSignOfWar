import { Worker } from "bullmq";
import { createRedisConnection } from "../core/redis";
import prisma from "../core/db";
import { commandQueue, buildingQueue, recruitmentQueue } from "../core/queue";
import { calculateBattle } from "../modules/command/battle.service";
import {
  UNITS,
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
  calcBuildingDamage,
} from "../../../shared/gameConfig";
import env from "../core/env";
import { syncResources } from "../modules/city/city.service";
import { getActiveSiege, startSiege, endSiege, cancelSiegeJob, scheduleSiegeExpiry, resolveAttackOnBesiegedCity, isCityBesieged } from "../modules/siege/siege.service";
import { UnitName, CommandType, BuildingName } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// Prisma result type for a command with its units included.
// Using Prisma's inference avoids maintaining a manual interface that could drift.
type CommandWithUnits = Prisma.CommandGetPayload<{ include: { units: true } }>;

// BullMQ worker that processes command arrivals and returns. Each command travels
// for a computed time (distance / speed), then the worker resolves the outcome:
// resource delivery, support stationing, battle resolution, or spy operation.
// Stats (kills, loot) are updated fire-and-forget after the main transaction
// because they aren't critical — a failed stats update must not roll back the battle.
export const registerCommandWorker = () => {
  new Worker<{ commandId: string }>(
    "command-travel",
    async (job) => {
      if (job.name === "arrive") {
        await processArrival(job.data.commandId);
      } else if (job.name === "return") {
        await processReturn(job.data.commandId);
      }
    },
    { connection: createRedisConnection() }
  );
};

// ─── Arrival at destination ───────────────────────────────────────────────────

async function processArrival(commandId: string) {
  const command = await prisma.command.findUnique({
    where:   { id: commandId },
    include: { units: true },
  });
  if (!command || command.status !== "TRAVELING") return;

  if (command.type === "RESOURCES") return processResourceArrival(command);
  if (command.type === "SUPPORT")   return processSupportArrival(command);
  if (command.type === "ATTACK")    return processAttackArrival(command);
  if (command.type === "SPY")       return processSpyArrival(command);
}

// ─── Resources: add to the destination city ──────────────────────────────────

async function processResourceArrival(command: CommandWithUnits) {
  await prisma.$transaction([
    prisma.city.update({
      where: { id: command.toCityId },
      data: {
        money:  { increment: command.resourceMoney },
        energy: { increment: command.resourceEnergy },
        ammo:   { increment: command.resourceAmmo },
      },
    }),
    prisma.command.update({
      where: { id: command.id },
      data:  { status: "COMPLETED" },
    }),
  ]);
}

// ─── Support: units stay stationed in the destination city (not transferred) ──
// They contribute to the city's defense in case of an attack, but can't be used by
// the city owner — only recalled home by the sender.

async function processSupportArrival(command: CommandWithUnits) {
  // If the city is under siege, the support doesn't station quietly — it ATTACKS
  // the besieger's garrison (confirmed rule: incoming supports auto-engage).
  // Survivors stay in the city as SUPPORT (they'll contribute to future attacks).
  if (await isCityBesieged(command.toCityId)) {
    const attackerUnits = command.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity }));
    const { attackerSurvivors } = await resolveAttackOnBesiegedCity({
      attackerUnits,
      toCityId:       command.toCityId,
      attackerUserId: command.attackerUserId,
      fromCityId:     command.fromCityId,
    });
    const hasSurvivors = attackerSurvivors.some(u => u.quantity > 0);

    await prisma.$transaction(async (tx) => {
      for (const { name, quantity } of attackerSurvivors) {
        await tx.commandUnit.updateMany({
          where: { commandId: command.id, name },
          data:  { quantity },
        });
      }
      await tx.command.update({
        where: { id: command.id },
        data:  { status: hasSurvivors ? "ARRIVED" : "COMPLETED" },
      });
    });
    return;
  }

  await prisma.command.update({
    where: { id: command.id },
    data:  { status: "ARRIVED" },
  });
}

// ─── Attack: resolve the battle ───────────────────────────────────────────────

async function processAttackArrival(command: CommandWithUnits) {
  await syncResources(command.toCityId);

  const toCity = await prisma.city.findUnique({
    where:   { id: command.toCityId },
    include: { units: true, buildings: true },
  });
  if (!toCity) return;

  const fromCityCoords = await prisma.city.findUnique({
    where:  { id: command.fromCityId },
    select: { x: true, y: true },
  });
  if (!fromCityCoords) return;
  const attackDistance = getFieldDistance(fromCityCoords.x, fromCityCoords.y, toCity.x, toCity.y);

  // Stationed support contributes to the defense
  const stationedSupports = await prisma.command.findMany({
    where:   { toCityId: command.toCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
    // attackerUserId = the owner who sent the support (needed for stats)
  });

  const airDefenseBuilding = toCity.buildings.find(b => b.name === "AIR_DEFENSE");
  const airDefenseLevel    = airDefenseBuilding?.level ?? 0;

  const attackerUnits  = command.units.map(u => ({ name: u.name, quantity: u.quantity }));

  // Aggregate the defense: native units + all units sent as support
  const nativeStack  = new Map<UnitName, number>(toCity.units.map(u => [u.name, u.quantity]));
  const supportStacks = stationedSupports.map(sc => ({
    commandId: sc.id,
    userId:    sc.attackerUserId,
    units:     new Map<UnitName, number>(sc.units.map(u => [u.name as UnitName, u.quantity])),
  }));

  const totalByName = new Map<UnitName, number>();
  for (const [n, q] of nativeStack) totalByName.set(n, (totalByName.get(n) ?? 0) + q);
  for (const s of supportStacks) {
    for (const [n, q] of s.units) totalByName.set(n, (totalByName.get(n) ?? 0) + q);
  }
  const defenderUnits = Array.from(totalByName.entries())
    .filter(([, q]) => q > 0)
    .map(([name, quantity]) => ({ name, quantity }));

  const result = calculateBattle(
    attackerUnits,
    defenderUnits,
    airDefenseLevel,
    toCity.money,
    toCity.energy,
    toCity.ammo,
    command.targetBuilding ?? undefined
  );

  // Survivor distribution: when support stacks fight alongside native defenders,
  // survivors are split proportionally by contribution. We use floor + largest-remainder
  // (like seat allocation in elections) to avoid losing units to rounding.
  // Edge case: the shares[i].q > shares[i].floor check prevents over-allocation.
  const survivorByName = new Map<UnitName, number>(
    result.defenderSurvivors.map(u => [u.name as UnitName, u.quantity])
  );
  const allStacks = [nativeStack, ...supportStacks.map(s => s.units)];
  for (const [name, total] of totalByName) {
    if (total === 0) continue;
    const survived = survivorByName.get(name) ?? 0;
    const shares = allStacks.map(m => {
      const q = m.get(name) ?? 0;
      const exact = (q * survived) / total;
      const floor = Math.floor(exact);
      return { m, q, floor, frac: exact - floor };
    });
    let allocated = shares.reduce((s, x) => s + x.floor, 0);
    let remaining = survived - allocated;
    shares.sort((a, b) => b.frac - a.frac);
    for (let i = 0; remaining > 0 && i < shares.length; i++) {
      if (shares[i].q > shares[i].floor) { shares[i].floor += 1; remaining--; }
    }
    for (const s of shares) s.m.set(name, s.floor);
  }

  const survivorCounts: Partial<Record<UnitName, number>> = {};
  for (const u of result.attackerSurvivors) survivorCounts[u.name as UnitName] = u.quantity;
  const survivorSlowest = getSlowestUnitSpeed(survivorCounts);
  const returnDelayMs   = survivorSlowest > 0
    ? getUnitTravelTimeSec(attackDistance, survivorSlowest, env.gameSpeed) * 1000
    : 0;
  const returnArrivalAt = new Date(Date.now() + returnDelayMs);

  // ── Siege start / replace ───────────────────────────────────────────────────
  // With the new system (Grepolis-style), an attack with a surviving Governor triggers
  // a siege instead of dropping loyalty. If an ACTIVE siege already exists on the city,
  // the new attack (which cleared the current garrison in the battle calculation) breaks
  // it and starts its own — timer reset.
  const govIdx       = result.attackerSurvivors.findIndex(u => u.name === "GOVERNOR");
  const govSurvivors = govIdx >= 0 ? result.attackerSurvivors[govIdx].quantity : 0;
  const attackerWon  = result.attackerSurvivors.some(u => u.quantity > 0);
  const startsSiege  = attackerWon && govSurvivors > 0;

  let newSiegeStarts = false;
  let preexistingSiege = await getActiveSiege(command.toCityId);
  if (startsSiege) {
    const fromCity = await prisma.city.findUnique({
      where:  { id: command.fromCityId },
      select: { ownerId: true },
    });
    if (fromCity?.ownerId) {
      newSiegeStarts = true;
    }
  }

  // Data collected inside the tx, used outside to clean up the BullMQ queues
  const displacedSupportIds:   { id: string; delayMs: number }[] = [];
  let createdSiegeId: string | null = null;
  let createdSiegeEndsAt: Date | null = null;
  let cancelledOldSiegeJobId: string | null | undefined = undefined;

  await prisma.$transaction(async (tx) => {
    // Update the defender's units (native)
    for (const [name, quantity] of nativeStack) {
      await tx.unit.updateMany({
        where: { cityId: command.toCityId, name },
        data:  { quantity },
      });
    }

    // Update each stationed SUPPORT command — distributed losses
    for (const s of supportStacks) {
      for (const [name, quantity] of s.units) {
        await tx.commandUnit.updateMany({
          where: { commandId: s.commandId, name },
          data:  { quantity },
        });
      }
      const stillAlive = Array.from(s.units.values()).some(q => q > 0);
      if (!stillAlive) {
        await tx.command.update({
          where: { id: s.commandId },
          data:  { status: "COMPLETED" },
        });
      }
    }

    // Update the Air Defense level if it was damaged
    if (result.airDefenseLevelsDestroyed > 0) {
      await tx.building.updateMany({
        where: { cityId: command.toCityId, name: "AIR_DEFENSE" },
        data:  { level: result.newAirDefenseLevel },
      });
    }

    // Demolition of the drone target building (PRE-battle, with INITIAL drones, as in TW)
    let buildingLevelsDestroyed = 0;
    let targetBuildingName: string | null = command.targetBuilding;
    let targetBuildingInitialLevel = 0;
    const initialDrones = attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0;
    if (command.targetBuilding && initialDrones > 0) {
      if (command.targetBuilding === "AIR_DEFENSE") {
        // Drones on AIR_DEFENSE: extra damage on top of the one from calcAirDefenseDamage
        targetBuildingInitialLevel = result.newAirDefenseLevel;
        buildingLevelsDestroyed = calcBuildingDamage(result.newAirDefenseLevel, initialDrones, result.battleRatio);
        if (buildingLevelsDestroyed > 0) {
          await tx.building.updateMany({
            where: { cityId: command.toCityId, name: "AIR_DEFENSE" },
            data:  { level: result.newAirDefenseLevel - buildingLevelsDestroyed },
          });
        }
      } else {
        const targetBld = toCity.buildings.find(b => b.name === command.targetBuilding);
        if (targetBld && targetBld.level > 0) {
          targetBuildingInitialLevel = targetBld.level;
          buildingLevelsDestroyed = calcBuildingDamage(targetBld.level, initialDrones, result.battleRatio);
          if (buildingLevelsDestroyed > 0) {
            await tx.building.updateMany({
              where: { cityId: command.toCityId, name: command.targetBuilding },
              data:  { level: { decrement: buildingLevelsDestroyed } },
            });
          }
        }
      }
    }

    // Subtract the stolen resources. Ownership is NO LONGER changed here (the transfer
    // happens only when the siege completes, via siege.worker).
    await tx.city.update({
      where: { id: command.toCityId },
      data: {
        money:  { decrement: result.stolenMoney },
        energy: { decrement: result.stolenEnergy },
        ammo:   { decrement: result.stolenAmmo },
      },
    });

    if (newSiegeStarts) {
      // If an active siege already exists, the battle just cleared its garrison
      // (it was included among the defenders). Close it as BROKEN_BY_NEW_SIEGE.
      if (preexistingSiege) {
        await tx.siege.update({
          where: { id: preexistingSiege.id },
          data:  { status: "BROKEN_BY_NEW_SIEGE" },
        });
        cancelledOldSiegeJobId = preexistingSiege.jobId;
        // Broken garrison: mark the old SUPPORT command as COMPLETED (its units
        // are already at 0 from the support stacks update loop above).
        await tx.command.update({
          where: { id: preexistingSiege.garrisonCommandId },
          data:  { status: "COMPLETED" },
        });
      }

      // Create the SUPPORT/ARRIVED command for the new besieger's garrison
      // (governor + escort survivors). Same structure as legacy-conquest.
      const garrisonUnits = result.attackerSurvivors.filter(u => u.quantity > 0);
      const garrison = await tx.command.create({
        data: {
          type:       "SUPPORT",
          status:     "ARRIVED",
          fromCityId: command.fromCityId,
          toCityId:   command.toCityId,
          arrivalAt:  new Date(),
          attackerUserId: command.attackerUserId,
          // defenderUserId stays the current owner (unchanged); the garrison
          // is a SUPPORT from the attacker toward the defender's city.
          defenderUserId: toCity.ownerId,
          reportHiddenByAttacker: true,
          reportHiddenByDefender: true,
          units: { create: garrisonUnits.map(u => ({ name: u.name, quantity: u.quantity })) },
        },
      });

      // Start the siege.
      const endsAt = new Date(Date.now() + env.siegeDurationMinutes * 60 * 1000);
      const siege = await tx.siege.create({
        data: {
          cityId:            command.toCityId,
          attackerUserId:    command.attackerUserId,
          garrisonCommandId: garrison.id,
          endsAt,
        },
      });
      createdSiegeId     = siege.id;
      createdSiegeEndsAt = endsAt;

      // Empty the ATTACK's CommandUnits — the troops are now in the SUPPORT garrison.
      for (const { name } of result.attackerSurvivors) {
        await tx.commandUnit.updateMany({
          where: { commandId: command.id, name },
          data:  { quantity: 0 },
        });
      }
    } else {
      // Normal battle: survivors head home with the loot.
      for (const { name, quantity } of result.attackerSurvivors) {
        await tx.commandUnit.updateMany({
          where: { commandId: command.id, name },
          data:  { quantity },
        });
      }
    }

    // Detect "defender broke the siege through this attack" — if an ACTIVE siege
    // already exists that wasn't replaced, and its garrison (a SUPPORT in supportStacks)
    // reached 0 units, mark the siege as BROKEN_BY_DEFENSE.
    let oldSiegeBroken = false;
    if (preexistingSiege && !newSiegeStarts) {
      const garrisonStack = supportStacks.find(s => s.commandId === preexistingSiege!.garrisonCommandId);
      if (garrisonStack) {
        const stillAlive = Array.from(garrisonStack.units.values()).some(q => q > 0);
        if (!stillAlive) {
          await tx.siege.update({
            where: { id: preexistingSiege.id },
            data:  { status: "BROKEN_BY_DEFENSE" },
          });
          cancelledOldSiegeJobId = preexistingSiege.jobId;
          oldSiegeBroken = true;
        }
      }
    }
    if (newSiegeStarts && preexistingSiege) {
      oldSiegeBroken = true;
    }

    // Siege defense report: notify the besieger about the attack on their garrison.
    if (preexistingSiege && preexistingSiege.attackerUserId !== command.attackerUserId) {
      await tx.command.create({
        data: {
          type:           "ATTACK",
          status:         "COMPLETED",
          fromCityId:     command.fromCityId,
          toCityId:       command.toCityId,
          arrivalAt:      new Date(),
          attackerUserId: command.attackerUserId,
          defenderUserId: preexistingSiege.attackerUserId,
          report: {
            siegeDefenseReport: true,
            siegeBroken:                oldSiegeBroken,
            siegeId:                    preexistingSiege.id,
            attackerWon,
            attackerInitial:            attackerUnits,
            attackerSurvivors:          result.attackerSurvivors,
            defenderInitial:            defenderUnits,
            defenderSurvivors:          result.defenderSurvivors,
            airDefenseInitialLevel:     airDefenseLevel,
            airDefenseLevelsDestroyed:  result.airDefenseLevelsDestroyed,
            newAirDefenseLevel:         result.newAirDefenseLevel,
            stolenMoney: 0,
            stolenEnergy: 0,
            stolenAmmo: 0,
            battleAt:                   new Date().toISOString(),
          } as any,
        },
      });
    }

    const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
    // If the attack started a siege, the troops stay in the garrison (the ATTACK command is finished).
    // Otherwise, if they survived, schedule the return.
    const finalStatus    = newSiegeStarts ? "COMPLETED" : (hasSurvivors ? "RETURNING" : "COMPLETED");
    const finalArrivalAt = (!newSiegeStarts && hasSurvivors) ? returnArrivalAt : command.arrivalAt;

    await tx.command.update({
      where: { id: command.id },
      data: {
        status:         finalStatus,
        arrivalAt:      finalArrivalAt,
        resourceMoney:  result.stolenMoney,
        resourceEnergy: result.stolenEnergy,
        resourceAmmo:   result.stolenAmmo,
        // The report is stored as JSON (Prisma JsonValue). Typed as `any` because Prisma
        // doesn't support a discriminated union on JSON fields. The proper fix would be a
        // separate BattleReport table, but JSON keeps the queries simple and avoids joins.
        // YAGNI — I don't need queries on individual fields of the report.
        report: {
          ...result,
          siegeStarted: newSiegeStarts,
          siegeId:      createdSiegeId, // null when no siege started; UI uses this to enable "Share siege"
          attackerInitial:        attackerUnits,
          defenderInitial:        defenderUnits,
          airDefenseInitialLevel: airDefenseLevel,
          targetBuilding:              targetBuildingName,
          targetBuildingInitialLevel,
          buildingLevelsDestroyed,
          battleAt:               new Date().toISOString(),
        } as any,
      },
    });
  });

  // ── Leaderboard stats ─────────────────────────────────────────────────────
  // We compute kills and loot after the transaction (non-critical, fire-and-forget)
  try {
    // Attacker kills = defender casualties weighted by population
    let attackerKills = 0;
    for (const u of defenderUnits) {
      const survived = result.defenderSurvivors.find(s => s.name === u.name)?.quantity ?? 0;
      const lost = u.quantity - survived;
      attackerKills += lost * (UNITS[u.name]?.population ?? 1);
    }
    // Defender kills = attacker casualties weighted by population
    let totalDefKills = 0;
    for (const u of attackerUnits) {
      const survived = result.attackerSurvivors.find(s => s.name === u.name)?.quantity ?? 0;
      const lost = u.quantity - survived;
      totalDefKills += lost * (UNITS[u.name]?.population ?? 1);
    }

    // Attacker: kills + loot
    await prisma.user.update({
      where: { id: command.attackerUserId },
      data: {
        killsAsAttacker: { increment: attackerKills },
        lootedMoney:     { increment: result.stolenMoney },
        lootedEnergy:    { increment: result.stolenEnergy },
        lootedAmmo:      { increment: result.stolenAmmo },
      },
    });

    // Distribute the defensive kills proportionally between the defender (native) and supporters
    if (totalDefKills > 0) {
      // Total initial units per stack weighted by population
      let nativeTotal = 0;
      for (const [name, q] of nativeStack) nativeTotal += q * (UNITS[name]?.population ?? 1);
      const supportTotals = supportStacks.map(s => {
        let total = 0;
        for (const [name, q] of s.units) total += q * (UNITS[name]?.population ?? 1);
        return { userId: s.userId, total };
      });
      const grandTotal = nativeTotal + supportTotals.reduce((s, x) => s + x.total, 0);

      if (grandTotal > 0) {
        // Defender owner gets kills proportional to native units
        const defenderUserId = toCity.ownerId;
        const nativeKills = Math.round((nativeTotal / grandTotal) * totalDefKills);
        if (defenderUserId && nativeKills > 0) {
          await prisma.user.update({
            where: { id: defenderUserId },
            data:  { killsAsDefender: { increment: nativeKills } },
          });
        }

        // Each supporter gets kills proportional to their units
        // Group by userId in case multiple support commands from same player
        const supporterKillMap = new Map<string, number>();
        for (const { userId, total } of supportTotals) {
          if (total <= 0) continue;
          const kills = Math.round((total / grandTotal) * totalDefKills);
          if (kills > 0) supporterKillMap.set(userId, (supporterKillMap.get(userId) ?? 0) + kills);
        }
        for (const [userId, kills] of supporterKillMap) {
          await prisma.user.update({
            where: { id: userId },
            data:  { killsAsSupporter: { increment: kills } },
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to update combat stats:", e);
  }

  // Schedule the return if units survived AND the attack didn't start a siege.
  // (When a siege starts the troops stay as the garrison, so they don't go anywhere.)
  const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
  if (hasSurvivors && !newSiegeStarts) {
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelayMs });
  }

  // Cancel the old timer job (siege broken or replaced) and schedule the new one.
  if (cancelledOldSiegeJobId) await cancelSiegeJob(cancelledOldSiegeJobId);
  if (createdSiegeId && createdSiegeEndsAt) {
    await scheduleSiegeExpiry(createdSiegeId, createdSiegeEndsAt);
  }
}

// ─── Spying: hacker vs hacker (Grepolis-style) ───────────────────────────────
// Mechanism:
//   - the attacker sends N hackers, the target city has D hackers (native + stationed).
//   - the attacker ALWAYS loses all N sent hackers (the silver is consumed regardless).
//   - Success (N > D): the defender loses 0 hackers and is NOT notified. A snapshot is generated.
//   - Failure (N ≤ D): the defender loses N hackers and gets a report that they were spied on.
//
// Strategies: (1) send a large attack to be sure you get in without notification,
//             (2) send small waves to drain the defender's hackers.

async function processSpyArrival(command: CommandWithUnits) {
  const toCity = await prisma.city.findUnique({
    where:   { id: command.toCityId },
    include: { units: true, buildings: { orderBy: { name: "asc" } } },
  });
  if (!toCity) return;

  const attackerHackers = command.units
    .filter(u => u.name === "HACKER")
    .reduce((s, u) => s + u.quantity, 0);

  const nativeDefenders = toCity.units
    .filter(u => u.name === "HACKER")
    .reduce((s, u) => s + u.quantity, 0);

  const stationedSupports = await prisma.command.findMany({
    where:   { toCityId: command.toCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
  });
  const supportDefenders = stationedSupports.reduce((s, c) => {
    for (const u of c.units) if (u.name === "HACKER") s += u.quantity;
    return s;
  }, 0);

  const defenderHackers = nativeDefenders + supportDefenders;
  const success = attackerHackers > defenderHackers;

  // The attacker ALWAYS loses all sent hackers (the silver is consumed).
  // Success (N > D): the defender loses 0, is not notified.
  // Failure (N ≤ D): the defender loses N hackers, is notified.
  const attackerSurvivors    = 0;
  const defenderHackerLosses = success ? 0 : attackerHackers;

  let snapshot: {
    buildings: { name: string; level: number }[];
    units: { name: UnitName; quantity: number }[];
    resources: { money: number; energy: number; ammo: number };
  } | null = null;
  if (success) {
    await syncResources(command.toCityId);
    const freshCity = await prisma.city.findUnique({
      where: { id: command.toCityId },
      select: { money: true, energy: true, ammo: true },
    });

    const unitTotals = new Map<UnitName, number>();
    for (const u of toCity.units) {
      if (u.quantity > 0) unitTotals.set(u.name as UnitName, (unitTotals.get(u.name as UnitName) ?? 0) + u.quantity);
    }
    for (const c of stationedSupports) {
      for (const u of c.units) {
        if (u.quantity > 0) unitTotals.set(u.name as UnitName, (unitTotals.get(u.name as UnitName) ?? 0) + u.quantity);
      }
    }
    snapshot = {
      buildings: toCity.buildings.map(b => ({ name: b.name, level: b.level })),
      units:     Array.from(unitTotals.entries()).map(([name, quantity]) => ({ name, quantity })),
      resources: {
        money:  Math.floor(freshCity?.money  ?? 0),
        energy: Math.floor(freshCity?.energy ?? 0),
        ammo:   Math.floor(freshCity?.ammo   ?? 0),
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.commandUnit.updateMany({
      where: { commandId: command.id, name: "HACKER" },
      data:  { quantity: 0 },
    });

    // On failure, the defender loses N hackers — distribute proportionally native/support
    if (defenderHackerLosses > 0) {
      let lossesLeft = defenderHackerLosses;
      const nativeLoss = defenderHackers > 0
        ? Math.min(nativeDefenders, Math.round((nativeDefenders / defenderHackers) * defenderHackerLosses))
        : 0;
      const actualNativeLoss = Math.min(nativeLoss, lossesLeft);
      if (actualNativeLoss > 0) {
        await tx.unit.updateMany({
          where: { cityId: command.toCityId, name: "HACKER" },
          data:  { quantity: nativeDefenders - actualNativeLoss },
        });
        lossesLeft -= actualNativeLoss;
      }
      for (const sc of stationedSupports) {
        if (lossesLeft <= 0) break;
        const had = sc.units.filter(u => u.name === "HACKER").reduce((s, u) => s + u.quantity, 0);
        if (had <= 0) continue;
        const stackLoss = Math.min(had, defenderHackers > 0
          ? Math.round((had / defenderHackers) * defenderHackerLosses)
          : lossesLeft);
        const actual = Math.min(stackLoss, lossesLeft);
        if (actual > 0) {
          await tx.commandUnit.updateMany({
            where: { commandId: sc.id, name: "HACKER" },
            data:  { quantity: had - actual },
          });
          lossesLeft -= actual;
        }
      }
      if (lossesLeft > 0) {
        const currentNative = nativeDefenders - actualNativeLoss;
        if (currentNative > 0) {
          const take = Math.min(currentNative, lossesLeft);
          await tx.unit.updateMany({
            where: { cityId: command.toCityId, name: "HACKER" },
            data:  { quantity: currentNative - take },
          });
        }
      }
    }

    await tx.command.update({
      where: { id: command.id },
      data: {
        status:    "COMPLETED",
        reportHiddenByDefender: success,
        report: {
          spyReport:       true,
          success,
          attackerHackers,
          defenderHackers,
          defenderHackerLosses,
          attackerSurvivors,
          snapshot,
          battleAt:          new Date().toISOString(),
        } as any,
      },
    });
  });

  try {
    const hackerPop = UNITS.HACKER?.population ?? 1;
    if (attackerHackers > 0 && toCity.ownerId) {
      await prisma.user.update({
        where: { id: toCity.ownerId },
        data:  { killsAsDefender: { increment: attackerHackers * hackerPop } },
      });
    }
    if (defenderHackerLosses > 0 && command.attackerUserId) {
      await prisma.user.update({
        where: { id: command.attackerUserId },
        data:  { killsAsAttacker: { increment: defenderHackerLosses * hackerPop } },
      });
    }
  } catch (e) {
    console.error("Failed to update spy stats:", e);
  }
}

// ─── Return home ──────────────────────────────────────────────────────────────

async function processReturn(commandId: string) {
  const command = await prisma.command.findUnique({
    where:   { id: commandId },
    include: { units: true },
  });
  if (!command || command.status !== "RETURNING") return;

  // If the home city is under siege, the returning troops automatically ATTACK the besieger
  // (confirmed rule: returning units auto-engage). The resources are added to the city
  // normally (they'll be the besieger's loot if it conquers).
  let unitsToReturn = command.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity }));
  const totalReturning = unitsToReturn.reduce((s, u) => s + u.quantity, 0);
  if (totalReturning > 0 && await isCityBesieged(command.fromCityId)) {
    const { attackerSurvivors } = await resolveAttackOnBesiegedCity({
      attackerUnits:  unitsToReturn,
      toCityId:       command.fromCityId,
      attackerUserId: command.attackerUserId,
      fromCityId:     command.fromCityId,
    });
    unitsToReturn = attackerSurvivors;
  }

  await prisma.$transaction(async (tx) => {
    // Add the surviving units back into the source city
    for (const { name, quantity } of unitsToReturn) {
      if (quantity <= 0) continue;
      await tx.unit.updateMany({
        where: { cityId: command.fromCityId, name },
        data:  { quantity: { increment: quantity } },
      });
    }

    // Add the stolen resources to the source city
    if (command.resourceMoney > 0 || command.resourceEnergy > 0 || command.resourceAmmo > 0) {
      await tx.city.update({
        where: { id: command.fromCityId },
        data: {
          money:  { increment: command.resourceMoney },
          energy: { increment: command.resourceEnergy },
          ammo:   { increment: command.resourceAmmo },
        },
      });
    }

    await tx.command.update({
      where: { id: command.id },
      data:  { status: "COMPLETED" },
    });
  });
}
