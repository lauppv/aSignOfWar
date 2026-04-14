import { Prisma } from "@prisma/client";
import prisma from "../config/db";

// Returneaza notificarile de comenzi in care user-ul e implicat:
// - ATTACK cu report != null (battle landed)
// - SUPPORT  / RESOURCES cu status COMPLETED (trupele/resursele au ajuns)
// Directia e marcata din perspectiva user-ului.
export const getReportsForUser = async (userId: string) => {
  const reports = await prisma.command.findMany({
    where: {
      AND: [
        {
          OR: [
            { type: "ATTACK", report: { not: Prisma.JsonNull } },
            { type: "SUPPORT",   status: { in: ["ARRIVED", "COMPLETED"] } },
            { type: "RESOURCES", status: "COMPLETED" },
          ],
        },
        {
          OR: [
            { fromCity: { ownerId: userId }, reportHiddenByAttacker: false },
            { toCity:   { ownerId: userId }, reportHiddenByDefender: false },
          ],
        },
      ],
    },
    select: {
      id:             true,
      type:           true,
      arrivalAt:      true,
      status:         true,
      resourceMoney:  true,
      resourceEnergy: true,
      resourceAmmo:   true,
      report:         true,
      units:          { select: { name: true, quantity: true } },
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

  return reports.map(r => ({
    ...r,
    direction: r.fromCity.ownerId === userId ? ("outgoing" as const) : ("incoming" as const),
  }));
};

// "Sterge" un raport pentru user-ul curent: ascunde din partea lui
// (fromCity.owner => attacker, toCity.owner => defender).
export const deleteReportForUser = async (commandId: string, userId: string) => {
  const cmd = await prisma.command.findUnique({
    where:  { id: commandId },
    select: {
      id:       true,
      type:     true,
      status:   true,
      report:   true,
      fromCity: { select: { ownerId: true } },
      toCity:   { select: { ownerId: true } },
    },
  });
  if (!cmd) throw new Error("Report not found");

  const isReportable =
    (cmd.type === "ATTACK" && cmd.report !== null) ||
    (cmd.type === "SUPPORT"   && (cmd.status === "ARRIVED" || cmd.status === "COMPLETED")) ||
    (cmd.type === "RESOURCES" && cmd.status === "COMPLETED");
  if (!isReportable) throw new Error("Report not found");

  const isAttacker = cmd.fromCity.ownerId === userId;
  const isDefender = cmd.toCity.ownerId   === userId;
  if (!isAttacker && !isDefender) throw new Error("Forbidden");

  await prisma.command.update({
    where: { id: commandId },
    data:  isAttacker
      ? { reportHiddenByAttacker: true }
      : { reportHiddenByDefender: true },
  });
};

// "Sterge" toate rapoartele user-ului (ascunde din partea lui).
export const deleteAllReportsForUser = async (userId: string) => {
  const reportableWhere: Prisma.CommandWhereInput = {
    OR: [
      { type: "ATTACK", report: { not: Prisma.JsonNull } },
      { type: "SUPPORT",   status: "COMPLETED" },
      { type: "RESOURCES", status: "COMPLETED" },
    ],
  };
  await prisma.$transaction([
    prisma.command.updateMany({
      where: {
        AND: [reportableWhere, {
          fromCity: { ownerId: userId },
          reportHiddenByAttacker: false,
        }],
      },
      data: { reportHiddenByAttacker: true },
    }),
    prisma.command.updateMany({
      where: {
        AND: [reportableWhere, {
          toCity: { ownerId: userId },
          reportHiddenByDefender: false,
        }],
      },
      data: { reportHiddenByDefender: true },
    }),
  ]);
};
