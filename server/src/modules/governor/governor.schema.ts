import { z } from "zod";

export const depositGovernorSchema = z.object({
  cityId:   z.string().uuid(),
  resource: z.enum(["money", "energy", "ammo"]),
  amount:   z.number().positive(),
});

export const recruitGovernorSchema = z.object({
  cityId: z.string().uuid(),
});
