import { Request, Response } from "express";
import { registerUser, loginUser } from "../../services/auth.service";

export const register = async (req: Request, res: Response) => {
  const { username, email, password, cityName } = req.body;

  if (!username || !email || !password || !cityName) {
    return res.status(400).json({ mesaj: "Toate campurile sunt obligatorii" });
  }

  try {
    const result = await registerUser(username, email, password, cityName);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "EMAIL_OR_USERNAME_TAKEN") {
      return res.status(409).json({ mesaj: "Email sau username deja folosit" });
    }
    throw err;
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mesaj: "Email si parola sunt obligatorii" });
  }

  try {
    const result = await loginUser(email, password);
    return res.json(result);
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ mesaj: "Credentiale invalide" });
    }
    throw err;
  }
};
