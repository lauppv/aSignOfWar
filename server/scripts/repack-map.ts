// One-off: re-place all existing cities in a spiral, with spacing between them.
// Run with: npx tsx scripts/repack-map.ts

import prisma from "../src/core/db";
import { MAP_SIZE } from "../src/modules/map/map.service";

async function main() {
  const cities = await prisma.city.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const cx = (MAP_SIZE - 1) / 2;
  const cy = (MAP_SIZE - 1) / 2;
  
  // 1. Generate all possible slots and sort them by distance from the center
  const allPossibleSlots: { x: number; y: number; d: number; r: number }[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      allPossibleSlots.push({ x, y, d: dx * dx + dy * dy, r: Math.random() });
    }
  }
  
  // Sort: distance (d) first, then random (r) to break perfect symmetry
  allPossibleSlots.sort((a, b) => (a.d - b.d) || (a.r - b.r));

  // 2. Filter the slots to respect the rule: "no neighbor around"
  const finalSlots: { x: number; y: number }[] = [];
  const occupied = new Set<string>();

  for (const slot of allPossibleSlots) {
    if (finalSlots.length >= cities.length) break;

    const key = `${slot.x},${slot.y}`;
    
    // Check whether the current slot or any of the 8 neighbors are occupied
    let canPlace = true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (occupied.has(`${slot.x + dx},${slot.y + dy}`)) {
          canPlace = false;
          break;
        }
      }
      if (!canPlace) break;
    }

    if (canPlace) {
      finalSlots.push({ x: slot.x, y: slot.y });
      occupied.add(key);
    }
  }

  if (finalSlots.length < cities.length) {
    throw new Error(`The map is too small to keep the required spacing between the ${cities.length} cities.`);
  }

  // 3. Apply the moves to the database
  await prisma.$transaction(async (tx) => {
    // Move the cities "into parking" (negative coordinates) to avoid unique-constraint errors
    for (let i = 0; i < cities.length; i++) {
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: -1 - i, y: -1 - i },
      });
    }

    // Place them into the new spaced-out slots
    for (let i = 0; i < cities.length; i++) {
      const s = finalSlots[i];
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: s.x, y: s.y },
      });
      console.log(`${cities[i].name} → [${s.x}, ${s.y}] (Spaced)`);
    }
  }, { timeout: 30000 }); // Increase the timeout for large transactions

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});