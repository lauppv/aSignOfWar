import prisma from "../config/db";
import { getBuildingPoints, BuildingName } from "../../../shared/gameConfig";

export interface PlayerRankingEntry {
  id: string;
  username: string;
  cities: number;
  points: number;
  killsAsAttacker: number;
  killsAsDefender: number;
  killsAsSupporter: number;
  totalKills: number;
  lootedMoney: number;
  lootedEnergy: number;
  lootedAmmo: number;
  totalLooted: number;
  alliance: { id: string; name: string; tag: string } | null;
}

export interface AllianceRankingEntry {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  points: number;
  pointsPerMember: number;
  cities: number;
  pointsPerCity: number;
  killsAsAttacker: number;
  killsAsDefender: number;
  killsAsSupporter: number;
  totalKills: number;
}

// O(n*m*k) la fiecare request: loopuri users x cities x buildings. La ~100 playeri
// e ok (<50ms). La 1000+ as cache-ui rankings in Redis cu TTL 60s sau as recalcula
// pe un cron — dar acum YAGNI, optimizare prematura pentru un proiect portofoliu.
export async function getRankings(): Promise<PlayerRankingEntry[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      killsAsAttacker: true,
      killsAsDefender: true,
      killsAsSupporter: true,
      lootedMoney: true,
      lootedEnergy: true,
      lootedAmmo: true,
      cities: {
        select: {
          buildings: { select: { name: true, level: true } },
        },
      },
      alliance: { select: { id: true, name: true, tag: true } },
    },
  });

  const rows: PlayerRankingEntry[] = users.map((u) => {
    let points = 0;
    for (const city of u.cities) {
      for (const b of city.buildings) points += getBuildingPoints(b.name as BuildingName, b.level);
    }
    return {
      id: u.id,
      username: u.username,
      cities: u.cities.length,
      points,
      killsAsAttacker: u.killsAsAttacker,
      killsAsDefender: u.killsAsDefender,
      killsAsSupporter: u.killsAsSupporter,
      totalKills: u.killsAsAttacker + u.killsAsDefender + u.killsAsSupporter,
      lootedMoney: Math.floor(u.lootedMoney),
      lootedEnergy: Math.floor(u.lootedEnergy),
      lootedAmmo: Math.floor(u.lootedAmmo),
      totalLooted: Math.floor(u.lootedMoney + u.lootedEnergy + u.lootedAmmo),
      alliance: u.alliance,
    };
  });

  rows.sort((a, b) => b.points - a.points);
  return rows;
}

export async function getAllianceRankings(): Promise<AllianceRankingEntry[]> {
  const alliances = await prisma.alliance.findMany({
    include: {
      members: {
        select: {
          id: true,
          killsAsAttacker: true,
          killsAsDefender: true,
          killsAsSupporter: true,
          cities: {
            select: {
              buildings: { select: { name: true, level: true } },
            },
          },
        },
      },
    },
  });

  const rows: AllianceRankingEntry[] = alliances.map((a) => {
    let points = 0;
    let cities = 0;
    let kA = 0, kD = 0, kS = 0;
    for (const m of a.members) {
      cities += m.cities.length;
      kA += m.killsAsAttacker;
      kD += m.killsAsDefender;
      kS += m.killsAsSupporter;
      for (const city of m.cities) {
        for (const b of city.buildings) points += getBuildingPoints(b.name as BuildingName, b.level);
      }
    }
    const memberCount = a.members.length;
    return {
      id: a.id,
      name: a.name,
      tag: a.tag,
      memberCount,
      points,
      pointsPerMember: memberCount > 0 ? Math.round(points / memberCount) : 0,
      cities,
      pointsPerCity: cities > 0 ? Math.round(points / cities) : 0,
      killsAsAttacker: kA,
      killsAsDefender: kD,
      killsAsSupporter: kS,
      totalKills: kA + kD + kS,
    };
  });

  rows.sort((a, b) => b.points - a.points);
  return rows;
}
