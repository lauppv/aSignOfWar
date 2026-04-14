// One-off: re-aseaza toate orasele existente in spirala din centrul hartii.
// Ruleaza cu: npx tsx scripts/repack-map.ts

import prisma from "../src/config/db";
import { MAP_SIZE } from "../src/services/map.service";

async function main() {
  const cities = await prisma.city.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const cx = (MAP_SIZE - 1) / 2;
  const cy = (MAP_SIZE - 1) / 2;
  const slots: { x: number; y: number; d: number; r: number }[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      slots.push({ x, y, d: dx * dx + dy * dy, r: Math.random() });
    }
  }
  slots.sort((a, b) => (a.d - b.d) || (a.r - b.r));

  // Mai intai eliberam toate sloturile mutand orasele in afara hartii temporar
  // ca sa nu lovim unique constraint-ul cand reasignam.
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < cities.length; i++) {
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: -1 - i, y: -1 - i },
      });
    }
    for (let i = 0; i < cities.length; i++) {
      const s = slots[i];
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: s.x, y: s.y },
      });
      console.log(`${cities[i].name} → [${s.x}, ${s.y}]`);
    }
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
