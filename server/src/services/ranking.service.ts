import prisma from "../config/db";
import { getBuildingPoints, BuildingName } from "../../../shared/gameConfig";

export async function getRankings() {
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
    },
  });

  const rows = users.map((u) => {
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
    };
  });

  rows.sort((a, b) => b.points - a.points);
  return rows;
}
