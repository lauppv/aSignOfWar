import { z } from "zod";

const unitCountsSchema = z.partialRecord(
  z.enum([
    "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "HEAVY_INFANTRY",
    "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK",
    "MISSILE_LAUNCHER", "DRONE", "GOVERNOR", "HACKER",
  ]),
  z.number().int().min(0)
).optional().default({});

const resourcesSchema = z.object({
  money:  z.number().min(0).default(0),
  energy: z.number().min(0).default(0),
  ammo:   z.number().min(0).default(0),
}).optional().default({ money: 0, energy: 0, ammo: 0 });

export const sendCommandSchema = z.object({
  type:         z.enum(["ATTACK", "SUPPORT", "RESOURCES", "SPY"]),
  targetCityId: z.string().uuid(),
  units:        unitCountsSchema,
  resources:    resourcesSchema,
  targetBuilding: z.enum([
    "HEADQUARTERS", "BANK", "POWER_PLANT", "WEAPONS_FACTORY",
    "MILITARY_BASE", "HOUSING", "WAREHOUSE", "HARBOR", "AIR_DEFENSE",
  ]).optional(),
});
