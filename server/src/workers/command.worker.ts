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

  // Cucerire: atacatorul castiga + toti aparatorii morti + governor supravietuieste + loyalty = 0.
  // Un governor se consuma (lovitura finala). Restul raman ca garnizoana.
  // Loyalty reset la 25 inseamna ca noul proprietar trebuie sa apere sau risca pierderea rapida.
  // ── Cucerire ───────────────────────────────────────────────────────────────
  // Conditii: atac castigat (allDefDead implicit), loialitate ≤ 0 dupa damage,
  // si cel putin un Governor supravietuitor. Un Governor se consuma (cel care
  // a dat lovitura finala). Counter-ul de pe cont ramane neschimbat — exact ca
  // taleri in Tribal Wars: nobilul mort nu te scuteste de costul urmatorului.
  let conquered          = false;
  let newOwnerId: string | null = null;
  const govIdx           = result.attackerSurvivors.findIndex(u => u.name === "GOVERNOR");
  const govSurvivors     = govIdx >= 0 ? result.attackerSurvivors[govIdx].quantity : 0;
  const projectedLoyalty = toCity.loyalty - result.loyaltyDamage;
  if (projectedLoyalty <= 0 && govSurvivors > 0) {
    const fromCity = await prisma.city.findUnique({
      where:  { id: command.fromCityId },
      select: { ownerId: true },
    });
    if (fromCity?.ownerId) {
      conquered     = true;
      newOwnerId    = fromCity.ownerId;
      // Decrementeaza guvernatorii din supravietuitori INAINTE de tx, ca loop-ul
      // de jos sa scrie cantitatea corecta in CommandUnit.
      result.attackerSurvivors[govIdx].quantity = govSurvivors - 1;
    }
  }
  const finalLoyalty = conquered ? 25 : Math.max(0, projectedLoyalty);

  // Date colectate in tx, folosite afara pentru a curata cozile BullMQ
  let cancelledBuildingJobIds: string[] = [];
  let cancelledRecruitJobIds:  string[] = [];
  const displacedSupportIds:   { id: string; delayMs: number }[] = [];

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

    // Scade resursele furate, seteaza loyalty (clampat la 0 sau resetat la 25
    // daca a fost cucerit), si transfera owner-ul daca e cazul.
    await tx.city.update({
      where: { id: command.toCityId },
      data: {
        money:   { decrement: result.stolenMoney },
        energy:  { decrement: result.stolenEnergy },
        ammo:    { decrement: result.stolenAmmo },
        loyalty: finalLoyalty,
        ...(conquered ? { ownerId: newOwnerId } : {}),
      },
    });

    if (conquered) {
      // Anuleaza upgrade-urile de cladiri in curs (fara refund — e razboi).
      const buildingOrders = await tx.buildingUpgradeOrder.findMany({
        where:  { cityId: command.toCityId },
        select: { id: true, jobId: true },
      });
      cancelledBuildingJobIds = buildingOrders
        .map(o => o.jobId)
        .filter((x): x is string => x != null);
      await tx.buildingUpgradeOrder.deleteMany({ where: { cityId: command.toCityId } });

      // Anuleaza recrutarile in curs (inclusiv eventual GOVERNOR al defender-ului).
      const recruitOrders = await tx.recruitmentOrder.findMany({
        where:  { cityId: command.toCityId },
        select: { id: true, jobId: true },
      });
      cancelledRecruitJobIds = recruitOrders
        .map(o => o.jobId)
        .filter((x): x is string => x != null);
      await tx.recruitmentOrder.deleteMany({ where: { cityId: command.toCityId } });

      // Anuleaza comenzile de RESURSE care plecau din orasul acum cucerit:
      // nu ajung la destinatie si nici nu se intorc — pur si simplu dispar
      // (resursele se pierd). Job-ul stale "arrive" va gasi commandId inexistent
      // si va iesi linistit (vezi processArrival cand command e null).
      // (Outgoing ATTACK/SUPPORT/SPY raman in zbor — sunt acte deja angajate.)
      const cancelledResourceCmds = await tx.command.findMany({
        where:  { fromCityId: command.toCityId, type: "RESOURCES", status: "TRAVELING" },
        select: { id: true },
      });
      const cancelledResourceIds = cancelledResourceCmds.map(c => c.id);
      if (cancelledResourceIds.length > 0) {
        await tx.commandUnit.deleteMany({ where: { commandId: { in: cancelledResourceIds } } });
        await tx.command.deleteMany({ where: { id: { in: cancelledResourceIds } } });
      }

      // Trimite acasa toate suporturile stationate care au mai supravietuit:
      // un oras nu poate fi sprijinit dupa ce-i cade owner-ul. Acestea sunt
      // ale altor jucatori, NU ale fostului proprietar — deci se intorc, nu se anuleaza.
      const stationedSurvivors = await tx.command.findMany({
        where:  { toCityId: command.toCityId, type: "SUPPORT", status: "ARRIVED" },
        include: { units: true, fromCity: { select: { x: true, y: true } } },
      });
      for (const sc of stationedSurvivors) {
        const counts: Partial<Record<UnitName, number>> = {};
        for (const u of sc.units) counts[u.name as UnitName] = (counts[u.name as UnitName] ?? 0) + u.quantity;
        const slowest = getSlowestUnitSpeed(counts);
        const dist    = getFieldDistance(sc.fromCity.x, sc.fromCity.y, toCity.x, toCity.y);
        const ms      = slowest > 0 ? getUnitTravelTimeSec(dist, slowest, env.gameSpeed) * 1000 : 0;
        await tx.command.update({
          where: { id: sc.id },
          data:  { status: "RETURNING", arrivalAt: new Date(Date.now() + ms) },
        });
        displacedSupportIds.push({ id: sc.id, delayMs: ms });
      }

      // Trupele atacatoare (cele care l-au insotit pe Governor) raman stationate
      // in noul oras ca un SUPPORT din orasul lor de origine. Asa se comporta
      // exact ca sprijinul din Triburi: contribuie la aparare, nu pot fi
      // folosite de pe orasul cucerit, iar expeditorul le poate rechema acasa.
      const garrisonUnits = result.attackerSurvivors.filter(u => u.quantity > 0);
      if (garrisonUnits.length > 0) {
        await tx.command.create({
          data: {
            type:       "SUPPORT",
            status:     "ARRIVED",
            fromCityId: command.fromCityId,
            toCityId:   command.toCityId,
            arrivalAt:  new Date(),
            attackerUserId: newOwnerId!,
            defenderUserId: newOwnerId!,
            reportHiddenByAttacker: true,
            reportHiddenByDefender: true,
            units: { create: garrisonUnits.map(u => ({ name: u.name, quantity: u.quantity })) },
          },
        });
      }
      // CommandUnit-urile din comanda de ATTACK sunt golite — armata e
      // acum intr-o comanda SUPPORT separata.
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

    const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
    // Daca a fost cucerit, comanda e definitivata aici (trupele raman in oras).
    // Altfel, daca au supravietuit, programa intoarcerea.
    const finalStatus    = conquered ? "COMPLETED" : (hasSurvivors ? "RETURNING" : "COMPLETED");
    const finalArrivalAt = (!conquered && hasSurvivors) ? returnArrivalAt : command.arrivalAt;

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
          conquered,
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

  // Programeaza intoarcerea daca au supravietuit unitati SI orasul nu a fost cucerit.
  // (La cucerire trupele raman ca garnizoana, deci nu mai pleaca nicaieri.)
  const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
  if (hasSurvivors && !conquered) {
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelayMs });
  }

  // Curatare cozi BullMQ pentru orderele anulate de cucerire si reprogramare
  // a suporturilor displasate.
  if (conquered) {
    for (const jobId of cancelledBuildingJobIds) {
      const j = await buildingQueue.getJob(jobId);
      if (j) await j.remove();
    }
    for (const jobId of cancelledRecruitJobIds) {
      const j = await recruitmentQueue.getJob(jobId);
      if (j) await j.remove();
    }
    for (const { id, delayMs } of displacedSupportIds) {
      await commandQueue.add("return", { commandId: id }, { delay: delayMs });
    }
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
// Resursele, zidurile, loyalty — neatinse.

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

  await prisma.$transaction(async (tx) => {
    // Adauga unitatile supravietuitoare inapoi in orasul sursa
    for (const { name, quantity } of command.units) {
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
