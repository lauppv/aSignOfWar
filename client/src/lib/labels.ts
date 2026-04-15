import type { BuildingName, UnitName, UnitCategory } from "../types/index.ts";

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
  "HEADQUARTERS", "BANK", "POWER_PLANT", "WEAPONS_FACTORY",
  "HOUSING", "WAREHOUSE", "MILITARY_BASE", "HARBOR", "AIR_DEFENSE",
];

// ── Unit labels ─────────────────────────────────────────────────────────────

export const UNIT_DISPLAY: Record<UnitName, string> = {
  LIGHT_INFANTRY:     "Light infantry",
  DEFENDER_INFANTRY:  "Defender infantry",
  HEAVY_INFANTRY:     "Heavy infantry",
  SNIPER:             "Sniper",
  SPECIAL_FORCES:     "Special forces",
  RAIDER:             "Raider",
  TANK:               "Tank",
  MISSILE_LAUNCHER:   "Missile launcher",
  DRONE:              "Drone",
  GOVERNOR:           "Governor",
  HACKER:             "Hacker",
};

export const UNIT_DESCRIPTION: Record<UnitName, string> = {
  LIGHT_INFANTRY:     "Fast and expendable frontline troops. They hit hard on the attack and move quickly, but crumble under sustained fire. Send them in waves and overwhelm the enemy before they can react.",
  DEFENDER_INFANTRY:  "Heavily armored soldiers trained to hold the line at all costs. They absorb punishment that would break lesser units, turning your city walls into an impenetrable fortress.",
  HEAVY_INFANTRY: "Specialists armed with rocket launchers and shaped charges. They lie in wait for armored columns and tear through steel like paper. Every tank commander's nightmare.",
  SNIPER:             "Ghost-like marksmen who strike from impossible distances. A single sniper can pin down entire squads, picking off officers and sowing chaos long before the main force arrives.",
  SPECIAL_FORCES:     "Elite operatives trained in every form of warfare. Fast, deadly, and versatile — they excel on both offense and defense. Expensive to train, but worth every coin on the battlefield.",
  RAIDER:             "Lightning-fast strike units built for plunder. They tear through enemy lines, grab what they can carry, and vanish before reinforcements arrive. The backbone of any raiding party.",
  TANK:               "Rolling fortresses of steel and firepower. Tanks crush infantry formations and shrug off small arms fire. When the ground shakes, the enemy knows what's coming.",
  MISSILE_LAUNCHER:   "Long-range devastation on wheels. Missile launchers reduce enemy fortifications to rubble from a safe distance, softening defenses before your troops storm in.",
  DRONE:              "Unmanned aerial killers controlled from miles away. They rain death from above with surgical precision, bypassing ground defenses entirely. The future of warfare, hovering overhead.",
  GOVERNOR:           "A commanding figure of absolute authority. Governors don't fight — they conquer. Send one to a defeated city and it falls under your banner permanently. The ultimate instrument of empire.",
  HACKER:             "A ghost in the wires. Hackers slip past guards and ignore every soldier in the target city — their only enemy is another hacker. Send more than the enemy fields and you crack the network wide open; the losing side's spies leave as ashes in a server room while the defender's keep their posts.",
};

export const CATEGORY_LABEL: Record<UnitCategory, string> = {
  INFANTRY:   "Infantry",
  RANGE:      "Range",
  MECHANIZED: "Mechanized",
  SIEGE:      "Siege",
  CONQUER:    "Conquer",
  SPY:        "Spy",
};

// Unitatile care apar in lista de recrutare a Military Base
export const UNIT_ORDER: UnitName[] = [
  "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "HEAVY_INFANTRY",
  "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK", "MISSILE_LAUNCHER", "DRONE",
  "HACKER",
];

// Unitatile care pot participa la o lupta normala (fara Governor, fara Hacker)
export const BATTLE_UNIT_ORDER: UnitName[] = [
  "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "HEAVY_INFANTRY",
  "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK", "MISSILE_LAUNCHER", "DRONE",
];
