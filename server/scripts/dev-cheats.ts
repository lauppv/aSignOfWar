// Dev cheats. Run with:
//   npx tsx scripts/dev-cheats.ts <command> [args...]
//
// Cities are identified by "x,y" coordinates (e.g. 51,51). Use
// `listCities` if you don't know the coordinates.
//
// Examples:
//   npx tsx scripts/dev-cheats.ts refill 51,51
//   npx tsx scripts/dev-cheats.ts setResources 51,51 50000 50000 50000
//   npx tsx scripts/dev-cheats.ts setUnits 51,51 LIGHT_INFANTRY 500
//   npx tsx scripts/dev-cheats.ts setBuilding 51,51 HEADQUARTERS 20
//   npx tsx scripts/dev-cheats.ts maxAllBuildings 51,51
//   npx tsx scripts/dev-cheats.ts listCities

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (process.env.DATABASE_HOST) {
  const u = process.env.DATABASE_USER!;
  const p = encodeURIComponent(process.env.DATABASE_PASSWORD!);
  const h = process.env.DATABASE_HOST!;
  const port = process.env.DATABASE_PORT || "5432";
  const db = process.env.DATABASE_NAME!;
  process.env.DATABASE_URL = `postgresql://${u}:${p}@${h}:${port}/${db}`;
}

import { PrismaClient } from "@prisma/client";
import { BUILDINGS, UNITS, getWarehouseCapacity, BuildingName, UnitName } from "../../shared/gameConfig";

const prisma = new PrismaClient();

function parseCoords(coords: string): { x: number; y: number } {
  const m = coords.match(/^(-?\d+)\s*,\s*(-?\d+)$/);
  if (!m) throw new Error(`Invalid coordinates "${coords}". Expected format: x,y (e.g. 51,51)`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

async function findCity(coords: string) {
  const { x, y } = parseCoords(coords);
  const city = await prisma.city.findUnique({
    where:   { x_y: { x, y } },
    include: { buildings: true, units: true, owner: { select: { username: true } } },
  });
  if (!city) throw new Error(`No city at [${x},${y}]`);
  return city;
}

// ── Cheats ────────────────────────────────────────────────────────────────────

/** Fill the warehouse to max capacity (based on the current Warehouse level). */
export async function refill(coords: string) {
  const city = await findCity(coords);
  const whLevel = city.buildings.find(b => b.name === "WAREHOUSE")?.level ?? 0;
  const cap = getWarehouseCapacity(whLevel);
  await prisma.city.update({
    where: { id: city.id },
    data:  { money: cap, energy: cap, ammo: cap, lastResourceUpdate: new Date() },
  });
  console.log(`refilled ${city.name} [${city.x},${city.y}] to ${cap} each (warehouse L${whLevel})`);
}

/** Set the resources to exact values. */
export async function setResources(coords: string, money: number, energy: number, ammo: number) {
  const city = await findCity(coords);
  await prisma.city.update({
    where: { id: city.id },
    data:  { money, energy, ammo, lastResourceUpdate: new Date() },
  });
  console.log(`${city.name} [${city.x},${city.y}]: money=${money} energy=${energy} ammo=${ammo}`);
}

/** Set the number of units of a given type to the exact value. */
export async function setUnits(coords: string, unitName: string, qty: number) {
  const city = await findCity(coords);
  const name = unitName.toUpperCase() as UnitName;
  if (!UNITS[name]) throw new Error(`Unknown unit: ${unitName}`);
  const next = Math.max(0, Math.floor(qty));
  const existing = city.units.find(u => u.name === name);
  if (existing) {
    await prisma.unit.update({ where: { id: existing.id }, data: { quantity: next } });
    console.log(`${city.name} [${city.x},${city.y}]: ${name} ${existing.quantity} → ${next}`);
  } else {
    await prisma.unit.create({
      data: { cityId: city.id, name, category: UNITS[name].category, quantity: next },
    });
    console.log(`${city.name} [${city.x},${city.y}]: ${name} 0 → ${next}`);
  }
}

/** Set a building's level (creates the row if it doesn't exist). */
export async function setBuilding(coords: string, buildingName: string, level: number) {
  const city = await findCity(coords);
  const name = buildingName.toUpperCase() as BuildingName;
  const cfg = BUILDINGS[name];
  if (!cfg) throw new Error(`Unknown building: ${buildingName}`);
  const clamped = Math.max(0, Math.min(level, cfg.maxLevel));
  const existing = city.buildings.find(b => b.name === name);
  if (existing) {
    await prisma.building.update({ where: { id: existing.id }, data: { level: clamped } });
    console.log(`${city.name} [${city.x},${city.y}]: ${name} L${existing.level} → L${clamped}`);
  } else {
    await prisma.building.create({ data: { cityId: city.id, name, level: clamped } });
    console.log(`${city.name} [${city.x},${city.y}]: ${name} created at L${clamped}`);
  }
}

/** Raise all existing buildings to max level. */
export async function maxAllBuildings(coords: string) {
  const city = await findCity(coords);
  for (const b of city.buildings) {
    const max = BUILDINGS[b.name as BuildingName].maxLevel;
    if (b.level < max) {
      await prisma.building.update({ where: { id: b.id }, data: { level: max } });
      console.log(`  ${b.name}: L${b.level} → L${max}`);
    }
  }
  console.log(`${city.name} [${city.x},${city.y}]: all buildings maxed`);
}

/** List your cities (the owner is useful to know which ones you can cheat on). */
export async function listCities() {
  const cities = await prisma.city.findMany({
    orderBy: [{ y: "asc" }, { x: "asc" }],
    include: { owner: { select: { username: true } } },
  });
  for (const c of cities) {
    const coords = `${c.x},${c.y}`.padEnd(9);
    console.log(`  ${coords}  ${c.name.padEnd(20)}  owner=${c.owner?.username ?? "ghost"}`);
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
