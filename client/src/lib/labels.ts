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
  HEADQUARTERS:    "The beating heart of your empire. Every order flows from here — construction accelerates, new technologies are unlocked, and the city bends to your will. Without it, nothing rises.",
  BANK:            "Vaults lined with gold and guarded day and night. The bank fuels your war machine with a steady stream of money, growing richer with every upgrade. Wealth is power.",
  POWER_PLANT:     "A roaring colossus of generators and turbines. It channels raw energy into every corner of your city, powering factories, defenses, and the machinery of conquest.",
  WEAPONS_FACTORY: "The forge where bullets are cast and warheads assembled. Smoke rises endlessly from its chimneys as ammunition stockpiles grow, readying your forces for the battles ahead.",
  HOUSING:         "Rows of barracks and residences stretch across the district. Every upgrade draws more citizens and soldiers to your cause, expanding the ranks you can field in war.",
  WAREHOUSE:       "A sprawling complex of reinforced bunkers and storage bays. It safeguards your money, energy, and ammunition from both decay and enemy raids. The bigger it grows, the more you can hoard.",
  MILITARY_BASE:   "The crucible where raw recruits are forged into soldiers. Training grounds, armories, and drill fields sprawl across the compound. Higher levels produce hardened warriors faster.",
  HARBOR:          "Cranes and cargo ships line the docks, ready to move resources across the waters. The harbor connects your city to allies, enabling vital supply lines that can turn the tide of war.",
  AIR_DEFENSE:     "Missile batteries and radar arrays scan the skies without rest. When enemy aircraft dare approach, a curtain of fire rises to meet them. Upgrade to make your airspace a graveyard for invaders.",
};

// Short descriptions used in the HQ building list
export const BUILDING_SHORT_DESC: Record<BuildingName, string> = {
  HEADQUARTERS:    "The nerve center of your city. Upgrading reduces construction time and unlocks new buildings and units.",
  BANK:            "Generates money over time. Higher levels increase production rate.",
  POWER_PLANT:     "Generates energy over time. Higher levels increase production rate.",
  WEAPONS_FACTORY: "Generates ammo over time. Higher levels increase production rate.",
  HOUSING:         "Increases maximum population, allowing you to field larger armies.",
  WAREHOUSE:       "Increases resource storage capacity for all resource types.",
  MILITARY_BASE:   "Enables unit recruitment and reduces training time at higher levels.",
  HARBOR:          "Enables sending resources to allied cities. Higher levels increase capacity.",
  AIR_DEFENSE:     "Protects your city against aerial attacks, increasing your defensive bonus.",
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
