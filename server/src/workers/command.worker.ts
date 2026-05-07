import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import prisma from "../config/db";
import { commandQueue, buildingQueue, recruitmentQueue } from "../config/queue";
import { calculateBattle } from "../services/battle.service";
import {
  UNITS,
  getFieldDistance,
  getSlowestUnitSpeed,
  getUnitTravelTimeSec,
  calcBuildingDamage,
} from "../../../shared/gameConfig";
import env from "../config/env";
import { syncResources } from "../services/city.service";
import { getActiveSiege, startSiege, endSiege, cancelSiegeJob, scheduleSiegeExpiry, resolveAttackOnBesiegedCity, isCityBesieged } from "../services/siege.service";
import { UnitName, CommandType, BuildingName } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// Prisma result type for a command with its units included.
// Using Prisma's inference avoids maintaining a manual interface that could drift.
type CommandWithUnits = Prisma.CommandGetPayload<{ include: { units: true } }>;

// Worker BullMQ care proceseaza sosirile si intoarcerile comenzilor. Fiecare comanda
// calatoreste un timp calculat (distanta / viteza), apoi worker-ul rezolva outcome-ul:
// livrare resurse, stationare suport, calcul batalie, sau operatiune de spionaj.
// Stats-urile (kills, loot) se actualizeaza fire-and-forget dupa tranzactia principala
// pentru ca nu sunt critice — un stats update esuat nu trebuie sa faca rollback la batalie.
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

// ─── Sosire la destinatie ─────────────────────────────────────────────────────

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

// ─── Resurse: adauga in orasul destinatie ────────────────────────────────────

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

// ─── Suport: unitatile raman stationate in orasul destinatie (nu sunt transferate) ──
// Ele contribuie la apararea orasului in caz de atac, dar nu pot fi folosite de
// proprietarul orasului — doar rechemate acasa de expeditor.

async function processSupportArrival(command: CommandWithUnits) {
  // Daca orasul e sub asediu, suportul nu se stationeaza linistit — el ATACA
  // garnizoana besieger-ului (regula confirmata: incoming supports auto-engage).
  // Supravietuitorii raman in oras ca SUPPORT (vor contribui la viitoare atacuri).
  if (await isCityBesieged(command.toCityId)) {
    const attackerUnits = command.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity }));
    const { attackerSurvivors } = await resolveAttackOnBesiegedCity({
      attackerUnits,
      toCityId: command.toCityId,
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

// ─── Atac: calculeaza lupta ───────────────────────────────────────────────────

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

  // Sprijinul stationat contribuie la aparare
  const stationedSupports = await prisma.command.findMany({
    where:   { toCityId: command.toCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
    // attackerUserId = owner-ul care a trimis suportul (necesar pt stats)
  });

  const airDefenseBuilding = toCity.buildings.find(b => b.name === "AIR_DEFENSE");
  const airDefenseLevel    = airDefenseBuilding?.level ?? 0;

  const attackerUnits  = command.units.map(u => ({ name: u.name, quantity: u.quantity }));

  // Agregam apararea: unitatile proprii + toate unitatile trimise ca sprijin
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

  // Distributia supravietuitorilor: cand stack-urile de suport lupta alaturi de aparatori nativi,
  // supravietuitorii se impart proportional dupa contributie. Folosesc floor + largest-remainder
  // (ca alocarea de locuri in alegeri) pentru a nu pierde unitati la rotunjire.
  // Edge case: verificarea shares[i].q > shares[i].floor previne supra-alocarea.
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
  // Cu sistemul nou (Grepolis-style), atacul cu Governor supravietuitor declanseaza
  // un siege in loc sa scada loialitatea. Daca exista deja un siege ACTIV pe oras,
  // atacul nou (care a curatat garnizoana actuala in calculul de batalie) il sparge
  // si porneste unul propriu — timer reset.
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

  // Date colectate in tx, folosite afara pentru a curata cozile BullMQ
  const displacedSupportIds:   { id: string; delayMs: number }[] = [];
  let createdSiegeId: string | null = null;
  let createdSiegeEndsAt: Date | null = null;
  let cancelledOldSiegeJobId: string | null | undefined = undefined;

  await prisma.$transaction(async (tx) => {
    // Actualizeaza unitatile aparatorului (native)
    for (const [name, quantity] of nativeStack) {
      await tx.unit.updateMany({
        where: { cityId: command.toCityId, name },
        data:  { quantity },
      });
    }

    // Actualizeaza fiecare comanda de SUPPORT stationata — pierderi distribuite
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

    // Actualizeaza nivelul Air Defense daca a fost damat
    if (result.airDefenseLevelsDestroyed > 0) {
      await tx.building.updateMany({
        where: { cityId: command.toCityId, name: "AIR_DEFENSE" },
        data:  { level: result.newAirDefenseLevel },
      });
    }

    // Demolarea cladirii tinta de drone (PRE-bătălie, cu drone INIȚIALE, ca în TW)
    let buildingLevelsDestroyed = 0;
    let targetBuildingName: string | null = command.targetBuilding;
    let targetBuildingInitialLevel = 0;
    const initialDrones = attackerUnits.find(u => u.name === "DRONE")?.quantity ?? 0;
    if (command.targetBuilding && initialDrones > 0) {
      if (command.targetBuilding === "AIR_DEFENSE") {
        // Dronele pe AIR_DEFENSE: damage suplimentar peste cel de la calcAirDefenseDamage
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

    // Scade resursele furate. Ownership-ul NU se mai schimba aici (transferul are
    // loc doar la finalizarea siege-ului prin siege.worker).
    await tx.city.update({
      where: { id: command.toCityId },
      data: {
        money:  { decrement: result.stolenMoney },
        energy: { decrement: result.stolenEnergy },
        ammo:   { decrement: result.stolenAmmo },
      },
    });

    if (newSiegeStarts) {
      // Daca exista deja un siege activ, batalia tocmai a curatat garnizoana lui
      // (era inclusa in defenderi). Inchide-l ca BROKEN_BY_NEW_SIEGE.
      if (preexistingSiege) {
        await tx.siege.update({
          where: { id: preexistingSiege.id },
          data:  { status: "BROKEN_BY_NEW_SIEGE" },
        });
        cancelledOldSiegeJobId = preexistingSiege.jobId;
        // Garnizoana spartă: marchez comanda SUPPORT veche ca COMPLETED (unitatile
        // ei sunt deja pe 0 din loop-ul de update support stacks de mai sus).
        await tx.command.update({
          where: { id: preexistingSiege.garrisonCommandId },
          data:  { status: "COMPLETED" },
        });
      }

      // Creeaza comanda SUPPORT/ARRIVED pentru garnizoana noului besieger
      // (governor + escort survivors). Aceeasi structura ca legacy-conquest.
      const garrisonUnits = result.attackerSurvivors.filter(u => u.quantity > 0);
      const garrison = await tx.command.create({
        data: {
          type:       "SUPPORT",
          status:     "ARRIVED",
          fromCityId: command.fromCityId,
          toCityId:   command.toCityId,
          arrivalAt:  new Date(),
          attackerUserId: command.attackerUserId,
          // defenderUserId ramane proprietarul curent (nu s-a schimbat); garrison-ul
          // e un SUPPORT al atacatorului catre orasul defender-ului.
          defenderUserId: toCity.ownerId,
          reportHiddenByAttacker: true,
          reportHiddenByDefender: true,
          units: { create: garrisonUnits.map(u => ({ name: u.name, quantity: u.quantity })) },
        },
      });

      // Porneste siege-ul.
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

      // Goleste CommandUnit-urile din ATTACK — trupele sunt acum in garrison-ul SUPPORT.
      for (const { name } of result.attackerSurvivors) {
        await tx.commandUnit.updateMany({
          where: { commandId: command.id, name },
          data:  { quantity: 0 },
        });
      }
    } else {
      // Lupta normala: supravietuitorii pleaca acasa cu prada.
      for (const { name, quantity } of result.attackerSurvivors) {
        await tx.commandUnit.updateMany({
          where: { commandId: command.id, name },
          data:  { quantity },
        });
      }
    }

    // Detectie "defender a spart siege-ul prin acest atac" — daca exista deja un
    // siege ACTIV care nu a fost inlocuit, si garnizoana lui (un SUPPORT in supportStacks)
    // a ajuns la 0 unitati, marcheaza siege-ul ca BROKEN_BY_DEFENSE.
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
        }
      }
    }

    const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
    // Daca atacul a pornit siege, trupele raman in garnizoana (comanda ATTACK e finalizata).
    // Altfel, daca au supravietuit, programa intoarcerea.
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
        // Raportul e stocat ca JSON (Prisma JsonValue). Tipat ca `any` pentru ca Prisma
        // nu suporta discriminated union pe campuri JSON. Fix-ul corect ar fi un tabel
        // separat BattleReport, dar JSON-ul pastreaza query-urile simple si evita join-uri.
        // YAGNI — nu am nevoie de query-uri pe campuri individuale din raport.
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
  // Calculam kills-urile si loot-ul dupa tranzactie (non-critical, fire-and-forget)
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

    // Distribui kills-urile defensive proportional intre defender (native) si supporteri
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

  // Programeaza intoarcerea daca au supravietuit unitati SI atacul nu a pornit siege.
  // (La start de siege trupele raman ca garnizoana, deci nu mai pleaca nicaieri.)
  const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
  if (hasSurvivors && !newSiegeStarts) {
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelayMs });
  }

  // Anuleaza job-ul vechi de timer (siege spart sau inlocuit) si programeaza-l pe cel nou.
  if (cancelledOldSiegeJobId) await cancelSiegeJob(cancelledOldSiegeJobId);
  if (createdSiegeId && createdSiegeEndsAt) {
    await scheduleSiegeExpiry(createdSiegeId, createdSiegeEndsAt);
  }
}

// ─── Spionaj: hacker vs hacker ────────────────────────────────────────────────
// Mecanism:
//   - atacatorul trimite N hackeri, orasul tinta are D hackeri (native + stationate).
//   - daca N > D: supravietuiesc (N - D) hackeri atacatori, D raman in aparare intacti.
//     Se genereaza un raport cu buildings + units din orasul tinta (snapshot).
//   - daca N <= D: toti hackerii atacatori mor, defenderul ramane intact, niciun snapshot.
//
// Hackerii defenderului NU mor niciodata (plan.txt).
// Resursele, zidurile — neatinse.

async function processSpyArrival(command: CommandWithUnits) {
  const toCity = await prisma.city.findUnique({
    where:   { id: command.toCityId },
    include: { units: true, buildings: { orderBy: { name: "asc" } } },
  });
  if (!toCity) return;

  const attackerHackers = command.units
    .filter(u => u.name === "HACKER")
    .reduce((s, u) => s + u.quantity, 0);

  // Hackerii defenderului: cei din oras + cei stationati ca SUPPORT
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

  const success   = attackerHackers > defenderHackers;
  const survivors = success ? attackerHackers - defenderHackers : 0;

  // Snapshot al orasului spionat (doar la succes)
  let snapshot: {
    buildings: { name: string; level: number }[];
    units: { name: UnitName; quantity: number }[];
    resources: { money: number; energy: number; ammo: number };
  } | null = null;
  if (success) {
    // Sincronizam resursele target-ului inainte sa le citim, ca sa fie actuale
    await syncResources(command.toCityId);
    const freshCity = await prisma.city.findUnique({
      where: { id: command.toCityId },
      select: { money: true, energy: true, ammo: true },
    });

    // Units = native + toate stack-urile stationate de SUPPORT
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

  const fromCityCoords = await prisma.city.findUnique({
    where:  { id: command.fromCityId },
    select: { x: true, y: true },
  });
  const distance = fromCityCoords
    ? getFieldDistance(fromCityCoords.x, fromCityCoords.y, toCity.x, toCity.y)
    : 0;
  const returnDelayMs   = getUnitTravelTimeSec(distance, UNITS.HACKER.speed, env.gameSpeed) * 1000;
  const returnArrivalAt = new Date(Date.now() + returnDelayMs);
  const hasSurvivors    = survivors > 0;

  await prisma.$transaction(async (tx) => {
    // Actualizeaza unitatile comenzii cu supravietuitorii
    await tx.commandUnit.updateMany({
      where: { commandId: command.id, name: "HACKER" },
      data:  { quantity: survivors },
    });

    await tx.command.update({
      where: { id: command.id },
      data: {
        status:    hasSurvivors ? "RETURNING" : "COMPLETED",
        arrivalAt: hasSurvivors ? returnArrivalAt : command.arrivalAt,
        // Defenderul afla doar daca spionajul a esuat. La succes, nu e notificat.
        reportHiddenByDefender: success,
        // Acelasi trade-off JSON ca la rapoartele de batalie — vezi processAttackArrival.
        report: {
          spyReport:       true,
          success,
          attackerHackers,
          defenderHackers,
          attackerSurvivors: survivors,
          snapshot, // null daca succes === false
          battleAt:          new Date().toISOString(),
        } as any,
      },
    });
  });

  if (hasSurvivors) {
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelayMs });
  }

  // ── Spy stats ──────────────────────────────────────────────────────────────
  try {
    const attackerLosses = attackerHackers - survivors;
    if (attackerLosses > 0 && toCity.ownerId) {
      // Defender killed the attacker's hackers (weighted by HACKER population)
      const hackerPop = UNITS.HACKER?.population ?? 1;
      await prisma.user.update({
        where: { id: toCity.ownerId },
        data:  { killsAsDefender: { increment: attackerLosses * hackerPop } },
      });
    }
    // Attacker never kills defender hackers in spy missions
  } catch (e) {
    console.error("Failed to update spy stats:", e);
  }
}

// ─── Intoarcere acasa ─────────────────────────────────────────────────────────

async function processReturn(commandId: string) {
  const command = await prisma.command.findUnique({
    where:   { id: commandId },
    include: { units: true },
  });
  if (!command || command.status !== "RETURNING") return;

  // Daca orasul-acasa e sub asediu, trupele care se intorc ATACA besieger-ul automat
  // (regula confirmata: returning units auto-engage). Resursele se adauga in oras
  // normal (vor fi prada besieger-ului daca cucereste).
  let unitsToReturn = command.units.map(u => ({ name: u.name as UnitName, quantity: u.quantity }));
  const totalReturning = unitsToReturn.reduce((s, u) => s + u.quantity, 0);
  if (totalReturning > 0 && await isCityBesieged(command.fromCityId)) {
    const { attackerSurvivors } = await resolveAttackOnBesiegedCity({
      attackerUnits: unitsToReturn,
      toCityId:      command.fromCityId,
    });
    unitsToReturn = attackerSurvivors;
  }

  await prisma.$transaction(async (tx) => {
    // Adauga unitatile supravietuitoare inapoi in orasul sursa
    for (const { name, quantity } of unitsToReturn) {
      if (quantity <= 0) continue;
      await tx.unit.updateMany({
        where: { cityId: command.fromCityId, name },
        data:  { quantity: { increment: quantity } },
      });
    }

    // Adauga resursele furate in orasul sursa
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
