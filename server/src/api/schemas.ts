import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email:    z.string().email(),
  password: z.string().min(6).max(100),
  cityName: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// ─── City ────────────────────────────────────────────────────────────────────

export const renameCitySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

// ─── Governor ────────────────────────────────────────────────────────────────

export const depositGovernorSchema = z.object({
  cityId:   z.string().uuid(),
  resource: z.enum(["money", "energy", "ammo"]),
  amount:   z.number().positive(),
});

export const recruitGovernorSchema = z.object({
  cityId: z.string().uuid(),
});

// ─── Recruitment ─────────────────────────────────────────────────────────────

export const recruitSchema = z.object({
  unitName: z.enum([
    "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "HEAVY_INFANTRY",
    "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK",
    "MISSILE_LAUNCHER", "DRONE", "GOVERNOR", "HACKER",
  ]),
  quantity: z.number().int().min(1),
});

// ─── Commands ────────────────────────────────────────────────────────────────

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
