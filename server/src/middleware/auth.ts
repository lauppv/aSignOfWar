import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";
import prisma from "../config/db";

export interface AuthRequest extends Request {
  userId?: string;
}

// Cache de userId-uri valide cu TTL scurt. Sub load, fiecare request autentificat
// facea findUnique pe User doar ca sa verifice ca contul nu a fost sters —
// dar nu exista nicio cale in cod prin care un user sa fie sters. Verificarea
// ramane (defensiv), dar e efectiv un set in memorie pentru durata TTL-ului,
// asa ca elimina sute de query-uri/sec sub locust fara sa schimbe comportamentul.
const userValidCache = new Map<string, number>();
const USER_CACHE_TTL_MS = 60_000;

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "TOKEN_MISSING" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string };

    const now = Date.now();
    const cachedUntil = userValidCache.get(decoded.id);
    if (cachedUntil && cachedUntil > now) {
      req.userId = decoded.id;
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true } });
    if (!user) {
      userValidCache.delete(decoded.id);
      return res.status(401).json({ error: "TOKEN_INVALID" });
    }
    userValidCache.set(decoded.id, now + USER_CACHE_TTL_MS);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "TOKEN_INVALID" });
  }
};