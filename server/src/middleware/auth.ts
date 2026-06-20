import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../core/env";
import prisma from "../core/db";

export interface AuthRequest extends Request {
  userId?: string;
}

// Cache of valid userIds with a short TTL. Under load, every authenticated request
// ran findUnique on User just to verify the account hadn't been deleted —
// but there's no code path that deletes a user. The check stays (defensively),
// but it's effectively an in-memory set for the TTL duration, so it eliminates
// hundreds of queries/sec under locust without changing behavior.
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