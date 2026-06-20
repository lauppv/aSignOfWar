import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../core/db";
import env from "../../core/env";
import { createStarterCity } from "../city/city.service";
import { createGhostCitiesAround } from "../map/map.service";

// This used to have a retry loop with 5 attempts (MAX_REGISTER_RETRIES) because
// two simultaneous registrations could pick the same slot and one would fail with P2002 (unique constraint).
// With the allocator this can no longer happen, so retries are no longer needed.
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

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { username, email, password: hash },
    });
    const starter = await createStarterCity(newUser.id, cityName, tx);
    return { user: newUser, starter };
  });

  // Fire-and-forget — the user doesn't wait for ghost cities, they enter the game directly.
  // The slots are already reserved in memory by the allocator, the DB insert happens async.
  createGhostCitiesAround({ x: result.starter.x, y: result.starter.y }, 3)
    .catch(err => console.error("Ghost city creation failed:", err));

  const token = jwt.sign({ id: result.user.id }, env.jwtSecret, { expiresIn: "7d" });
  return { token, username: result.user.username };
};

export const loginUser = async (username: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: "7d" });

  return { token, username: user.username };
};
