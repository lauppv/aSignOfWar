import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Middleware that validates req.body against a Zod schema.
// If valid, it puts the parsed data on req.body and continues.
// If not, it returns 400 with the errors.
export const validate = (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      const error = errors.map((e) => e.path ? `${e.path}: ${e.message}` : e.message).join("; ");
      return res.status(400).json({ error, errors });
    }
    req.body = result.data;
    next();
  };
