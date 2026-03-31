import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import env from "../config/env";
import { createStarterCity } from "./city.service";

export const registerUser = async (
  username: string,
  email: string,
  password: string,
  cityName: string
) => {
  const existent = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existent) {
    throw new Error("EMAIL_OR_USERNAME_TAKEN");
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { username, email, password: hash },
    });
    await createStarterCity(newUser.id, cityName, tx);
    return newUser;
  });

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return { token, username: user.username };
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

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
