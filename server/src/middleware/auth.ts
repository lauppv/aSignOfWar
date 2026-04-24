import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";
import prisma from "../config/db";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "TOKEN_MISSING" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true } });
    if (!user) return res.status(401).json({ error: "TOKEN_INVALID" });
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "TOKEN_INVALID" });
  }
};