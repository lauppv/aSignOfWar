import prisma from "../../core/db";

interface ShareOptions {
  hideOwnTroops: boolean;
  hideOwnInitial: boolean;
  hideEnemyTroops: boolean;
}

export const createSharedReport = async (
  commandId: string,
  userId: string,
  opts: ShareOptions
) => {
  const cmd = await prisma.command.findUnique({
    where: { id: commandId },
    select: {
      id: true,
      type: true,
      report: true,
      attackerUserId: true,
      defenderUserId: true,
    },
  });
  if (!cmd) throw new Error("Report not found");
  if (!cmd.report) throw new Error("Report not found");

  const isAttacker = cmd.attackerUserId === userId;
  const isDefender = cmd.defenderUserId === userId;
  if (!isAttacker && !isDefender) throw new Error("Forbidden");

  const shared = await prisma.sharedReport.create({
    data: {
      commandId,
      userId,
      hideOwnTroops: opts.hideOwnTroops,
      hideOwnInitial: opts.hideOwnInitial,
      hideEnemyTroops: opts.hideEnemyTroops,
    },
  });

  return shared.id;
};

export const getSharedReport = async (shareId: string) => {
  const shared = await prisma.sharedReport.findUnique({
    where: { id: shareId },
    include: {
      user: { select: { id: true, username: true } },
      command: {
        select: {
          id: true,
          type: true,
          arrivalAt: true,
          resourceMoney: true,
          resourceEnergy: true,
          resourceAmmo: true,
          report: true,
          attackerUserId: true,
          defenderUserId: true,
          units: { select: { name: true, quantity: true } },
          fromCity: {
            select: {
              id: true, name: true, x: true, y: true,
              owner: { select: { id: true, username: true } },
            },
          },
          toCity: {
            select: {
              id: true, name: true, x: true, y: true,
              owner: { select: { id: true, username: true } },
            },
          },
        },
      },
    },
  });
  if (!shared) throw new Error("Shared report not found");

  const { command: cmd } = shared;
  const report = cmd.report as Record<string, unknown> | null;
  if (!report) throw new Error("Shared report not found");

  const isAttacker = shared.userId === cmd.attackerUserId;
  const direction = isAttacker ? "outgoing" as const : "incoming" as const;

  const filtered = applyVisibility(
    report,
    cmd.type,
    direction,
    shared.hideOwnTroops,
    shared.hideOwnInitial,
    shared.hideEnemyTroops,
  );

  return {
    id: shared.id,
    sharedBy: shared.user,
    type: cmd.type,
    arrivalAt: cmd.arrivalAt,
    resourceMoney: cmd.resourceMoney,
    resourceEnergy: cmd.resourceEnergy,
    resourceAmmo: cmd.resourceAmmo,
    direction,
    units: cmd.units,
    fromCity: cmd.fromCity,
    toCity: cmd.toCity,
    report: filtered,
  };
};

function applyVisibility(
  report: Record<string, unknown>,
  type: string,
  direction: "outgoing" | "incoming",
  hideOwnTroops: boolean,
  hideOwnInitial: boolean,
  hideEnemyTroops: boolean,
): Record<string, unknown> {
  if (type === "RESOURCES" || type === "SUPPORT") return report;

  const result = { ...report };

  if (type === "ATTACK") {
    const ownIsAttacker = direction === "outgoing";

    if (hideOwnTroops) {
      if (ownIsAttacker) {
        delete result.attackerInitial;
        delete result.attackerSurvivors;
      } else {
        delete result.defenderInitial;
        delete result.defenderSurvivors;
      }
    } else if (hideOwnInitial) {
      if (ownIsAttacker) {
        result.attackerLosses = computeLosses(
          result.attackerInitial as any[],
          result.attackerSurvivors as any[],
        );
        delete result.attackerInitial;
        delete result.attackerSurvivors;
      } else {
        result.defenderLosses = computeLosses(
          result.defenderInitial as any[],
          result.defenderSurvivors as any[],
        );
        delete result.defenderInitial;
        delete result.defenderSurvivors;
      }
    }

    if (hideEnemyTroops) {
      if (ownIsAttacker) {
        delete result.defenderInitial;
        delete result.defenderSurvivors;
      } else {
        delete result.attackerInitial;
        delete result.attackerSurvivors;
      }
    }
  }

  if (type === "SPY") {
    if (hideOwnTroops) {
      delete result.attackerHackers;
      delete result.attackerSurvivors;
    }
    if (hideEnemyTroops) {
      delete result.defenderHackers;
      delete result.snapshot;
    }
  }

  return result;
}

function computeLosses(
  initial: { name: string; quantity: number }[] | undefined,
  survivors: { name: string; quantity: number }[] | undefined,
): { name: string; quantity: number }[] {
  if (!initial) return [];
  const survMap = new Map((survivors ?? []).map(u => [u.name, u.quantity]));
  return initial
    .map(u => ({ name: u.name, quantity: u.quantity - (survMap.get(u.name) ?? 0) }))
    .filter(u => u.quantity > 0);
}
