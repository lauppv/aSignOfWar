import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import prisma from "../config/db";
import { commandQueue } from "../config/queue";
import { calculateBattle } from "../services/battle.service";
import { getTravelTimeSec, UNITS } from "../../../shared/gameConfig";
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

// ─── Suport: muta unitatile permanent in orasul destinatie ───────────────────

async function processSupportArrival(command: any) {
  await prisma.$transaction(async (tx) => {
    for (const { name, quantity } of command.units) {
      await tx.unit.upsert({
        where:  { cityId_name: { cityId: command.toCityId, name } },
        update: { quantity: { increment: quantity } },
        create: {
          cityId:   command.toCityId,
          name:     name as UnitName,
          category: UNITS[name as UnitName].category,
          quantity,
        },
      });
    }
    await tx.command.update({
      where: { id: command.id },
      data:  { status: "COMPLETED" },
    });
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

  const airDefenseBuilding = toCity.buildings.find(b => b.name === "AIR_DEFENSE");
  const airDefenseLevel    = airDefenseBuilding?.level ?? 0;

  const attackerUnits  = command.units.map((u: any) => ({ name: u.name as UnitName, quantity: u.quantity }));
  const defenderUnits  = toCity.units.map(u => ({ name: u.name, quantity: u.quantity }));

  const result = calculateBattle(
    attackerUnits,
    defenderUnits,
    airDefenseLevel,
    toCity.money,
    toCity.energy,
    toCity.ammo
  );

  await prisma.$transaction(async (tx) => {
    // Actualizeaza unitatile aparatorului
    for (const { name, quantity } of result.defenderSurvivors) {
      await tx.unit.updateMany({
        where: { cityId: command.toCityId, name },
        data:  { quantity },
      });
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

    // Salveaza raportul de lupta
    await tx.command.update({
      where: { id: command.id },
      data: {
        status:        hasSurvivors ? "RETURNING" : "COMPLETED",
        resourceMoney:  result.stolenMoney,
        resourceEnergy: result.stolenEnergy,
        resourceAmmo:   result.stolenAmmo,
        report: result as any,
      },
    });
  });

  // Programeaza intoarcerea daca au supravietuit unitati
  const hasSurvivors = result.attackerSurvivors.some(u => u.quantity > 0);
  if (hasSurvivors) {
    const returnDelay = getTravelTimeSec(env.gameSpeed) * 1000;
    await commandQueue.add("return", { commandId: command.id }, { delay: returnDelay });
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
