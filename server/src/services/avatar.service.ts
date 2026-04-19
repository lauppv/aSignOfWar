import path from "path";
import fs from "fs";
import prisma from "../config/db";

const UPLOADS_DIR = path.join(__dirname, "../../uploads/avatars");
const MIN_SIZE = 20;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function parseImageHeader(buf: Buffer): { width: number; height: number } | null {
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    if (buf.length < 24) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(18) };
  }
  // JPEG — scan for SOF0/SOF2 marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
    return null;
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    if (buf.length < 10) return null;
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    if (buf.toString("ascii", 12, 16) === "VP8 " && buf.length > 30) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (buf.toString("ascii", 12, 16) === "VP8L" && buf.length > 25) {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export async function uploadUserAvatar(userId: string, file: Express.Multer.File) {
  if (file.size > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");

  const dims = parseImageHeader(file.buffer);
  if (!dims) throw new Error("INVALID_IMAGE");
  if (dims.width < MIN_SIZE || dims.height < MIN_SIZE) throw new Error("IMAGE_TOO_SMALL");

  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `user_${userId}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(filePath, file.buffer);

  const avatarUrl = `/uploads/avatars/${filename}`;
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
  return avatarUrl;
}

export async function uploadAllianceAvatar(allianceId: string, userId: string, file: Express.Multer.File) {
  const alliance = await prisma.alliance.findUnique({
    where: { id: allianceId },
    select: { leaderId: true },
  });
  if (!alliance) throw new Error("ALLIANCE_NOT_FOUND");
  if (alliance.leaderId !== userId) throw new Error("FORBIDDEN");

  if (file.size > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");

  const dims = parseImageHeader(file.buffer);
  if (!dims) throw new Error("INVALID_IMAGE");
  if (dims.width < MIN_SIZE || dims.height < MIN_SIZE) throw new Error("IMAGE_TOO_SMALL");

  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `alliance_${allianceId}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(filePath, file.buffer);

  const avatarUrl = `/uploads/avatars/${filename}`;
  await prisma.alliance.update({
    where: { id: allianceId },
    data: { avatarUrl },
  });
  return avatarUrl;
}
