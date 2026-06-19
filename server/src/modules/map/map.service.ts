import { randomUUID } from "crypto";
import prisma from "../../core/db";
import { getBuildingPoints, getWarehouseCapacity, BuildingName } from "../../../../shared/gameConfig";
import { slotAllocator } from "./slotAllocator";

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
export const MAP_SIZE = 300;
const GHOST_NAME = "Ghost city";

export const getMapCenter = () => ({
  x: Math.floor(MAP_SIZE / 2),
  y: Math.floor(MAP_SIZE / 2),
});

// Functie pura (fara DB) — cauta in cercuri din ce in ce mai mari din origin.
// Preferinta: sloturi fara vecini (ca orasele sa nu fie lipite). Daca nu gaseste, ia oricare liber.
// Acumuleaza candidati peste mai multe ring-uri — daca ring-ul curent are doar sloturi
// cu vecini, continua sa caute in ring-urile urmatoare pana gaseste cel putin 10 fara vecini
// sau epuizeaza 20 de sloturi libere. Fara asta, orasele se lipeau in centrul hartii.
export const pickFreeSlotNear = (
  originX: number,
  originY: number,
  occupied: Set<number>
): { x: number; y: number } => {
  const noNeighbor: { x: number; y: number }[] = [];
  const anyFree: { x: number; y: number }[] = [];

  for (let radius = 0; radius < MAP_SIZE; radius++) {
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        if (Math.abs(i) !== radius && Math.abs(j) !== radius) continue;
        const x = originX + i;
        const y = originY + j;
        if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
        const idx = y * MAP_SIZE + x;
        if (occupied.has(idx)) continue;

        anyFree.push({ x, y });
        const hasNeighbor =
          (x > 0 && occupied.has(idx - 1)) ||
          (x < MAP_SIZE - 1 && occupied.has(idx + 1)) ||
          (y > 0 && occupied.has(idx - MAP_SIZE)) ||
          (y < MAP_SIZE - 1 && occupied.has(idx + MAP_SIZE));
        if (!hasNeighbor) noNeighbor.push({ x, y });
      }
    }

    if (noNeighbor.length >= 10) break;
  }

  const pool = noNeighbor.length > 0 ? noNeighbor : anyFree;
  if (pool.length === 0) throw new Error("MAP_FULL");
  return pool[Math.floor(Math.random() * pool.length)];
};

// Originea e un punct random pe un cerc in jurul centrului. Raza cercului creste
// cu numarul de orase deja ocupate — primii jucatori sunt aproape de centru,
// urmatorii se distribuie pe cercuri din ce in ce mai mari. Randomizarea pe cerc
// evita pattern-ul de diamant pe care il genereaza cautarea pe ring-uri patrate.
export const pickFreeSlot = async (): Promise<{ x: number; y: number }> => {
  const center = getMapCenter();
  const occupiedCount = slotAllocator.getOccupiedCount();
  const maxRadius = MAP_SIZE * 0.45;
  const totalSlots = MAP_SIZE * MAP_SIZE;
  const fillRatio = occupiedCount / totalSlots;
  const baseRadius = maxRadius * Math.sqrt(fillRatio) + 2;
  const angle = Math.random() * 2 * Math.PI;
  const r = baseRadius * (0.5 + Math.random() * 0.5);
  const originX = Math.round(center.x + Math.cos(angle) * r);
  const originY = Math.round(center.y + Math.sin(angle) * r);
  return slotAllocator.allocateSlot(
    Math.max(0, Math.min(MAP_SIZE - 1, originX)),
    Math.max(0, Math.min(MAP_SIZE - 1, originY)),
  );
};

// Inainte avea getOccupiedSet (SELECT pe tot), skipDuplicates (masca race conditions),
// si un query OR cu buildings: { none: {} } ca sa gaseasca orasele tocmai create.
// Acum sloturile vin pre-alocate din allocator, garantat unice — nu mai trebuie skipDuplicates.
// ID-urile le generam in JS (randomUUID) ca sa scapam de findMany-ul de dupa createMany
// — Prisma createMany nu intoarce randurile, asa ca era nevoie de un SELECT extra
// pe (x, y) doar ca sa stim ce ID-uri sa folosim pentru building.createMany.
export const createGhostCitiesAround = async (
  origin: { x: number; y: number },
  count: number
): Promise<void> => {
  const slots = await slotAllocator.allocateSlots(origin.x, origin.y, count);
  const startingResources = getWarehouseCapacity(GHOST_STARTER_WAREHOUSE_LEVEL);

  const ghostCitiesData = slots.map(slot => ({
    id: randomUUID(),
    name: GHOST_NAME,
    x: slot.x,
    y: slot.y,
    money: startingResources,
    energy: startingResources,
    ammo: startingResources,
  }));

  const buildingsData: { cityId: string; name: BuildingName; level: number }[] = [];
  for (const city of ghostCitiesData) {
    for (const b of GHOST_STARTER_BUILDINGS) {
      buildingsData.push({ cityId: city.id, name: b.name, level: b.level });
    }
  }

  await prisma.$transaction([
    prisma.city.createMany({ data: ghostCitiesData }),
    ...(buildingsData.length > 0 ? [prisma.building.createMany({ data: buildingsData })] : []),
  ]);
};

// Cache in-memory cu TTL — harta nu se schimba la fiecare request, nu are rost sa
// incarci toate orasele cu toate buildings la fiecare GET /map. La 500 useri care
// dau refresh la harta, fara cache se faceau sute de queries identice pe secunda.
let mapCache: { data: any; expiresAt: number } | null = null;
const MAP_CACHE_TTL_MS = 5_000;

export const getAllCitiesOnMap = async () => {
  const now = Date.now();
  if (mapCache && now < mapCache.expiresAt) return mapCache.data;

  const cities = await prisma.city.findMany({
    select: {
      id: true, name: true, x: true, y: true,
      owner: { select: { id: true, username: true, allianceId: true, alliance: { select: { tag: true } } } },
      buildings: { select: { name: true, level: true } },
    },
  });

  const data = cities.map((city) => {
    let points = 0;
    for (const b of city.buildings) {
        points += getBuildingPoints(b.name as BuildingName, b.level);
    }
    return {
      id: city.id,
      name: city.name,
      x: city.x,
      y: city.y,
      owner: city.owner ? {
        id: city.owner.id,
        username: city.owner.username,
        allianceId: city.owner.allianceId,
        alliance: city.owner.alliance ? {
          tag: city.owner.alliance.tag,
        } : null,
      } : null,
      points,
    };
  });

  mapCache = { data, expiresAt: now + MAP_CACHE_TTL_MS };
  return data;
};