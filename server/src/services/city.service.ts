import prisma from "../config/db";
import { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export const createStarterCity = async (
  userId: string,
  cityName: string,
  tx: TransactionClient = prisma
) => {
  return tx.city.create({
    data: {
      name: cityName,
      ownerId: userId,
      buildings: {
        create: [
          { name: "HEADQUARTERS",    level: 1 },
          { name: "BANK",            level: 1 },
          { name: "POWER_PLANT",     level: 1 },
          { name: "WEAPONS_FACTORY", level: 1 },
          { name: "HOUSING",         level: 1 },
          { name: "WAREHOUSE",       level: 1 },
          { name: "MILITARY_BASE",   level: 0 },
          { name: "HARBOR",          level: 0 },
          { name: "AIR_DEFENSE",     level: 0 },
        ],
      },
      units: {
        create: [
          { name: "LIGHT_INFANTRY",     category: "INFANTRY", quantity: 10 },
          { name: "ANTI_TANK_INFANTRY", category: "INFANTRY", quantity: 10 },
        ],
      },
    },
  });
};
