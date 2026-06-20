// Centralized display strings and color palettes for the UI. All visible names
// (buildings, units, commands) live here so I avoid magic strings scattered across 20+ components.
// This is NOT i18n — the game is English-only. If I needed multi-language, I'd replace
// these records with an actual library (react-intl, i18next).
import type { BuildingName, UnitName, UnitCategory } from "@/shared/types";
import type { CommandType } from "@/features/city/api/command";
import type { AllianceAccess } from "@/features/alliance/api/alliance";

// ── Command type colors ────────────────────────────────────────────────────
// Every command type has a consistent color palette across the UI:
// command rows (CityPage), detail modal, action panel (MapPage), reports.
// fg = foreground text, bg = subtle badge/header background.

export const CMD_COLORS: Record<CommandType, { fg: string; bg: string }> = {
  ATTACK:    { fg: "#f85149", bg: "#3d1a1a" },
  SUPPORT:   { fg: "#58a6ff", bg: "#0c2744" },
  RESOURCES: { fg: "#d29922", bg: "#3d2e0a" },
  SPY:       { fg: "#a371f7", bg: "#2e1a3d" },
};

export const CMD_LABEL: Record<CommandType, string> = {
  ATTACK: "Attack", SUPPORT: "Support", RESOURCES: "Resources", SPY: "Spy",
};

// ── Alliance access mode labels ────────────────────────────────────────────
// Used in AlliancePage and AllianceProfileModal.

export const ACCESS_LABEL: Record<AllianceAccess, string> = {
  OPEN: "Open", CLOSED: "Closed", INVITE_ONLY: "Invite only", APPLICATION: "Application",
};
export const ACCESS_COLOR: Record<AllianceAccess, string> = {
  OPEN: "#3fb950", CLOSED: "#8b949e", INVITE_ONLY: "#58a6ff", APPLICATION: "#d29922",
};

// ── Time formatting ────────────────────────────────────────────────────────
// fmtArrival: countdown from now to an ISO timestamp (command arrival).
// Duplicated between CityPage and CommandDetailModal before extraction.

export function fmtArrival(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "arriving...";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ── Building labels ─────────────────────────────────────────────────────────

export const BUILDING_DISPLAY: Record<BuildingName, string> = {
  HEADQUARTERS:    "Headquarters",
  BANK:            "Bank",
  POWER_PLANT:     "Power plant",
  WEAPONS_FACTORY: "Weapons factory",
  HOUSING:         "Housing",
  WAREHOUSE:       "Warehouse",
  MILITARY_BASE:   "Military base",
  HARBOR:          "Harbor",
  AIR_DEFENSE:     "Air defense",
};

// The units that appear in the Military Base recruitment list.
// Order: infantry, range, spy, cavalry/mixed, siege (as in TW)
export const UNIT_ORDER: UnitName[] = [
  "HEAVY_INFANTRY", "DEFENDER_INFANTRY", "LIGHT_INFANTRY", "SNIPER", "HACKER", "RAIDER", "SPECIAL_FORCES",  "TANK", "MISSILE_LAUNCHER", "DRONE",
];


export const BUILDING_DESCRIPTION: Record<BuildingName, string> = {
  HEADQUARTERS:    "Headquarters is the governing center of your city. Each upgrade reduces construction time for buildings and allows the recruitment of new units. Governors can also be recruited here, who conquer enemy cities—essential for the development of your empire.",
  BANK:            "Bank produces money, one of your city's resources. The higher the level, the greater the production.",
  POWER_PLANT:     "Power plant produces energy, one of your city's resources. The higher the level, the greater the production.",
  WEAPONS_FACTORY: "Weapons factory produces ammunition, one of your city's resources. The higher the level, the greater the production.",
  HOUSING:         "Housing increases the population capacity your city can support. Each level increases the capacity exponentially.",
  WAREHOUSE:       "Warehouse increases the storage capacity of your city's resources. Each level increases the capacity exponentially for all types of resources.",
  MILITARY_BASE:   "Military base allows the recruitment of military units. The higher the level, the shorter the recruitment time.",
  HARBOR:          "Harbor allows sending resources to other cities. The higher the level, the greater the transport capacity.",
  AIR_DEFENSE:     "Air defense protects the city from missile attacks. Each level increases your city's defensive bonus. The bonus applies to all units in the city, even if the attacking units are not using missiles.",
};


export const BUILDING_ORDER: BuildingName[] = [
  "HEADQUARTERS", "BANK", "POWER_PLANT", "WEAPONS_FACTORY", "HOUSING", "WAREHOUSE", "MILITARY_BASE", "HARBOR", "AIR_DEFENSE",
];

// ── Unit labels ─────────────────────────────────────────────────────────────

export const UNIT_DISPLAY: Record<UnitName, string> = {
  HEAVY_INFANTRY:     "Heavy infantry",
  DEFENDER_INFANTRY:  "Defender infantry",
  LIGHT_INFANTRY:     "Light infantry",
  SNIPER:             "Sniper",
  HACKER:             "Hacker",
  RAIDER:             "Raider",
  SPECIAL_FORCES:     "Special forces",
  TANK:               "Tank",
  MISSILE_LAUNCHER:   "Missile launcher",
  DRONE:              "Drone",
  GOVERNOR:           "Governor",
};

export const UNIT_DESCRIPTION: Record<UnitName, string> = { 
  HEAVY_INFANTRY:     "No shield is ever thick enough. Armed with heavy weapons, they form the backbone of the city's defense.",
  DEFENDER_INFANTRY:  "Pioneers of guerrilla warfare, defensive infantry know every corner of the city. They move slowly, but are hard to kill and perform exceptionally well in urban environments.",
  LIGHT_INFANTRY:     "Fast-moving soldiers armed with assault rifles and grenades. They excel at hit-and-run tactics, quickly striking vulnerable targets.",
  SNIPER:             "Experts in camouflage and lethal precision. They hide in the shadows, eliminating targets from afar with a single shot. An invisible presence that can change the course of a battle.",
  HACKER:             "A ghost in the wires. Hackers slip past guards and ignore every soldier in the target city — their only enemy is another hacker. Send more than the enemy fields and you crack the network wide open.",
  RAIDER:             "Lightning-fast strike units. Raiders are the shock troops of your army, designed to hit hard and disappear before the enemy can react.",
  SPECIAL_FORCES:     "Trained in every form of warfare, fast and deadly, they excel on both offense and defense.",
  TANK:               "Moving fortresses, tanks are effective on both defense and offense. Covered in heavy armor, they can absorb enemy fire and destroy everything in their path.",
  MISSILE_LAUNCHER:   "With a single press of a button, missile launchers make it easier for your units to break into enemy cities.",
  DRONE:              "A flying presence that dominates the skies. Drones can be used to destroy enemy buildings, forcing surrender.",
  GOVERNOR:           "Governors are special units capable of conquering enemy cities and bringing them under your control.",
};
export const CATEGORY_LABEL: Record<UnitCategory, string> = {
  INFANTRY:   "Infantry",
  RANGE:      "Range",
  MECHANIZED: "Mechanized",
  SIEGE:      "Siege",
  CONQUER:    "Conquer",
  SPY:        "Spy",
};


