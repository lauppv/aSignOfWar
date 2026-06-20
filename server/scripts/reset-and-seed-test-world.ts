// Full reset + seed for local testing. Creates 5 players (player1..player5),
// each with a single city (City1..City5) having:
//   - all buildings at maxLevel
//   - 1000 units of each type (except GOVERNOR — see below)
//   - 4 GOVERNOR + governorsRecruited = 4 (so the next one costs more)
//   - resources at max capacity
//
// Run with: docker compose exec app npx tsx scripts/reset-and-seed-test-world.ts
//
// The script loads .env and builds DATABASE_URL the same way as src/core/env.ts,
// so it can be run directly without an npm wrapper.
//
// Warning: the script WIPES everything — it deletes users, cities, commands, alliances,
// sieges. Use only in dev. I didn't add a confirmation prompt so I can overwrite quickly
// between tests.

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
import bcrypt from "bcrypt";
import {
  BUILDINGS,
  UNITS,
  getWarehouseCapacity,
  BuildingName,
  UnitName,
} from "../../shared/gameConfig";
import { createGhostCitiesAround, pickFreeSlot } from "../src/modules/map/map.service";

const prisma = new PrismaClient();

const PLAYER_COUNT = 5;
const UNITS_PER_TYPE = 600;
const GOVERNORS_PER_CITY = 4;
const GHOSTS_PER_CITY = 3;
const PASSWORD = "asdasd";


async function wipeWorld() {
  console.log("Wiping existing world...");
  // Order matters because of FKs.
  await prisma.$transaction([
    prisma.commandUnit.deleteMany(),
    prisma.sharedReport.deleteMany(),
    prisma.siege.deleteMany(),
    prisma.command.deleteMany(),
    prisma.recruitmentOrder.deleteMany(),
    prisma.buildingUpgradeOrder.deleteMany(),
    prisma.building.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.directMessage.deleteMany(),
    prisma.allianceMessage.deleteMany(),
    prisma.allianceInvitation.deleteMany(),
    prisma.allianceApplication.deleteMany(),
  ]);
  // Cities + alliances + users have circular-ish refs (alliance.leaderId, user.allianceId).
  // Break them by clearing the soft refs first.
  await prisma.alliance.updateMany({ data: { leaderId: "00000000-0000-0000-0000-000000000000" as any } }).catch(() => {});
  await prisma.user.updateMany({ data: { allianceId: null } });
  await prisma.city.deleteMany();
  await prisma.alliance.deleteMany();
  await prisma.user.deleteMany();
  console.log("  done.");
}

async function createPlayer(i: number): Promise<{ x: number; y: number }> {
  const username = `player${i}`;
  const email    = `player${i}@fake.com`;
  const cityName = `City${i}`;
  const { x, y } = await pickFreeSlot();

  const hash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hash,
      governorsRecruited: GOVERNORS_PER_CITY, // the next Governor he recruits will cost cost(N+1)
    },
  });

  // Build the city with all buildings at maxLevel.
  const buildings = (Object.keys(BUILDINGS) as BuildingName[]).map(name => ({
    name,
    level: BUILDINGS[name].maxLevel,
  }));

  const whCap = getWarehouseCapacity(BUILDINGS.WAREHOUSE.maxLevel);

  // Build all units at 1000 each (including GOVERNOR with the 4 starting ones — overrides 1000
  // since the user explicitly asked for 4 governors. Other units get 1000.)
  const unitsData = (Object.keys(UNITS) as UnitName[]).map(name => ({
    name,
    category: UNITS[name].category,
    quantity: name === "GOVERNOR" ? GOVERNORS_PER_CITY : UNITS_PER_TYPE,
  }));

  await prisma.city.create({
    data: {
      name:    cityName,
      x, y,
      ownerId: user.id,
      money:   whCap,
      energy:  whCap,
      ammo:    whCap,
      buildings: { create: buildings },
      units:     { create: unitsData },
    },
  });

  console.log(`  ${username}: ${cityName} at [${x},${y}] — buildings maxed, ${UNITS_PER_TYPE}× per unit, ${GOVERNORS_PER_CITY} governors`);
  return { x, y };
}

async function main() {
  await wipeWorld();
  console.log(`Seeding ${PLAYER_COUNT} players...`);
  const origins: { x: number; y: number }[] = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    origins.push(await createPlayer(i));
  }

  console.log(`\nSpawning ${GHOSTS_PER_CITY} ghost cities around each player...`);
  for (const origin of origins) {
    await createGhostCitiesAround(origin, GHOSTS_PER_CITY);
  }
  console.log(`  done — ${PLAYER_COUNT * GHOSTS_PER_CITY} ghost cities created.`);

  console.log(`\nDone. Login with: player1..player${PLAYER_COUNT} / ${PASSWORD}`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
