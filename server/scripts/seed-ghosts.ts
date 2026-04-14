// One-off: pentru fiecare jucator existent care nu are inca orase fantoma in jur,
// genereaza 3 ghost cities langa orasul lui starter. Ruleaza cu:
//   npx tsx scripts/seed-ghosts.ts

import prisma from "../src/config/db";
import { createGhostCitiesAround } from "../src/services/map.service";

async function main() {
  const players = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      cities: { select: { id: true, x: true, y: true }, orderBy: { createdAt: "asc" } },
    },
  });

  for (const p of players) {
    const starter = p.cities[0];
    if (!starter) continue;
    console.log(`spawning 3 ghosts around ${p.username} [${starter.x},${starter.y}]`);
    await prisma.$transaction(async (tx) => {
      await createGhostCitiesAround({ x: starter.x, y: starter.y }, 3, tx);
    });
  }

  const totalGhosts = await prisma.city.count({ where: { ownerId: null } });
  console.log(`done. ghost cities total: ${totalGhosts}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
