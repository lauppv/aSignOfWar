import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import env from "../config/env";
import { createStarterCity } from "./city.service";
import { createGhostCitiesAround } from "./map.service";

export const registerUser = async (
  username: string,
  email: string,
  password: string,
  cityName: string
) => {
  const [byUsername, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (byUsername && byEmail) throw new Error("USERNAME_AND_EMAIL_TAKEN");
  if (byUsername)            throw new Error("USERNAME_TAKEN");
  if (byEmail)              throw new Error("EMAIL_TAKEN");

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { username, email, password: hash },
    });
    const starter = await createStarterCity(newUser.id, cityName, tx);
    await createGhostCitiesAround({ x: starter.x, y: starter.y }, 3, tx);
    return newUser;
  });

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return { token, username: user.username };
};

export const loginUser = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const potrivire = await bcrypt.compare(password, user.password);

  if (!potrivire) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return { token, username: user.username };
};
