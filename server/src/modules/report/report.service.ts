import { Prisma } from "@prisma/client";
import prisma from "../../core/db";

// Returns the command notifications the user is involved in:
// - ATTACK with report != null (battle landed)
// - SUPPORT  / RESOURCES with status COMPLETED (the troops/resources arrived)
// The direction is marked from the user's perspective.
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

    // An attacker who lost does not see the defender's composition
    if (report && r.type === "ATTACK" && direction === "outgoing" && !(report as any).attackerWon) {
      const { defenderInitial, defenderSurvivors, airDefenseInitialLevel, airDefenseLevelsDestroyed, newAirDefenseLevel, ...rest } = report;
      report = rest;
    }

    return { ...r, report, direction };
  });
};

// "Deletes" a report for the current user: hides it on their side
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

  // If the user is both attacker and defender (commands on their own city, or
  // commands tied to a city they later conquered), we must
  // hide BOTH sides — otherwise the list will still catch it via the other side.
  await prisma.command.update({
    where: { id: commandId },
    data: {
      ...(isAttacker ? { reportHiddenByAttacker: true } : {}),
      ...(isDefender ? { reportHiddenByDefender: true } : {}),
    },
  });
};

// "Deletes" all of the user's reports (hides them on their side).
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
