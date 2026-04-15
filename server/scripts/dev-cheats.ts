// Dev cheats. Ruleaza cu:
//   npx tsx scripts/dev-cheats.ts <command> [args...]
//
// Exemple:
//   npx tsx scripts/dev-cheats.ts refill "My City"
//   npx tsx scripts/dev-cheats.ts setResources "My City" 50000 50000 50000
//   npx tsx scripts/dev-cheats.ts setUnits "My City" LIGHT_INFANTRY 500
//   npx tsx scripts/dev-cheats.ts setBuilding "My City" HEADQUARTERS 20
//   npx tsx scripts/dev-cheats.ts maxAllBuildings "My City"
//   npx tsx scripts/dev-cheats.ts listCities
//
// Numele orasului poate fi si un prefix unic (case-insensitive).

import prisma from "../src/config/db";
import { BUILDINGS, UNITS, getWarehouseCapacity, BuildingName, UnitName } from "../../shared/gameConfig";

async function findCity(nameOrPrefix: string) {
  const matches = await prisma.city.findMany({
    where: { name: { contains: nameOrPrefix, mode: "insensitive" } },
    include: { buildings: true, units: true, owner: { select: { username: true } } },
  });
  if (matches.length === 0) throw new Error(`No city matching "${nameOrPrefix}"`);
  if (matches.length > 1) {
    const list = matches.map(c => `  - ${c.name} [${c.x},${c.y}] owner=${c.owner?.username ?? "ghost"}`).join("\n");
    throw new Error(`Multiple cities match "${nameOrPrefix}":\n${list}`);
  }
  return matches[0];
}

// ── Cheats ────────────────────────────────────────────────────────────────────

/** Umple depozitul la capacitatea maxima (pe baza nivelului curent de Warehouse). */
export async function refill(cityName: string) {
  const city = await findCity(cityName);
  const whLevel = city.buildings.find(b => b.name === "WAREHOUSE")?.level ?? 0;
  const cap = getWarehouseCapacity(whLevel);
  await prisma.city.update({
    where: { id: city.id },
    data:  { money: cap, energy: cap, ammo: cap, lastResourceUpdate: new Date() },
  });
  console.log(`refilled ${city.name} to ${cap} each (warehouse L${whLevel})`);
}

/** Seteaza resursele la valori exacte. */
export async function setResources(cityName: string, money: number, energy: number, ammo: number) {
  const city = await findCity(cityName);
  await prisma.city.update({
    where: { id: city.id },
    data:  { money, energy, ammo, lastResourceUpdate: new Date() },
  });
  console.log(`${city.name}: money=${money} energy=${energy} ammo=${ammo}`);
}

/** Seteaza numarul de unitati de un anumit tip la valoarea exacta. */
export async function setUnits(cityName: string, unitName: string, qty: number) {
  const city = await findCity(cityName);
  const name = unitName.toUpperCase() as UnitName;
  if (!UNITS[name]) throw new Error(`Unknown unit: ${unitName}`);
  const next = Math.max(0, Math.floor(qty));
  const existing = city.units.find(u => u.name === name);
  if (existing) {
    await prisma.unit.update({ where: { id: existing.id }, data: { quantity: next } });
    console.log(`${city.name}: ${name} ${existing.quantity} → ${next}`);
  } else {
    await prisma.unit.create({
      data: { cityId: city.id, name, category: UNITS[name].category, quantity: next },
    });
    console.log(`${city.name}: ${name} 0 → ${next}`);
  }
}

/** Seteaza nivelul unei cladiri (creeaza randul daca nu exista). */
export async function setBuilding(cityName: string, buildingName: string, level: number) {
  const city = await findCity(cityName);
  const name = buildingName.toUpperCase() as BuildingName;
  const cfg = BUILDINGS[name];
  if (!cfg) throw new Error(`Unknown building: ${buildingName}`);
  const clamped = Math.max(0, Math.min(level, cfg.maxLevel));
  const existing = city.buildings.find(b => b.name === name);
  if (existing) {
    await prisma.building.update({ where: { id: existing.id }, data: { level: clamped } });
    console.log(`${city.name}: ${name} L${existing.level} → L${clamped}`);
  } else {
    await prisma.building.create({ data: { cityId: city.id, name, level: clamped } });
    console.log(`${city.name}: ${name} created at L${clamped}`);
  }
}

/** Urca toate cladirile existente la max level. */
export async function maxAllBuildings(cityName: string) {
  const city = await findCity(cityName);
  for (const b of city.buildings) {
    const max = BUILDINGS[b.name as BuildingName].maxLevel;
    if (b.level < max) {
      await prisma.building.update({ where: { id: b.id }, data: { level: max } });
      console.log(`  ${b.name}: L${b.level} → L${max}`);
    }
  }
  console.log(`${city.name}: all buildings maxed`);
}

/** Listeaza orasele tale (owner-ul e util ca sa stii pe care le poti cheat-ui). */
export async function listCities() {
  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    include: { owner: { select: { username: true } } },
  });
  for (const c of cities) {
    console.log(`  ${c.name.padEnd(20)} [${c.x},${c.y}]  owner=${c.owner?.username ?? "ghost"}`);
  }
}

// ── CLI dispatcher ────────────────────────────────────────────────────────────

const commands: Record<string, (...args: string[]) => Promise<void>> = {
  refill:          (c)                      => refill(c),
  setResources:    (c, m, e, a)             => setResources(c, Number(m), Number(e), Number(a)),
  setUnits:        (c, u, q)                => setUnits(c, u, Number(q)),
  setBuilding:     (c, b, l)                => setBuilding(c, b, Number(l)),
  maxAllBuildings: (c)                      => maxAllBuildings(c),
  listCities:      ()                       => listCities(),
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || !commands[cmd]) {
    console.log("Available commands:");
    for (const name of Object.keys(commands)) console.log(`  - ${name}`);
    process.exit(1);
  }
  await commands[cmd](...args);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
