import prisma from "../../core/db";

// Data access for rankings. Pure query objects live here; scoring, sorting and
// caching stay in ranking.service.ts.

export const findPlayersForRanking = () =>
  prisma.user.findMany({
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

export const findAlliancesForRanking = () =>
  prisma.alliance.findMany({
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
