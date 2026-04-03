import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Middleware care valideaza req.body cu o schema Zod
// Daca e valid, pune datele parsate in req.body si continua
// Daca nu, returneaza 400 cu erorile
export const validate = (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      // Mesajul va fi primul error, concis si specific
      const mesaj = errors.map((e) => e.path ? `${e.path}: ${e.message}` : e.message).join("; ");
      return res.status(400).json({ mesaj, errors });
    }
    req.body = result.data;
    next();
  };
