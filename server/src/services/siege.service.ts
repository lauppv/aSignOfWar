import prisma from "../config/db";
import type { Prisma } from "@prisma/client";
import { commandQueue, buildingQueue, recruitmentQueue, siegeQueue } from "../config/queue";
import {
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
} from "../../../shared/gameConfig";
import { calculateBattle } from "../../../shared/battleCalc";
import env from "../config/env";
import { UnitName } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// ─── Shared siege links ─────────────────────────────────────────────────────
// Mirrors SharedReport: a user creates a share link tied to a specific siege; recipients
// (anyone logged-in) fetch the live siege state by the share id and embed it in messages
// using the [siege:<id>] tag. No visibility options — siege state is public-by-design between
// the two sides; the share link just lets allies/observers see it without authz.
export const createSharedSiege = async (siegeId: string, userId: string) => {
  const siege = await prisma.siege.findUnique({
    where:  { id: siegeId },
    select: { id: true, attackerUserId: true, cityId: true },
  });
  if (!siege) throw new Error("SIEGE_NOT_FOUND");

  // Authorization: only people who can see the siege-status (attacker, defender, alliance
  // members of either side) can create a share link.
  const city = await prisma.city.findUnique({ where: { id: siege.cityId }, select: { ownerId: true } });
  let allowed = siege.attackerUserId === userId || city?.ownerId === userId;
  if (!allowed) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
    if (me?.allianceId) {
      const att = await prisma.user.findUnique({ where: { id: siege.attackerUserId }, select: { allianceId: true } });
      if (att?.allianceId === me.allianceId) allowed = true;
      if (!allowed && city?.ownerId) {
        const def = await prisma.user.findUnique({ where: { id: city.ownerId }, select: { allianceId: true } });
        if (def?.allianceId === me.allianceId) allowed = true;
      }
    }
  }
  if (!allowed) throw new Error("UNAUTHORIZED");

  const shared = await prisma.sharedSiege.create({
    data: { siegeId, userId },
  });
  return shared.id;
};

// Returns the siege state by share id. Auth: any logged-in user with the share id.
// Status payload mirrors getSiegeStatusForCity but adds historical metadata (when the siege
// ended, why, who was the attacker/defender) so a stale link still renders meaningfully.
export const getSharedSiege = async (shareId: string) => {
  const shared = await prisma.sharedSiege.findUnique({
    where:   { id: shareId },
    include: {
      user:  { select: { id: true, username: true } },
      siege: {
        include: {
          attacker:        { select: { id: true, username: true } },
          city:            { select: { id: true, name: true, x: true, y: true, owner: { select: { id: true, username: true } } } },
          garrisonCommand: { include: { units: true } },
        },
      },
    },
  });
  if (!shared) throw new Error("SHARED_SIEGE_NOT_FOUND");

  const s = shared.siege;
  // For ACTIVE sieges, fetch the current live state (defenders + incoming commands).
  let live: { defendingForce: { name: string; quantity: number }[]; incomingCommands: any[] } | null = null;
  if (s.status === "ACTIVE") {
    const [cityUnits, allSupports, incoming] = await Promise.all([
      prisma.unit.findMany({ where: { cityId: s.cityId, quantity: { gt: 0 } } }),
      prisma.command.findMany({
        where:   { toCityId: s.cityId, type: "SUPPORT", status: "ARRIVED" },
        include: { units: true },
      }),
      prisma.command.findMany({
        where:   { toCityId: s.cityId, status: "TRAVELING" },
        include: { units: { select: { name: true, quantity: true } }, fromCity: { select: { name: true, owner: { select: { username: true } } } } },
        orderBy: { arrivalAt: "asc" },
      }),
    ]);
    const totals = new Map<string, number>();
    for (const u of cityUnits) totals.set(u.name, (totals.get(u.name) ?? 0) + u.quantity);
    for (const sc of allSupports) {
      for (const u of sc.units) totals.set(u.name, (totals.get(u.name) ?? 0) + u.quantity);
    }
    live = {
      defendingForce: Array.from(totals.entries()).filter(([, q]) => q > 0).map(([name, quantity]) => ({ name, quantity })),
      incomingCommands: incoming.filter(c => c.type !== "SPY").map(c => ({
        id:            c.id,
        type:          c.type,
        fromCityName:  c.fromCity.name,
        fromOwnerName: c.fromCity.owner?.username ?? null,
        arrivalAt:     c.arrivalAt.toISOString(),
        units:         c.type === "ATTACK" ? [] : c.units,
      })),
    };
  }

  return {
    shareId:    shared.id,
    sharedBy:   shared.user,
    sharedAt:   shared.createdAt.toISOString(),
    siege: {
      id:        s.id,
      status:    s.status,
      startedAt: s.startedAt.toISOString(),
      endsAt:    s.endsAt.toISOString(),
      attacker:  s.attacker,
      defender:  s.city.owner,
      city:      { id: s.city.id, name: s.city.name, x: s.city.x, y: s.city.y },
    },
    live,
  };
};

// Public siege state shape returned by the siege-status endpoint and consumed by the SiegeCard.
// Both attacker and defender (and their alliance members) get the same payload.
export type SiegeStatusPayload = {
  active: boolean;
  endsAt: string | null;
  attacker: { userId: string; username: string } | null;
  defender: { userId: string; username: string } | null;
  // Aggregated besieger garrison units (counts only — not their composition by stack).
  defendingForce: { name: string; quantity: number }[];
  // Live incoming attacks/supports on the besieged city. Composition hidden for ATTACK/SPY,
  // visible for SUPPORT/RESOURCES.
  incomingCommands: {
    id: string;
    type: string;
    fromCityName: string;
    fromOwnerName: string | null;
    arrivalAt: string;
    units: { name: string; quantity: number }[];
  }[];
};

export const getSiegeStatusForCity = async (cityId: string, userId: string): Promise<SiegeStatusPayload> => {
  const city = await prisma.city.findUnique({
    where:  { id: cityId },
    select: { id: true, ownerId: true },
  });
  if (!city) throw new Error("CITY_NOT_FOUND");

  const siege = await prisma.siege.findFirst({
    where:   { cityId, status: "ACTIVE" },
    include: {
      attacker:        { select: { id: true, username: true, allianceId: true } },
      garrisonCommand: { include: { units: true } },
    },
  });

  // Authorization: own city, besieger, or alliance member of either side.
  let allowed = city.ownerId === userId;
  if (!allowed && siege) {
    if (siege.attackerUserId === userId) {
      allowed = true;
    } else {
      // Check alliance membership match with attacker or defender owner.
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
      if (me?.allianceId) {
        if (siege.attacker.allianceId && siege.attacker.allianceId === me.allianceId) allowed = true;
        if (city.ownerId) {
          const def = await prisma.user.findUnique({ where: { id: city.ownerId }, select: { allianceId: true } });
          if (def?.allianceId === me.allianceId) allowed = true;
        }
      }
    }
  }
  if (!allowed) throw new Error("UNAUTHORIZED");

  if (!siege) {
    return { active: false, endsAt: null, attacker: null, defender: null, defendingForce: [], incomingCommands: [] };
  }

  // Aggregate the entire defending force for the besieged city: city.units + ALL stationed
  // SUPPORT (which includes besieger garrison + any other stack defending). For the siege card
  // we surface this as one number per unit type — composition by stack is intentional noise.
  const [cityUnits, allSupports, incoming, defenderUser] = await Promise.all([
    prisma.unit.findMany({ where: { cityId, quantity: { gt: 0 } } }),
    prisma.command.findMany({
      where:   { toCityId: cityId, type: "SUPPORT", status: "ARRIVED" },
      include: { units: true },
    }),
    prisma.command.findMany({
      where:   { toCityId: cityId, status: "TRAVELING" },
      include: { units: { select: { name: true, quantity: true } }, fromCity: { select: { name: true, owner: { select: { username: true } } } } },
      orderBy: { arrivalAt: "asc" },
    }),
    city.ownerId
      ? prisma.user.findUnique({ where: { id: city.ownerId }, select: { id: true, username: true } })
      : Promise.resolve(null),
  ]);

  const totals = new Map<string, number>();
  for (const u of cityUnits) totals.set(u.name, (totals.get(u.name) ?? 0) + u.quantity);
  for (const sc of allSupports) {
    for (const u of sc.units) totals.set(u.name, (totals.get(u.name) ?? 0) + u.quantity);
  }
  const defendingForce = Array.from(totals.entries())
    .filter(([, q]) => q > 0)
    .map(([name, quantity]) => ({ name, quantity }));

  // SPY e complet invizibil pentru apărător. ATTACK: ascundem compoziția.
  const sanitizedIncoming = incoming
    .filter(c => c.type !== "SPY")
    .map(c => ({
      id:            c.id,
      type:          c.type,
      fromCityName:  c.fromCity.name,
      fromOwnerName: c.fromCity.owner?.username ?? null,
      arrivalAt:     c.arrivalAt.toISOString(),
      units:         c.type === "ATTACK" ? [] : c.units,
    }));

  return {
    active:           true,
    endsAt:           siege.endsAt.toISOString(),
    attacker:         { userId: siege.attacker.id, username: siege.attacker.username },
    defender:         defenderUser ? { userId: defenderUser.id, username: defenderUser.username } : null,
    defendingForce,
    incomingCommands: sanitizedIncoming,
  };
};

// Returns the active siege for a city (or null). One row per (cityId, status=ACTIVE)
// is enforced by code paths in this module — the schema can't enforce a partial
// unique constraint, so all siege creation goes through startSiege() which checks first.
export const getActiveSiege = async (cityId: string) => {
  return prisma.siege.findFirst({
    where: { cityId, status: "ACTIVE" },
  });
};

export const isCityBesieged = async (cityId: string): Promise<boolean> => {
  const s = await prisma.siege.findFirst({
    where:  { cityId, status: "ACTIVE" },
    select: { id: true },
  });
  return s !== null;
};

// Start a new siege. Caller must ensure no other ACTIVE siege exists on the city
// (use replaceSiege if there is one). garrisonCommand must be a SUPPORT/ARRIVED command
// holding the besieger's surviving force (governor + escort).
export const startSiege = async (
  tx: Tx,
  args: {
    cityId: string;
    attackerUserId: string;
    garrisonCommandId: string;
  }
) => {
  const endsAt = new Date(Date.now() + env.siegeDurationMinutes * 60 * 1000);
  return tx.siege.create({
    data: {
      cityId:            args.cityId,
      attackerUserId:    args.attackerUserId,
      garrisonCommandId: args.garrisonCommandId,
      endsAt,
    },
  });
};

// Schedule the BullMQ timer for siege expiry. Done after the transaction so we don't
// have a job pointing at a row that may have rolled back.
export const scheduleSiegeExpiry = async (siegeId: string, endsAt: Date) => {
  const delay = Math.max(0, endsAt.getTime() - Date.now());
  const job = await siegeQueue.add("expire", { siegeId }, { delay });
  await prisma.siege.update({
    where: { id: siegeId },
    data:  { jobId: String(job.id) },
  });
};

// Mark an active siege as ended (defender broke it, or replaced by a stronger attacker).
// Removes the BullMQ job so the timer doesn't fire on a dead siege.
export const endSiege = async (
  tx: Tx,
  siegeId: string,
  reason: "BROKEN_BY_DEFENSE" | "BROKEN_BY_NEW_SIEGE" | "COMPLETED_CONQUEST"
) => {
  const siege = await tx.siege.findUnique({ where: { id: siegeId } });
  if (!siege) return null;
  await tx.siege.update({
    where: { id: siegeId },
    data:  { status: reason },
  });
  return siege;
};

// Cancel the BullMQ timer for a siege (called after endSiege from outside the tx).
export const cancelSiegeJob = async (jobId: string | null | undefined) => {
  if (!jobId) return;
  const j = await siegeQueue.getJob(jobId);
  if (j) await j.remove();
};

// Total surviving units in the besieger's garrison. Sum across the garrison command's units.
// Note: chained sieges keep separate Siege rows; only the ACTIVE one's garrison counts.
export const garrisonSize = async (siegeId: string): Promise<number> => {
  const siege = await prisma.siege.findUnique({
    where:   { id: siegeId },
    include: { garrisonCommand: { include: { units: true } } },
  });
  if (!siege) return 0;
  return siege.garrisonCommand.units.reduce((s, u) => s + u.quantity, 0);
};

// Complete a successful conquest — transfer ownership, consume governor, displace third-party
// supports, cancel build/recruit orders. Mirrors the legacy "conquered" path that used to live
// in command.worker.ts but split out so both timer expiry and direct conquest paths reuse it.
export const completeConquest = async (siegeId: string): Promise<void> => {
  const siege = await prisma.siege.findUnique({
    where:   { id: siegeId },
    include: {
      garrisonCommand: { include: { units: true, fromCity: { select: { x: true, y: true } } } },
      city:            { select: { id: true, x: true, y: true, ownerId: true, name: true } },
    },
  });
  if (!siege || siege.status !== "ACTIVE") return;

  const newOwnerId = siege.attackerUserId;
  const prevOwnerId = siege.city.ownerId;

  // Pre-tx data we need for queue cleanup after commit.
  let cancelledBuildingJobIds: string[] = [];
  let cancelledRecruitJobIds:  string[] = [];
  const displacedSupportIds:   { id: string; delayMs: number }[] = [];

  await prisma.$transaction(async (tx) => {
    // 1. Consume one governor from the garrison command.
    const govUnit = siege.garrisonCommand.units.find(u => u.name === "GOVERNOR");
    if (govUnit && govUnit.quantity > 0) {
      await tx.commandUnit.update({
        where: { id: govUnit.id },
        data:  { quantity: govUnit.quantity - 1 },
      });
    }

    // 2. Transfer ownership.
    await tx.city.update({
      where: { id: siege.cityId },
      data:  { ownerId: newOwnerId },
    });

    // 3. Reset native units of the city to 0 (recruited-during-siege units belonged to defender,
    //    they don't follow the city to its new owner; this matches the legacy conquest behavior).
    await tx.unit.updateMany({
      where: { cityId: siege.cityId },
      data:  { quantity: 0 },
    });

    // 4. Cancel pending build/recruit orders (no refund — it's war).
    const buildingOrders = await tx.buildingUpgradeOrder.findMany({
      where: { cityId: siege.cityId }, select: { id: true, jobId: true },
    });
    cancelledBuildingJobIds = buildingOrders.map(o => o.jobId).filter((x): x is string => x != null);
    await tx.buildingUpgradeOrder.deleteMany({ where: { cityId: siege.cityId } });

    const recruitOrders = await tx.recruitmentOrder.findMany({
      where: { cityId: siege.cityId }, select: { id: true, jobId: true },
    });
    cancelledRecruitJobIds = recruitOrders.map(o => o.jobId).filter((x): x is string => x != null);
    await tx.recruitmentOrder.deleteMany({ where: { cityId: siege.cityId } });

    // 5. Cancel outgoing RESOURCES commands (they evaporate — same as legacy).
    const cancelledResourceCmds = await tx.command.findMany({
      where:  { fromCityId: siege.cityId, type: "RESOURCES", status: "TRAVELING" },
      select: { id: true },
    });
    const cancelledResourceIds = cancelledResourceCmds.map(c => c.id);
    if (cancelledResourceIds.length > 0) {
      await tx.commandUnit.deleteMany({ where: { commandId: { in: cancelledResourceIds } } });
      await tx.command.deleteMany({ where: { id: { in: cancelledResourceIds } } });
    }

    // 6. Displace third-party supports (anyone NOT the attacker who has SUPPORT/ARRIVED here).
    //    The attacker's garrison command stays — it's now the new owner's own troops.
    const stationedSurvivors = await tx.command.findMany({
      where: {
        toCityId: siege.cityId,
        type:     "SUPPORT",
        status:   "ARRIVED",
        attackerUserId: { not: newOwnerId },
      },
      include: { units: true, fromCity: { select: { x: true, y: true } } },
    });
    for (const sc of stationedSurvivors) {
      const counts: Partial<Record<UnitName, number>> = {};
      for (const u of sc.units) counts[u.name as UnitName] = (counts[u.name as UnitName] ?? 0) + u.quantity;
      const slowest = getSlowestUnitSpeed(counts);
      const dist    = getFieldDistance(sc.fromCity.x, sc.fromCity.y, siege.city.x, siege.city.y);
      const ms      = slowest > 0 ? getUnitTravelTimeSec(dist, slowest, env.gameSpeed) * 1000 : 0;
      await tx.command.update({
        where: { id: sc.id },
        data:  { status: "RETURNING", arrivalAt: new Date(Date.now() + ms) },
      });
      displacedSupportIds.push({ id: sc.id, delayMs: ms });
    }

    // 7. Update garrison command's ownership flags so the new owner sees it as their own SUPPORT.
    await tx.command.update({
      where: { id: siege.garrisonCommandId },
      data:  { defenderUserId: newOwnerId },
    });

    // 8. Mark siege COMPLETED_CONQUEST.
    await tx.siege.update({
      where: { id: siege.id },
      data:  { status: "COMPLETED_CONQUEST" },
    });

    // 9. Create a "conquest completed" report visible to both sides. Modeled as a Command
    //    with type=ATTACK, status=COMPLETED, and a special report flag — this way the existing
    //    Reports list query (which filters Commands by attackerUserId/defenderUserId) picks it
    //    up automatically for both parties without any new schema. The siegeId in the report
    //    powers the "Share siege" button on the resulting card.
    await tx.command.create({
      data: {
        type:           "ATTACK",
        status:         "COMPLETED",
        fromCityId:     siege.garrisonCommand.fromCityId, // attacker's source city for the original conquest attack
        toCityId:       siege.cityId,
        arrivalAt:      new Date(),
        attackerUserId: newOwnerId,
        defenderUserId: prevOwnerId,
        report: {
          conquestCompleted: true,
          siegeId:           siege.id,
          siegeStartedAt:    siege.startedAt.toISOString(),
          siegeEndedAt:      new Date().toISOString(),
          conqueredCityName: siege.city.name,
          battleAt:          new Date().toISOString(),
        } as any,
      },
    });
  });

  // Queue cleanup post-tx.
  for (const jobId of cancelledBuildingJobIds) {
    const j = await buildingQueue.getJob(jobId); if (j) await j.remove();
  }
  for (const jobId of cancelledRecruitJobIds) {
    const j = await recruitmentQueue.getJob(jobId); if (j) await j.remove();
  }
  for (const { id, delayMs } of displacedSupportIds) {
    await commandQueue.add("return", { commandId: id }, { delay: delayMs });
  }
};

// ─── Auto-battle: arriving force attacks besieger garrison ──────────────────
// Cand o comanda de SUPPORT ajunge pe un oras asediat, sau cand trupe se intorc
// acasa la un oras asediat, se aruncă imediat in lupta cu garnizoana besieger-ului.
// Defenderii = garnizoana besieger-ului + alte SUPPORT-uri stationate + city.units.
// Atacatorii = unitatile care sosesc.
// Returneaza supravietuitorii atacatorului si daca siege-ul a fost spart.
export const resolveAttackOnBesiegedCity = async (args: {
  attackerUnits: { name: UnitName; quantity: number }[];
  toCityId: string;
  attackerUserId: string;
  fromCityId: string;
}): Promise<{ attackerSurvivors: { name: UnitName; quantity: number }[]; siegeBroken: boolean }> => {
  const { attackerUnits, toCityId } = args;

  const totalAttacker = attackerUnits.reduce((s, u) => s + u.quantity, 0);
  if (totalAttacker === 0) return { attackerSurvivors: [], siegeBroken: false };

  const toCity = await prisma.city.findUnique({
    where:   { id: toCityId },
    include: { units: true, buildings: true },
  });
  if (!toCity) return { attackerSurvivors: attackerUnits, siegeBroken: false };

  const activeSiege = await prisma.siege.findFirst({ where: { cityId: toCityId, status: "ACTIVE" } });
  if (!activeSiege) {
    // Race: siege ended between caller's check and now → just return units intact.
    return { attackerSurvivors: attackerUnits, siegeBroken: false };
  }

  const stationedSupports = await prisma.command.findMany({
    where:   { toCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
  });

  const airDefenseLevel = toCity.buildings.find(b => b.name === "AIR_DEFENSE")?.level ?? 0;

  // Aggregate defenders.
  const nativeStack = new Map<UnitName, number>(toCity.units.map(u => [u.name, u.quantity]));
  const supportStacks = stationedSupports.map(sc => ({
    commandId: sc.id,
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
  );

  // Distribute defender losses across nativeStack + supportStacks (largest-remainder).
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

  let siegeBroken = false;
  let cancelledJobId: string | null | undefined = undefined;

  await prisma.$transaction(async (tx) => {
    // Apply losses to native units.
    for (const [name, quantity] of nativeStack) {
      await tx.unit.updateMany({ where: { cityId: toCityId, name }, data: { quantity } });
    }
    // Apply losses to each support stack.
    for (const s of supportStacks) {
      for (const [name, quantity] of s.units) {
        await tx.commandUnit.updateMany({ where: { commandId: s.commandId, name }, data: { quantity } });
      }
      const stillAlive = Array.from(s.units.values()).some(q => q > 0);
      if (!stillAlive) {
        await tx.command.update({ where: { id: s.commandId }, data: { status: "COMPLETED" } });
      }
    }

    // AD damage.
    if (result.airDefenseLevelsDestroyed > 0) {
      await tx.building.updateMany({
        where: { cityId: toCityId, name: "AIR_DEFENSE" },
        data:  { level: result.newAirDefenseLevel },
      });
    }

    // Detect siege broken: garrison command's units all 0 now.
    const garrisonStack = supportStacks.find(s => s.commandId === activeSiege.garrisonCommandId);
    if (garrisonStack) {
      const stillAlive = Array.from(garrisonStack.units.values()).some(q => q > 0);
      if (!stillAlive) {
        await tx.siege.update({
          where: { id: activeSiege.id },
          data:  { status: "BROKEN_BY_DEFENSE" },
        });
        cancelledJobId = activeSiege.jobId;
        siegeBroken = true;
      }
    }

    // Siege defense report: notify the besieger about the attack on their garrison.
    if (activeSiege.attackerUserId !== args.attackerUserId) {
      await tx.command.create({
        data: {
          type:           "ATTACK",
          status:         "COMPLETED",
          fromCityId:     args.fromCityId,
          toCityId,
          arrivalAt:      new Date(),
          attackerUserId: args.attackerUserId,
          defenderUserId: activeSiege.attackerUserId,
          report: {
            siegeDefenseReport: true,
            siegeBroken,
            siegeId:                  activeSiege.id,
            attackerWon:              result.attackerSurvivors.some(u => u.quantity > 0),
            attackerInitial:          attackerUnits,
            attackerSurvivors:        result.attackerSurvivors,
            defenderInitial:          defenderUnits,
            defenderSurvivors:        result.defenderSurvivors,
            airDefenseInitialLevel:   airDefenseLevel,
            airDefenseLevelsDestroyed: result.airDefenseLevelsDestroyed,
            newAirDefenseLevel:       result.newAirDefenseLevel,
            stolenMoney: 0,
            stolenEnergy: 0,
            stolenAmmo: 0,
            battleAt:                 new Date().toISOString(),
          } as any,
        },
      });
    }
  });

  if (cancelledJobId) await cancelSiegeJob(cancelledJobId);

  const attackerSurvivors = result.attackerSurvivors.map(u => ({
    name: u.name as UnitName,
    quantity: u.quantity,
  }));
  return { attackerSurvivors, siegeBroken };
};
