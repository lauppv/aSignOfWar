import { Request, Response } from "express";
import { registerUser, loginUser } from "../../services/auth.service";

export const register = async (req: Request, res: Response) => {
  // Body deja validat de Zod (registerSchema)
  const { username, email, password, cityName } = req.body;

  try {
    const result = await registerUser(username, email, password, cityName);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "USERNAME_AND_EMAIL_TAKEN") {
      return res.status(409).json({ mesaj: "Username and email are already taken by another player" });
    }
    if (err.message === "USERNAME_TAKEN") {
      return res.status(409).json({ mesaj: "Username is already taken by another player" });
    }
    if (err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ mesaj: "Email is already registered by another player" });
    }
    if (err.message === "MAP_FULL") {
      return res.status(503).json({ mesaj: "The world map is full. No new cities can be placed right now" });
    }
    throw err;
  }
};

export const login = async (req: Request, res: Response) => {
  // Body deja validat de Zod (loginSchema)
  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);
    return res.json(result);
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ mesaj: "Username or password is incorrect" });
    }
    throw err;
  }
};
