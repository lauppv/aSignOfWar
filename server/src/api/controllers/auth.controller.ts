import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/db";
import env from "../../config/env";

export const register = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ mesaj: "Toate campurile sunt obligatorii" });
  }

  const existent = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existent) {
    return res.status(409).json({ mesaj: "Email sau username deja folosit" });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { username, email, password: hash },
  });

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return res.status(201).json({ token, username: user.username });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mesaj: "Email si parola sunt obligatorii" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ mesaj: "Credentiale invalide" });
  }

  const potrivire = await bcrypt.compare(password, user.password);

  if (!potrivire) {
    return res.status(401).json({ mesaj: "Credentiale invalide" });
  }

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return res.json({ token, username: user.username });
};