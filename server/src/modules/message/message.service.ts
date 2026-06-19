import * as messages from "./message.repository";

const MESSAGE_MAX = 2000;

// ─── Direct messages ──────────────────────────────────────────────────────────

export async function sendDirect(fromId: string, toUsername: string, rawContent: string) {
  const content = rawContent.trim();
  if (!content) throw new Error("MESSAGE_REQUIRED");
  if (content.length > MESSAGE_MAX) throw new Error("MESSAGE_TOO_LONG");

  const to = await messages.findUserByUsername(toUsername);
  if (!to) throw new Error("RECIPIENT_NOT_FOUND");
  if (to.id === fromId) throw new Error("CANNOT_MESSAGE_SELF");

  const row = await messages.insertDirect(fromId, to.id, content);
  return serializeDirect(row, fromId);
}

export async function listThread(userId: string, peerId: string) {
  // Marcam ca citite toate mesajele primite de la peer cand userul deschide firul.
  await messages.markThreadRead(peerId, userId);

  const rows = await messages.findThread(userId, peerId);
  return rows.map(r => serializeDirect(r, userId));
}

export async function listConversations(userId: string) {
  // Toate mesajele nesterse implicate de user, sortate desc; deduplicam pe peer.
  const rows = await messages.findConversations(userId);

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
  const msg = await messages.findDirectById(messageId);
  if (!msg) throw new Error("MESSAGE_NOT_FOUND");
  if (msg.fromId !== userId && msg.toId !== userId) throw new Error("NOT_PARTICIPANT");

  const isAuthor = msg.fromId === userId;
  await messages.softDeleteDirect(messageId, isAuthor);
}

export async function countUnreadDirect(userId: string) {
  return messages.countUnreadDirect(userId);
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
