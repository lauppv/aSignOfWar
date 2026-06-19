import { z } from "zod";

export const recruitSchema = z.object({
  unitName: z.enum([
    "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "HEAVY_INFANTRY",
    "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK",
    "MISSILE_LAUNCHER", "DRONE", "GOVERNOR", "HACKER",
  ]),
  quantity: z.number().int().min(1),
});
