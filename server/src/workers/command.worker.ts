import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import prisma from "../config/db";
import { commandQueue } from "../config/queue";
import { calculateBattle } from "../services/battle.service";
import { getTravelTimeSec } from "../../../shared/gameConfig";
import env from "../config/env";
import { syncResources } from "../services/city.service";
import { UnitName } from "@prisma/client";

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

async function processResourceArrival(command: any) {
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

async function processSupportArrival(command: any) {
  await prisma.command.update({
    where: { id: command.id },
    data:  { status: "ARRIVED" },
  });
}

// ─── Atac: calculeaza lupta ───────────────────────────────────────────────────

async function processAttackArrival(command: any) {
  await syncResources(command.toCityId);

  const toCity = await prisma.city.findUnique({
    where:   { id: command.toCityId },
    include: { units: true, buildings: true },
  });
  if (!toCity) return;

  // Sprijinul stationat contribuie la aparare
  const stationedSupports = await prisma.command.findMany({
    where:   { toCityId: command.toCityId, type: "SUPPORT", status: "ARRIVED" },
    include: { units: true },
  });

  const airDefenseBuilding = toCity.buildings.find(b => b.name === "AIR_DEFENSE");
  const airDefenseLevel    = airDefenseBuilding?.level ?? 0;

  const attackerUnits  = command.units.map((u: any) => ({ name: u.name as UnitName, quantity: u.quantity }));

  // Agregam apararea: unitatile proprii + toate unitatile trimise ca sprijin
  const nativeStack  = new Map<UnitName, number>(toCity.units.map(u => [u.name, u.quantity]));
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
    toCity.ammo
  );

  // Distribuie supravietuitorii proportional intre stack-ul propriu si fiecare sprijin
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

  const returnDelayMs   = getTravelTimeSec(env.gameSpeed) * 1000;
  const returnArrivalAt = new Date(Date.now() + returnDelayMs);

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

    // Scade resursele furate + actualizeaza loyalty
    await tx.city.update({
      where: { id: command.toCityId },
      data: {
        money:   { decrement: result.stolenMoney },
        energy:  { decrement: result.stolenEnergy },
        ammo:    { decrement: result.stolenAmmo },
        loyalty: { decrement: result.loyaltyDamage },
      },
    });

    // Actualizeaza CommandUnit cu supravietuitorii (pentru trip-ul de intoarcere)
    for (const { name, quantity } of result.attackerSurvivors) {
      await tx.commandUnit.updateMany({
        where: { commandId: command.id, name },
        data:  { quantity },
      });
    }

    const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);

    // Salveaza raportul de lupta. Daca exista supravietuitori, mutam arrivalAt
    // la momentul cand ajung inapoi acasa — altfel timer-ul ramane in trecut.
    // Salvam si starea initiala a luptei (atacator/aparator + AD lvl) — altfel
    // o pierdem dupa update-urile de mai sus si nu mai putem afisa pierderile.
    await tx.command.update({
      where: { id: command.id },
      data: {
        status:        hasSurvivors ? "RETURNING" : "COMPLETED",
        arrivalAt:     hasSurvivors ? returnArrivalAt : command.arrivalAt,
        resourceMoney:  result.stolenMoney,
        resourceEnergy: result.stolenEnergy,
        resourceAmmo:   result.stolenAmmo,
        report: {
          ...result,
          attackerInitial:        attackerUnits,
          defenderInitial:        defenderUnits,
          airDefenseInitialLevel: airDefenseLevel,
          battleAt:               new Date().toISOString(),
        } as any,
      },
    });
  });

  // Programeaza intoarcerea daca au supravietuit unitati
  const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
  if (hasSurvivors) {
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelayMs });
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

async function processSpyArrival(command: any) {
  const toCity = await prisma.city.findUnique({
    where:   { id: command.toCityId },
    include: { units: true, buildings: { orderBy: { name: "asc" } } },
  });
  if (!toCity) return;

  const attackerHackers = command.units
    .filter((u: any) => u.name === "HACKER")
    .reduce((s: number, u: any) => s + u.quantity, 0);

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
  let snapshot: { buildings: { name: string; level: number }[]; units: { name: UnitName; quantity: number }[] } | null = null;
  if (success) {
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
    };
  }

  const returnDelayMs   = getTravelTimeSec(env.gameSpeed) * 1000;
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
        // Spionatul nu afla niciodata ca a fost spionat.
        reportHiddenByDefender: true,
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
