import prisma from "../../core/db";

// Data access for direct messages. Validation, serialization and conversation
// de-duplication stay in message.service.ts.

const participantSelect = {
  from: { select: { id: true, username: true } },
  to:   { select: { id: true, username: true } },
};

export const findUserByUsername = (username: string) =>
  prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });

export const insertDirect = (fromId: string, toId: string, content: string) =>
  prisma.directMessage.create({
    data: { fromId, toId, content },
    include: participantSelect,
  });

export const markThreadRead = (peerId: string, userId: string) =>
  prisma.directMessage.updateMany({
    where: { fromId: peerId, toId: userId, readByRecipient: false },
    data:  { readByRecipient: true },
  });

export const findThread = (userId: string, peerId: string) =>
  prisma.directMessage.findMany({
    where: {
      OR: [
        { fromId: userId, toId: peerId, deletedByFrom: false },
        { fromId: peerId, toId: userId, deletedByTo:   false },
      ],
    },
    include: participantSelect,
    orderBy: { createdAt: "asc" },
    take: 500,
  });

export const findConversations = (userId: string) =>
  prisma.directMessage.findMany({
    where: {
      OR: [
        { fromId: userId, deletedByFrom: false },
        { toId:   userId, deletedByTo:   false },
      ],
    },
    include: participantSelect,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

export const findDirectById = (messageId: string) =>
  prisma.directMessage.findUnique({ where: { id: messageId } });

export const softDeleteDirect = (messageId: string, isAuthor: boolean) =>
  prisma.directMessage.update({
    where: { id: messageId },
    data: isAuthor ? { deletedByFrom: true } : { deletedByTo: true },
  });

export const countUnreadDirect = (userId: string) =>
  prisma.directMessage.count({
    where: { toId: userId, readByRecipient: false, deletedByTo: false },
  });
