// One-off: re-aseaza toate orasele existente in spirala, cu distanta intre ele.
// Ruleaza cu: npx tsx scripts/repack-map.ts

import prisma from "../src/core/db";
import { MAP_SIZE } from "../src/modules/map/map.service";

async function main() {
  const cities = await prisma.city.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const cx = (MAP_SIZE - 1) / 2;
  const cy = (MAP_SIZE - 1) / 2;
  
  // 1. Generăm toate sloturile posibile și le sortăm după distanța față de centru
  const allPossibleSlots: { x: number; y: number; d: number; r: number }[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      allPossibleSlots.push({ x, y, d: dx * dx + dy * dy, r: Math.random() });
    }
  }
  
  // Sortăm: întâi distanța (d), apoi random (r) pentru a sparge simetria perfectă
  allPossibleSlots.sort((a, b) => (a.d - b.d) || (a.r - b.r));

  // 2. Filtrăm sloturile pentru a respecta regula: "niciun vecin în jur"
  const finalSlots: { x: number; y: number }[] = [];
  const occupied = new Set<string>();

  for (const slot of allPossibleSlots) {
    if (finalSlots.length >= cities.length) break;

    const key = `${slot.x},${slot.y}`;
    
    // Verificăm dacă slotul curent sau oricare din cei 8 vecini sunt ocupați
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
    throw new Error(`Harta este prea mică pentru a păstra distanța cerută între cele ${cities.length} orașe.`);
  }

  // 3. Aplicăm mutările în baza de date
  await prisma.$transaction(async (tx) => {
    // Mutăm orașele "în parcare" (coordonate negative) pentru a evita erorile de constrângere unică
    for (let i = 0; i < cities.length; i++) {
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: -1 - i, y: -1 - i },
      });
    }

    // Le așezăm în noile sloturi aerisite
    for (let i = 0; i < cities.length; i++) {
      const s = finalSlots[i];
      await tx.city.update({
        where: { id: cities[i].id },
        data: { x: s.x, y: s.y },
      });
      console.log(`${cities[i].name} → [${s.x}, ${s.y}] (Aerisit)`);
    }
  }, { timeout: 30000 }); // Mărim timeout-ul pentru tranzacții mari

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});