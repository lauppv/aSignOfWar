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
            { type: "SPY",    report: { not: Prisma.JsonNull } },
            { type: "SUPPORT",   status: { in: ["ARRIVED", "RETURNING", "COMPLETED"] } },
            { type: "RESOURCES", status: "COMPLETED" },
          ],
        },
        {
          OR: [
            { attackerUserId: userId, reportHiddenByAttacker: false },
            { defenderUserId: userId, reportHiddenByDefender: false },
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
      attackerUserId: true,
      defenderUserId: true,
      units:          { select: { name: true, quantity: true } },
      fromCity: {
        select: {
          id: true, name: true, x: true, y: true, ownerId: true,
          owner: { select: { id: true, username: true } },
        },
      },
      toCity: {
        select: {
          id: true, name: true, x: true, y: true, ownerId: true,
          owner: { select: { id: true, username: true } },
        },
      },
    },
    orderBy: { arrivalAt: "desc" },
  });

  return reports.map(r => {
    const direction = r.attackerUserId === userId ? ("outgoing" as const) : ("incoming" as const);
    let report = r.report as Record<string, unknown> | null;

    // Atacatorul care a pierdut nu vede compozitia aparatorului
    if (report && r.type === "ATTACK" && direction === "outgoing" && !(report as any).attackerWon) {
      const { defenderInitial, defenderSurvivors, airDefenseInitialLevel, airDefenseLevelsDestroyed, newAirDefenseLevel, ...rest } = report;
      report = rest;
    }

    return { ...r, report, direction };
  });
};

// "Sterge" un raport pentru user-ul curent: ascunde din partea lui
// (fromCity.owner => attacker, toCity.owner => defender).
export const deleteReportForUser = async (commandId: string, userId: string) => {
  const cmd = await prisma.command.findUnique({
    where:  { id: commandId },
    select: {
      id:             true,
      type:           true,
      status:         true,
      report:         true,
      attackerUserId: true,
      defenderUserId: true,
    },
  });
  if (!cmd) throw new Error("Report not found");

  const isReportable =
    (cmd.type === "ATTACK" && cmd.report !== null) ||
    (cmd.type === "SPY"    && cmd.report !== null) ||
    (cmd.type === "SUPPORT"   && (cmd.status === "ARRIVED" || cmd.status === "RETURNING" || cmd.status === "COMPLETED")) ||
    (cmd.type === "RESOURCES" && cmd.status === "COMPLETED");
  if (!isReportable) throw new Error("Report not found");

  const isAttacker = cmd.attackerUserId === userId;
  const isDefender = cmd.defenderUserId === userId;
  if (!isAttacker && !isDefender) throw new Error("Forbidden");

  // Daca user-ul e si attacker si defender (comenzi pe propriul oras, sau
  // comenzi legate de un oras pe care l-a cucerit ulterior), trebuie sa
  // ascundem AMBELE fete — altfel lista il va mai prinde prin cealalta fata.
  await prisma.command.update({
    where: { id: commandId },
    data: {
      ...(isAttacker ? { reportHiddenByAttacker: true } : {}),
      ...(isDefender ? { reportHiddenByDefender: true } : {}),
    },
  });
};

// "Sterge" toate rapoartele user-ului (ascunde din partea lui).
export const deleteAllReportsForUser = async (userId: string) => {
  const reportableWhere: Prisma.CommandWhereInput = {
    OR: [
      { type: "ATTACK", report: { not: Prisma.JsonNull } },
      { type: "SPY",    report: { not: Prisma.JsonNull } },
      { type: "SUPPORT",   status: { in: ["ARRIVED", "RETURNING", "COMPLETED"] } },
      { type: "RESOURCES", status: "COMPLETED" },
    ],
  };
  await prisma.$transaction([
    prisma.command.updateMany({
      where: {
        AND: [reportableWhere, {
          attackerUserId: userId,
          reportHiddenByAttacker: false,
        }],
      },
      data: { reportHiddenByAttacker: true },
    }),
    prisma.command.updateMany({
      where: {
        AND: [reportableWhere, {
          defenderUserId: userId,
          reportHiddenByDefender: false,
        }],
      },
      data: { reportHiddenByDefender: true },
    }),
  ]);
};
