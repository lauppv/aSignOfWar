import prisma from "../config/db";
import type { AllianceAccess } from "@prisma/client";
import { getBuildingPoints, BuildingName } from "../../../shared/gameConfig";

const NAME_MIN = 3;
const NAME_MAX = 32;
const TAG_MIN = 2;
const TAG_MAX = 5;
const DESC_MAX = 500;
const MESSAGE_MAX = 2000;
const APPLICATION_MSG_MAX = 1000;
const ACCESS_MODES: AllianceAccess[] = ["OPEN", "CLOSED", "INVITE_ONLY", "APPLICATION"];

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeTag(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function getMyAlliance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { allianceId: true },
  });
  if (!user?.allianceId) return null;
  return getAlliance(user.allianceId);
}

export async function getAlliance(allianceId: string) {
  const a = await prisma.alliance.findUnique({
    where: { id: allianceId },
    include: {
      leader: { select: { id: true, username: true } },
      members: { select: { id: true, username: true }, orderBy: { username: "asc" } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    name: a.name,
    tag: a.tag,
    description: a.description,
    accessMode: a.accessMode,
    createdAt: a.createdAt,
    leader: a.leader,
    members: a.members,
  };
}

export async function getAllianceProfile(allianceId: string) {
  // Profilul public al aliantei: metrici + rank fata de celelalte aliante.
  // Calculeaza toate totalurile intr-un singur query (nu folosim getAllianceRankings
  // ca sa nu mai facem inca un round-trip).
  const alliances = await prisma.alliance.findMany({
    include: {
      leader: { select: { id: true, username: true } },
      members: {
        select: {
          id: true,
          username: true,
          killsAsAttacker: true,
          killsAsDefender: true,
          killsAsSupporter: true,
          cities: {
            select: { buildings: { select: { name: true, level: true } } },
          },
        },
        orderBy: { username: "asc" },
      },
    },
  });

  type Agg = {
    id: string;
    points: number;
    cities: number;
  };
  const aggregates: Agg[] = alliances.map((a) => {
    let points = 0;
    let cities = 0;
    for (const m of a.members) {
      cities += m.cities.length;
      for (const city of m.cities) {
        for (const b of city.buildings) {
          points += getBuildingPoints(b.name as BuildingName, b.level);
        }
      }
    }
    return { id: a.id, points, cities };
  });

  aggregates.sort((x, y) => y.points - x.points);
  const rankIndex = aggregates.findIndex((x) => x.id === allianceId);
  if (rankIndex === -1) return null;

  const a = alliances.find((x) => x.id === allianceId)!;

  const memberStats = a.members.map((m) => {
    let mp = 0;
    for (const city of m.cities) {
      for (const b of city.buildings) mp += getBuildingPoints(b.name as BuildingName, b.level);
    }
    return {
      id: m.id,
      username: m.username,
      points: mp,
      cities: m.cities.length,
      totalKills: m.killsAsAttacker + m.killsAsDefender + m.killsAsSupporter,
    };
  });
  memberStats.sort((x, y) => y.points - x.points);

  const totalPoints = aggregates[rankIndex].points;
  const totalCities = aggregates[rankIndex].cities;
  const memberCount = a.members.length;
  const totalKills = a.members.reduce(
    (s, m) => s + m.killsAsAttacker + m.killsAsDefender + m.killsAsSupporter,
    0
  );

  return {
    id: a.id,
    name: a.name,
    tag: a.tag,
    description: a.description,
    accessMode: a.accessMode,
    createdAt: a.createdAt,
    leader: a.leader,
    memberCount,
    cities: totalCities,
    points: totalPoints,
    pointsPerMember: memberCount > 0 ? Math.round(totalPoints / memberCount) : 0,
    pointsPerCity: totalCities > 0 ? Math.round(totalPoints / totalCities) : 0,
    totalKills,
    rank: rankIndex + 1,
    totalAlliances: aggregates.length,
    members: memberStats,
  };
}

export async function listAlliances() {
  const rows = await prisma.alliance.findMany({
    include: {
      leader: { select: { id: true, username: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    tag: a.tag,
    description: a.description,
    accessMode: a.accessMode,
    leader: a.leader,
    memberCount: a._count.members,
    createdAt: a.createdAt,
  }));
}

export async function createAlliance(
  userId: string,
  rawName: string,
  rawTag: string,
  description: string | null
) {
  const name = normalizeName(rawName);
  const tag = normalizeTag(rawTag);

  if (name.length < NAME_MIN || name.length > NAME_MAX) throw new Error("NAME_LENGTH");
  if (tag.length < TAG_MIN || tag.length > TAG_MAX) throw new Error("TAG_LENGTH");
  if (!/^[A-Z0-9]+$/.test(tag)) throw new Error("TAG_FORMAT");
  if (description && description.length > DESC_MAX) throw new Error("DESCRIPTION_TOO_LONG");

  return await prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
    if (!me) throw new Error("USER_NOT_FOUND");
    if (me.allianceId) throw new Error("ALREADY_IN_ALLIANCE");

    const [byName, byTag] = await Promise.all([
      tx.alliance.findUnique({ where: { name } }),
      tx.alliance.findUnique({ where: { tag } }),
    ]);
    if (byName) throw new Error("NAME_TAKEN");
    if (byTag) throw new Error("TAG_TAKEN");

    const alliance = await tx.alliance.create({
      data: {
        name,
        tag,
        description: description?.trim() || null,
        leaderId: userId,
        members: { connect: { id: userId } },
      },
    });
    return alliance;
  });
}

export async function joinAlliance(userId: string, allianceId: string) {
  return await prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
    if (!me) throw new Error("USER_NOT_FOUND");
    if (me.allianceId) throw new Error("ALREADY_IN_ALLIANCE");

    const alliance = await tx.alliance.findUnique({ where: { id: allianceId } });
    if (!alliance) throw new Error("ALLIANCE_NOT_FOUND");

    if (alliance.accessMode === "OPEN") {
      await tx.user.update({ where: { id: userId }, data: { allianceId } });
      return alliance;
    }

    // For any other mode, there must be a pending invitation for this user.
    const invite = await tx.allianceInvitation.findUnique({
      where: { allianceId_userId: { allianceId, userId } },
    });
    if (!invite) throw new Error("JOIN_NOT_ALLOWED");
    await tx.user.update({ where: { id: userId }, data: { allianceId } });
    await tx.allianceInvitation.delete({ where: { id: invite.id } });
    await tx.allianceApplication.deleteMany({ where: { userId } });
    await tx.allianceInvitation.deleteMany({ where: { userId, NOT: { id: invite.id } } });
    return alliance;
  });
}

export async function leaveAlliance(userId: string) {
  return await prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({
      where: { id: userId },
      select: { allianceId: true, leadingAlliance: { select: { id: true } } },
    });
    if (!me) throw new Error("USER_NOT_FOUND");
    if (!me.allianceId) throw new Error("NOT_IN_ALLIANCE");

    const allianceId = me.allianceId;
    const memberCount = await tx.user.count({ where: { allianceId } });
    const isLeader = me.leadingAlliance?.id === allianceId;

    if (isLeader && memberCount > 1) {
      throw new Error("LEADER_MUST_TRANSFER_OR_DISBAND");
    }

    await tx.user.update({ where: { id: userId }, data: { allianceId: null } });

    // If leader leaves alone, disband the alliance.
    if (isLeader) {
      await tx.alliance.delete({ where: { id: allianceId } });
    }
    return { allianceId, disbanded: isLeader };
  });
}

export async function disbandAlliance(userId: string) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId: userId } });
    if (!alliance) throw new Error("NOT_LEADER");
    await tx.user.updateMany({ where: { allianceId: alliance.id }, data: { allianceId: null } });
    await tx.alliance.delete({ where: { id: alliance.id } });
    return { id: alliance.id };
  });
}

export async function kickMember(leaderId: string, targetUserId: string) {
  return await prisma.$transaction(async (tx) => {
    if (leaderId === targetUserId) throw new Error("CANNOT_KICK_SELF");
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { allianceId: true } });
    if (!target || target.allianceId !== alliance.id) throw new Error("MEMBER_NOT_FOUND");
    await tx.user.update({ where: { id: targetUserId }, data: { allianceId: null } });
    return { allianceId: alliance.id };
  });
}

export async function transferLeadership(leaderId: string, targetUserId: string) {
  return await prisma.$transaction(async (tx) => {
    if (leaderId === targetUserId) throw new Error("ALREADY_LEADER");
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { allianceId: true } });
    if (!target || target.allianceId !== alliance.id) throw new Error("MEMBER_NOT_FOUND");
    const updated = await tx.alliance.update({ where: { id: alliance.id }, data: { leaderId: targetUserId } });
    return updated;
  });
}

export async function updateAlliance(
  leaderId: string,
  patch: { name?: string; tag?: string; description?: string | null; accessMode?: AllianceAccess }
) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");

    const data: { name?: string; tag?: string; description?: string | null; accessMode?: AllianceAccess } = {};

    if (patch.name !== undefined) {
      const name = normalizeName(patch.name);
      if (name.length < NAME_MIN || name.length > NAME_MAX) throw new Error("NAME_LENGTH");
      if (name !== alliance.name) {
        const exists = await tx.alliance.findUnique({ where: { name } });
        if (exists) throw new Error("NAME_TAKEN");
        data.name = name;
      }
    }
    if (patch.tag !== undefined) {
      const tag = normalizeTag(patch.tag);
      if (tag.length < TAG_MIN || tag.length > TAG_MAX) throw new Error("TAG_LENGTH");
      if (!/^[A-Z0-9]+$/.test(tag)) throw new Error("TAG_FORMAT");
      if (tag !== alliance.tag) {
        const exists = await tx.alliance.findUnique({ where: { tag } });
        if (exists) throw new Error("TAG_TAKEN");
        data.tag = tag;
      }
    }
    if (patch.description !== undefined) {
      const desc = patch.description?.trim() || null;
      if (desc && desc.length > DESC_MAX) throw new Error("DESCRIPTION_TOO_LONG");
      data.description = desc;
    }
    if (patch.accessMode !== undefined) {
      if (!ACCESS_MODES.includes(patch.accessMode)) throw new Error("INVALID_ACCESS_MODE");
      data.accessMode = patch.accessMode;
    }

    if (Object.keys(data).length === 0) return alliance;
    return await tx.alliance.update({ where: { id: alliance.id }, data });
  });
}

// ─── Invitations ────────────────────────────────────────────────────────────────

export async function inviteByUsername(leaderId: string, username: string) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");

    const target = await tx.user.findUnique({
      where: { username: username.trim() },
      select: { id: true, allianceId: true },
    });
    if (!target) throw new Error("USER_NOT_FOUND");
    if (target.id === leaderId) throw new Error("CANNOT_INVITE_SELF");
    if (target.allianceId === alliance.id) throw new Error("ALREADY_MEMBER");
    if (target.allianceId) throw new Error("USER_IN_OTHER_ALLIANCE");

    const existing = await tx.allianceInvitation.findUnique({
      where: { allianceId_userId: { allianceId: alliance.id, userId: target.id } },
    });
    if (existing) throw new Error("ALREADY_INVITED");

    return tx.allianceInvitation.create({
      data: { allianceId: alliance.id, userId: target.id },
    });
  });
}

export async function cancelInvitation(leaderId: string, invitationId: string) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");
    const invite = await tx.allianceInvitation.findUnique({ where: { id: invitationId } });
    if (!invite || invite.allianceId !== alliance.id) throw new Error("INVITATION_NOT_FOUND");
    await tx.allianceInvitation.delete({ where: { id: invitationId } });
    return { id: invitationId };
  });
}

export async function listAllianceInvitations(leaderId: string) {
  const alliance = await prisma.alliance.findUnique({ where: { leaderId } });
  if (!alliance) throw new Error("NOT_LEADER");
  const rows = await prisma.allianceInvitation.findMany({
    where: { allianceId: alliance.id },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({ id: r.id, user: r.user, createdAt: r.createdAt }));
}

export async function listMyInvitations(userId: string) {
  const rows = await prisma.allianceInvitation.findMany({
    where: { userId },
    include: {
      alliance: { select: { id: true, name: true, tag: true, accessMode: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({ id: r.id, alliance: r.alliance, createdAt: r.createdAt }));
}

export async function acceptInvitation(userId: string, invitationId: string) {
  return await prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
    if (!me) throw new Error("USER_NOT_FOUND");
    if (me.allianceId) throw new Error("ALREADY_IN_ALLIANCE");
    const invite = await tx.allianceInvitation.findUnique({ where: { id: invitationId } });
    if (!invite || invite.userId !== userId) throw new Error("INVITATION_NOT_FOUND");
    await tx.user.update({ where: { id: userId }, data: { allianceId: invite.allianceId } });
    await tx.allianceInvitation.deleteMany({ where: { userId } });
    await tx.allianceApplication.deleteMany({ where: { userId } });
    return tx.alliance.findUnique({ where: { id: invite.allianceId } });
  });
}

export async function rejectInvitation(userId: string, invitationId: string) {
  const invite = await prisma.allianceInvitation.findUnique({ where: { id: invitationId } });
  if (!invite || invite.userId !== userId) throw new Error("INVITATION_NOT_FOUND");
  await prisma.allianceInvitation.delete({ where: { id: invitationId } });
  return { id: invitationId };
}

// ─── Applications ───────────────────────────────────────────────────────────────

export async function submitApplication(userId: string, allianceId: string, rawMessage: string) {
  const message = rawMessage.trim();
  if (!message) throw new Error("MESSAGE_REQUIRED");
  if (message.length > APPLICATION_MSG_MAX) throw new Error("MESSAGE_TOO_LONG");

  return await prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
    if (!me) throw new Error("USER_NOT_FOUND");
    if (me.allianceId) throw new Error("ALREADY_IN_ALLIANCE");

    const alliance = await tx.alliance.findUnique({ where: { id: allianceId } });
    if (!alliance) throw new Error("ALLIANCE_NOT_FOUND");
    if (alliance.accessMode !== "APPLICATION") throw new Error("APPLICATIONS_CLOSED");

    const existing = await tx.allianceApplication.findUnique({
      where: { allianceId_userId: { allianceId, userId } },
    });
    if (existing) throw new Error("ALREADY_APPLIED");

    return tx.allianceApplication.create({
      data: { allianceId, userId, message },
    });
  });
}

export async function cancelMyApplication(userId: string) {
  const deleted = await prisma.allianceApplication.deleteMany({ where: { userId } });
  return { deleted: deleted.count };
}

export async function listMyApplication(userId: string) {
  const app = await prisma.allianceApplication.findFirst({
    where: { userId },
    include: { alliance: { select: { id: true, name: true, tag: true } } },
  });
  return app ? { id: app.id, alliance: app.alliance, message: app.message, createdAt: app.createdAt } : null;
}

export async function listAllianceApplications(leaderId: string) {
  const alliance = await prisma.alliance.findUnique({ where: { leaderId } });
  if (!alliance) throw new Error("NOT_LEADER");
  const rows = await prisma.allianceApplication.findMany({
    where: { allianceId: alliance.id },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({ id: r.id, user: r.user, message: r.message, createdAt: r.createdAt }));
}

export async function acceptApplication(leaderId: string, applicationId: string) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");
    const app = await tx.allianceApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.allianceId !== alliance.id) throw new Error("APPLICATION_NOT_FOUND");

    const target = await tx.user.findUnique({ where: { id: app.userId }, select: { allianceId: true } });
    if (!target) throw new Error("USER_NOT_FOUND");
    if (target.allianceId) {
      // User joined elsewhere in the meantime; drop application.
      await tx.allianceApplication.delete({ where: { id: app.id } });
      throw new Error("USER_IN_OTHER_ALLIANCE");
    }
    await tx.user.update({ where: { id: app.userId }, data: { allianceId: alliance.id } });
    await tx.allianceApplication.deleteMany({ where: { userId: app.userId } });
    await tx.allianceInvitation.deleteMany({ where: { userId: app.userId } });
    return { id: app.id, userId: app.userId };
  });
}

export async function rejectApplication(leaderId: string, applicationId: string) {
  return await prisma.$transaction(async (tx) => {
    const alliance = await tx.alliance.findUnique({ where: { leaderId } });
    if (!alliance) throw new Error("NOT_LEADER");
    const app = await tx.allianceApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.allianceId !== alliance.id) throw new Error("APPLICATION_NOT_FOUND");
    await tx.allianceApplication.delete({ where: { id: applicationId } });
    return { id: applicationId };
  });
}

// ─── Messages ───────────────────────────────────────────────────────────────────

export async function listMessages(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
  if (!me?.allianceId) throw new Error("NOT_IN_ALLIANCE");
  const rows = await prisma.allianceMessage.findMany({
    where: { allianceId: me.allianceId, deleted: false },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map(m => ({ id: m.id, author: m.author, content: m.content, createdAt: m.createdAt }));
}

export async function deleteMessage(userId: string, messageId: string) {
  const msg = await prisma.allianceMessage.findUnique({
    where: { id: messageId },
    select: { authorId: true, allianceId: true, deleted: true },
  });
  if (!msg || msg.deleted) throw new Error("MESSAGE_NOT_FOUND");
  if (msg.authorId !== userId) throw new Error("NOT_MESSAGE_AUTHOR");
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
  if (me?.allianceId !== msg.allianceId) throw new Error("NOT_IN_ALLIANCE");
  await prisma.allianceMessage.update({ where: { id: messageId }, data: { deleted: true } });
}

export async function postMessage(userId: string, rawContent: string) {
  const content = rawContent.trim();
  if (!content) throw new Error("MESSAGE_REQUIRED");
  if (content.length > MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { allianceId: true } });
  if (!me?.allianceId) throw new Error("NOT_IN_ALLIANCE");
  return prisma.allianceMessage.create({
    data: { allianceId: me.allianceId, authorId: userId, content },
    include: { author: { select: { id: true, username: true } } },
  });
}
