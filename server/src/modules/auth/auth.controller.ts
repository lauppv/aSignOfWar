import { Request, Response } from "express";
import { registerUser, loginUser } from "./auth.service";

export const register = async (req: Request, res: Response) => {
  const { username, email, password, cityName } = req.body;

  try {
    const result = await registerUser(username, email, password, cityName);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "USERNAME_AND_EMAIL_TAKEN") {
      return res.status(409).json({ error: "USERNAME_AND_EMAIL_TAKEN" });
    }
    if (err.message === "USERNAME_TAKEN") {
      return res.status(409).json({ error: "USERNAME_TAKEN" });
    }
    if (err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "EMAIL_TAKEN" });
    }
    if (err.message === "MAP_FULL") {
      return res.status(503).json({ error: "MAP_FULL" });
    }
    throw err;
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);
    return res.json(result);
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }
    throw err;
  }
};
