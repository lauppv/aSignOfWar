import prisma from "../config/db";
import { getBuildingPoints, BuildingName } from "../../../shared/gameConfig";

const DESCRIPTION_MAX = 500;

export interface PlayerProfileCity {
  id: string;
  name: string;
  x: number;
  y: number;
  points: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  description: string | null;
  alliance: { id: string; name: string; tag: string } | null;
  cities: PlayerProfileCity[];
  totalCities: number;
  totalPoints: number;
  rank: number;
  totalPlayers: number;
  createdAt: Date;
}

export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      description: true,
      createdAt: true,
      alliance: { select: { id: true, name: true, tag: true } },
      cities: {
        select: {
          id: true,
          name: true,
          x: true,
          y: true,
          buildings: { select: { name: true, level: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!target) return null;

  const targetCities: PlayerProfileCity[] = target.cities.map(c => {
    let pts = 0;
    for (const b of c.buildings) pts += getBuildingPoints(b.name as BuildingName, b.level);
    return { id: c.id, name: c.name, x: c.x, y: c.y, points: pts };
  });
  const targetPoints = targetCities.reduce((s, c) => s + c.points, 0);

  // Compute rank by recomputing all players' points (cheap enough for our scale).
  const all = await prisma.user.findMany({
    select: {
      id: true,
      cities: { select: { buildings: { select: { name: true, level: true } } } },
    },
  });
  const scored = all.map(u => {
    let pts = 0;
    for (const c of u.cities) {
      for (const b of c.buildings) pts += getBuildingPoints(b.name as BuildingName, b.level);
    }
    return { id: u.id, points: pts };
  });
  scored.sort((a, b) => b.points - a.points);
  const rank = scored.findIndex(s => s.id === userId) + 1;

  return {
    id: target.id,
    username: target.username,
    description: target.description,
    alliance: target.alliance,
    cities: targetCities,
    totalCities: targetCities.length,
    totalPoints: targetPoints,
    rank,
    totalPlayers: scored.length,
    createdAt: target.createdAt,
  };
}

export async function updateMyDescription(userId: string, raw: string | null) {
  const description = raw == null ? null : raw.trim();
  if (description != null && description.length > DESCRIPTION_MAX) {
    throw new Error("DESCRIPTION_TOO_LONG");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { description: description && description.length > 0 ? description : null },
  });
}
