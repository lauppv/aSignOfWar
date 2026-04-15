// One-off: populeaza orasele fantoma existente (create inainte de introducerea
// sablonului de start) cu GHOST_STARTER_BUILDINGS. Ruleaza cu:
//   npx tsx scripts/backfill-ghost-buildings.ts

import prisma from "../src/config/db";
import { GHOST_STARTER_BUILDINGS } from "../src/services/map.service";
import { getWarehouseCapacity } from "../../shared/gameConfig";

async function main() {
  const ghosts = await prisma.city.findMany({
    where:   { ownerId: null },
    include: { buildings: true },
  });

  const starterResources = getWarehouseCapacity(3);
  let seeded = 0;

  for (const g of ghosts) {
    if (g.buildings.length > 0) continue;
    await prisma.$transaction(async (tx) => {
      await tx.building.createMany({
        data: GHOST_STARTER_BUILDINGS.map(b => ({ ...b, cityId: g.id })),
      });
      await tx.city.update({
        where: { id: g.id },
        data:  {
          money:  starterResources,
          energy: starterResources,
          ammo:   starterResources,
        },
      });
    });
    seeded++;
    console.log(`seeded ghost ${g.id} at [${g.x},${g.y}]`);
  }

  console.log(`done. seeded ${seeded} / ${ghosts.length} ghost cities.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
