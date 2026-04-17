import prisma from "../config/db";

const MESSAGE_MAX = 2000;

// ─── Direct messages ──────────────────────────────────────────────────────────

export async function sendDirect(fromId: string, toUsername: string, rawContent: string) {
  const content = rawContent.trim();
  if (!content) throw new Error("MESSAGE_REQUIRED");
  if (content.length > MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const to = await prisma.user.findUnique({ where: { username: toUsername }, select: { id: true, username: true } });
  if (!to) throw new Error("RECIPIENT_NOT_FOUND");
  if (to.id === fromId) throw new Error("CANNOT_MESSAGE_SELF");

  const row = await prisma.directMessage.create({
    data: { fromId, toId: to.id, content },
    include: {
      from: { select: { id: true, username: true } },
      to:   { select: { id: true, username: true } },
    },
  });
  return serializeDirect(row, fromId);
}

export async function listThread(userId: string, peerId: string) {
  // Marcam ca citite toate mesajele primite de la peer cand userul deschide firul.
  await prisma.directMessage.updateMany({
    where: { fromId: peerId, toId: userId, readByRecipient: false },
    data:  { readByRecipient: true },
  });

  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { fromId: userId, toId: peerId, deletedByFrom: false },
        { fromId: peerId, toId: userId, deletedByTo:   false },
      ],
    },
    include: {
      from: { select: { id: true, username: true } },
      to:   { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return rows.map(r => serializeDirect(r, userId));
}

export async function listConversations(userId: string) {
  // Toate mesajele nesterse implicate de user, sortate desc; deduplicam pe peer.
  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { fromId: userId, deletedByFrom: false },
        { toId:   userId, deletedByTo:   false },
      ],
    },
    include: {
      from: { select: { id: true, username: true } },
      to:   { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const byPeer = new Map<string, {
    peer: { id: string; username: string };
    lastContent: string;
    lastAt: Date;
    lastFromMe: boolean;
    unread: number;
  }>();

  for (const r of rows) {
    const iAmFrom = r.fromId === userId;
    const peer = iAmFrom ? r.to : r.from;
    const existing = byPeer.get(peer.id);
    const isUnreadForMe = !iAmFrom && !r.readByRecipient;
    if (!existing) {
      byPeer.set(peer.id, {
        peer,
        lastContent: r.content,
        lastAt: r.createdAt,
        lastFromMe: iAmFrom,
        unread: isUnreadForMe ? 1 : 0,
      });
    } else if (isUnreadForMe) {
      existing.unread += 1;
    }
  }

  return Array.from(byPeer.values()).map(c => ({
    peer: c.peer,
    lastContent: c.lastContent,
    lastAt: c.lastAt,
    lastFromMe: c.lastFromMe,
    unread: c.unread,
  }));
}

export async function deleteDirect(userId: string, messageId: string) {
  const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error("MESSAGE_NOT_FOUND");
  if (msg.fromId !== userId && msg.toId !== userId) throw new Error("NOT_PARTICIPANT");

  const isAuthor = msg.fromId === userId;
  await prisma.directMessage.update({
    where: { id: messageId },
    data: isAuthor ? { deletedByFrom: true } : { deletedByTo: true },
  });
}

export async function countUnreadDirect(userId: string) {
  return prisma.directMessage.count({
    where: { toId: userId, readByRecipient: false, deletedByTo: false },
  });
}

// ─── Shared shape for client ──────────────────────────────────────────────────

type RawDirect = {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  createdAt: Date;
  readByRecipient: boolean;
  from: { id: string; username: string };
  to:   { id: string; username: string };
};

function serializeDirect(r: RawDirect, viewerId: string) {
  return {
    id: r.id,
    from: r.from,
    to: r.to,
    content: r.content,
    createdAt: r.createdAt,
    mine: r.fromId === viewerId,
    readByRecipient: r.readByRecipient,
  };
}
