import prisma from "../../core/db";
import env from "../../core/env";
import { BUILDINGS, BuildingName } from "../../../../shared/gameConfig";
import { GHOST_STARTER_BUILDINGS } from "./map.service";

// On each tick, every ghost city raises one Level on a random eligible building.
// Full rules in plan.txt → GHOST CITIES → Auto-upgrade buildings.
// The upgrade is FREE (it does not consume the city's resources) — players farm
// ghost cities, so they rarely have enough resources for a real upgrade.
const GHOST_TICK_BASE_HOURS = 6;

export const tickGhostCity = async (cityId: string): Promise<void> => {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { buildings: true },
  });
  if (!city || city.ownerId) return; // safety: ghosts only

  // Legacy ghost without buildings (created before the template was introduced) —
  // seed it with the starter template and let the next tick upgrade it.
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

  if (eligible.length === 0) return; // everything at max

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  await prisma.building.update({
    where: { id: pick.id },
    data:  { level: { increment: 1 } },
  });
};

// Before: sequential iteration over all ghost cities, one UPDATE per city.
// With 1500 ghosts = 1500 sequential queries that blocked the connection pool.
// Now: we process in batches of 50, in parallel within each batch.
const GHOST_BATCH_SIZE = 50;

export const tickAllGhosts = async (): Promise<void> => {
  const ghosts = await prisma.city.findMany({
    where:  { ownerId: null },
    select: { id: true },
  });
  for (let i = 0; i < ghosts.length; i += GHOST_BATCH_SIZE) {
    const batch = ghosts.slice(i, i + GHOST_BATCH_SIZE);
    await Promise.all(
      batch.map(g => tickGhostCity(g.id).catch(err =>
        console.error(`ghost tick failed for ${g.id}:`, err)
      ))
    );
  }
};

export const startGhostTicker = (): void => {
  const tickMs = Math.max(10_000, Math.round((GHOST_TICK_BASE_HOURS * 3600 * 1000) / env.gameSpeed));
  console.log(`Ghost ticker: tick every ${Math.round(tickMs / 1000)}s (game speed ${env.gameSpeed})`);
  setInterval(() => {
    tickAllGhosts().catch(err => console.error("ghost ticker error:", err));
  }, tickMs);
};
