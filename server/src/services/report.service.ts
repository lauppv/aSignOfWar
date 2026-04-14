import { Prisma } from "@prisma/client";
import prisma from "../config/db";

// Returneaza toate rapoartele de batalie (ATTACK cu report != null) in care utilizatorul
// este implicat fie ca atacator (fromCity.ownerId), fie ca aparator (toCity.ownerId).
// Sortate descrescator dupa momentul bataliei (arrivalAt al starii TRAVELING initial).
export const getReportsForUser = async (userId: string) => {
  const reports = await prisma.command.findMany({
    where: {
      type:   "ATTACK",
      report: { not: Prisma.JsonNull },
      OR: [
        { fromCity: { ownerId: userId } },
        { toCity:   { ownerId: userId } },
      ],
    },
    select: {
      id:             true,
      arrivalAt:      true,
      status:         true,
      resourceMoney:  true,
      resourceEnergy: true,
      resourceAmmo:   true,
      report:         true,
      fromCity: {
        select: {
          id: true, name: true, x: true, y: true, ownerId: true,
          owner: { select: { username: true } },
        },
      },
      toCity: {
        select: {
          id: true, name: true, x: true, y: true, ownerId: true,
          owner: { select: { username: true } },
        },
      },
    },
    orderBy: { arrivalAt: "desc" },
  });

  // Marcheaza directia din perspectiva user-ului
  return reports.map(r => ({
    ...r,
    direction: r.fromCity.ownerId === userId ? ("outgoing" as const) : ("incoming" as const),
  }));
};
