import prisma from "../config/db";
import { Prisma } from "@prisma/client";
import { getBuildingPoints, getWarehouseCapacity, BuildingName } from "../../../shared/gameConfig";

// Sablon cladiri pentru orasele fantoma nou create (vezi plan.txt → GHOST CITIES).
export const GHOST_STARTER_BUILDINGS: { name: BuildingName; level: number }[] = [
  { name: "HEADQUARTERS",    level: 3 },
  { name: "BANK",            level: 3 },
  { name: "POWER_PLANT",     level: 3 },
  { name: "WEAPONS_FACTORY", level: 3 },
  { name: "HOUSING",         level: 3 },
  { name: "WAREHOUSE",       level: 3 },
  { name: "MILITARY_BASE",   level: 0 },
  { name: "HARBOR",          level: 0 },
  { name: "AIR_DEFENSE",     level: 0 },
];

const GHOST_STARTER_WAREHOUSE_LEVEL = 3;

export const MAP_SIZE = 100;

// Pana la cati candidati liberi (oricat de "lipiti") sa luam in considerare.
const ANY_FREE_POOL = 20;
// Cati candidati cu zero vecini ocupati pe 4 directii sa preferam (creeaza spatii goale).
const NO_NEIGHBOR_POOL = 10;

const GHOST_NAME = "Ghost city";

type TransactionClient = Prisma.TransactionClient;

const slotIndex = (x: number, y: number) => y * MAP_SIZE + x;

export const getMapCenter = () => ({
  x: Math.floor(MAP_SIZE / 2),
  y: Math.floor(MAP_SIZE / 2),
});

export const getOccupiedSet = async (
  tx: TransactionClient = prisma
): Promise<Set<number>> => {
  const cities = await tx.city.findMany({ select: { x: true, y: true } });
  return new Set(cities.map(c => slotIndex(c.x, c.y)));
};

// Alege un slot liber cat mai aproape de (originX, originY).
// Prefera sloturile cu zero vecini ocupati (4-vecini) — astfel orasele raman rasfirate
// cu spatii goale intre ele in loc sa fie lipite. Daca pool-ul "no-neighbor" e gol,
// cade pe orice slot liber. Aruncam MAP_FULL daca nu mai e nimic disponibil.
export const pickFreeSlotNear = (
  originX: number,
  originY: number,
  occupied: Set<number>
): { x: number; y: number } => {
  // Sortam toate sloturile dupa distanta euclidiana fata de origine, cu tiebreaker random
  // ca sa nu cada mereu acelasi inel in aceeasi ordine.
  const sorted: { x: number; y: number; d: number; r: number }[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - originX;
      const dy = y - originY;
      sorted.push({ x, y, d: dx * dx + dy * dy, r: Math.random() });
    }
  }
  sorted.sort((a, b) => (a.d - b.d) || (a.r - b.r));

  const noNeighbor: { x: number; y: number }[] = [];
  const anyFree: { x: number; y: number }[] = [];

  for (const s of sorted) {
    if (occupied.has(slotIndex(s.x, s.y))) continue;
    anyFree.push(s);

    const hasNeighbor =
      (s.x > 0              && occupied.has(slotIndex(s.x - 1, s.y))) ||
      (s.x < MAP_SIZE - 1   && occupied.has(slotIndex(s.x + 1, s.y))) ||
      (s.y > 0              && occupied.has(slotIndex(s.x, s.y - 1))) ||
      (s.y < MAP_SIZE - 1   && occupied.has(slotIndex(s.x, s.y + 1)));
    if (!hasNeighbor) noNeighbor.push(s);

    if (noNeighbor.length >= NO_NEIGHBOR_POOL) break;
    if (anyFree.length >= ANY_FREE_POOL && noNeighbor.length > 0) break;
  }

  const pool = noNeighbor.length > 0 ? noNeighbor : anyFree;
  if (pool.length === 0) throw new Error("MAP_FULL");
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { x: pick.x, y: pick.y };
};

// Wrapper pentru compatibilitate cu createStarterCity: ia un slot din spirala centrala.
export const pickFreeSlot = async (
  tx: TransactionClient = prisma
): Promise<{ x: number; y: number }> => {
  const occupied = await getOccupiedSet(tx);
  const center = getMapCenter();
  return pickFreeSlotNear(center.x, center.y, occupied);
};

// Creeaza N orase fantoma in jurul unei origini. Pentru fiecare reciteste sloturile
// ocupate (read-your-writes in tranzactie) ca sa nu lovim unique-ul pe (x,y).
export const createGhostCitiesAround = async (
  origin: { x: number; y: number },
  count: number,
  tx: TransactionClient = prisma
): Promise<void> => {
  const occupied = await getOccupiedSet(tx);
  const startingResources = getWarehouseCapacity(GHOST_STARTER_WAREHOUSE_LEVEL);

  for (let i = 0; i < count; i++) {
    const slot = pickFreeSlotNear(origin.x, origin.y, occupied);
    occupied.add(slotIndex(slot.x, slot.y));
    await tx.city.create({
      data: {
        name: GHOST_NAME,
        x: slot.x,
        y: slot.y,
        money:  startingResources,
        energy: startingResources,
        ammo:   startingResources,
        buildings: { create: GHOST_STARTER_BUILDINGS },
      },
    });
  }
};

export const getAllCitiesOnMap = async () => {
  const cities = await prisma.city.findMany({
    select: {
      id: true,
      name: true,
      x: true,
      y: true,
      owner: {
        select: {
          id: true,
          username: true,
          allianceId: true,
          alliance: { select: { id: true, tag: true, name: true } },
        },
      },
      buildings: { select: { name: true, level: true } },
    },
  });
  return cities.map(({ buildings, ...c }) => {
    let points = 0;
    for (const b of buildings) points += getBuildingPoints(b.name as BuildingName, b.level);
    return { ...c, points };
  });
};
