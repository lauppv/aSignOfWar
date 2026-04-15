import prisma from "../config/db";
import env from "../config/env";
import { BUILDINGS, BuildingName } from "../../../shared/gameConfig";
import { GHOST_STARTER_BUILDINGS } from "./map.service";

// Fiecare ghost city urca la fiecare tick un Level la o cladire random eligibila.
// Reguli complete in plan.txt → GHOST CITIES → Auto-upgrade cladiri.
// Upgrade-ul e GRATUIT (nu consuma resursele orasului) — jucatorii farmeaza
// ghost cities, deci acestea rareori au resurse suficiente pentru upgrade real.
const GHOST_TICK_BASE_HOURS = 6;

export const tickGhostCity = async (cityId: string): Promise<void> => {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { buildings: true },
  });
  if (!city || city.ownerId) return; // safety: doar ghosts

  // Ghost istoric fara cladiri (creat inainte de introducerea sablonului) —
  // seedeaza-l cu sablonul de start si lasa urmatorul tick sa-l upgradeze.
  if (city.buildings.length === 0) {
    await prisma.building.createMany({
      data: GHOST_STARTER_BUILDINGS.map(b => ({ ...b, cityId: city.id })),
    });
    return;
  }

  const hqLevel = city.buildings.find(b => b.name === "HEADQUARTERS")?.level ?? 0;

  const eligible = city.buildings.filter(b => {
    const cfg = BUILDINGS[b.name as BuildingName];
    if (b.level >= cfg.maxLevel) return false;
    if (cfg.requiresHQ && hqLevel < cfg.requiresHQ) return false;
    return true;
  });

  if (eligible.length === 0) return; // totul la max

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  await prisma.building.update({
    where: { id: pick.id },
    data:  { level: { increment: 1 } },
  });
};

export const tickAllGhosts = async (): Promise<void> => {
  const ghosts = await prisma.city.findMany({
    where:  { ownerId: null },
    select: { id: true },
  });
  for (const g of ghosts) {
    try {
      await tickGhostCity(g.id);
    } catch (err) {
      console.error(`ghost tick failed for ${g.id}:`, err);
    }
  }
};

export const startGhostTicker = (): void => {
  const tickMs = Math.max(10_000, Math.round((GHOST_TICK_BASE_HOURS * 3600 * 1000) / env.gameSpeed));
  console.log(`Ghost ticker: tick every ${Math.round(tickMs / 1000)}s (game speed ${env.gameSpeed})`);
  setInterval(() => {
    tickAllGhosts().catch(err => console.error("ghost ticker error:", err));
  }, tickMs);
};
