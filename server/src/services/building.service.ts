import prisma from "../config/db";
import boss from "../config/pgboss";
import { getBuildingUpgradeCost, getBuildingUpgradeTime, BUILDINGS } from "../config/game.config";

export const startUpgrade = async (buildingId: string, userId: string) => {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { city: { include: { buildings: true } } },
  });

  if (!building)                        throw new Error("Cladirea nu exista");
  if (building.city.ownerId !== userId) throw new Error("Nu ai acces la aceasta cladire");
  if (building.upgradeFinishesAt)       throw new Error("Upgrade deja in curs");

  const cfg = BUILDINGS[building.name];
  if (building.level >= cfg.maxLevel)   throw new Error("Nivel maxim atins");

  const hq = building.city.buildings.find(b => b.name === "HEADQUARTERS")!;

  if (cfg.requiresHQ && hq.level < cfg.requiresHQ) {
    throw new Error(`Necesita Headquarters nivel ${cfg.requiresHQ}`);
  }

  const cost    = getBuildingUpgradeCost(building.name, building.level);
  const timeSec = getBuildingUpgradeTime(building.name, building.level, hq.level);
  const city    = building.city;

  if (city.money < cost.money || city.energy < cost.energy || city.ammo < cost.ammo) {
    throw new Error("Resurse insuficiente");
  }

  const finishesAt = new Date(Date.now() + timeSec * 1000);

  const jobId = await boss.sendAfter("building-upgrade", { buildingId }, {}, timeSec);
  if (!jobId) throw new Error("Eroare la programarea upgrade-ului");

  await prisma.$transaction([
    prisma.city.update({
      where: { id: city.id },
      data: {
        money:  { decrement: cost.money },
        energy: { decrement: cost.energy },
        ammo:   { decrement: cost.ammo },
      },
    }),
    prisma.building.update({
      where: { id: buildingId },
      data: { upgradeFinishesAt: finishesAt, upgradeJobId: jobId },
    }),
  ]);

  return { finishesAt, cost, timeSec };
};
