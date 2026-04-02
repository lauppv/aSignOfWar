// Types matching backend Prisma response shapes

export type BuildingName =
  | "HEADQUARTERS"
  | "BANK"
  | "POWER_PLANT"
  | "WEAPONS_FACTORY"
  | "HOUSING"
  | "WAREHOUSE"
  | "MILITARY_BASE"
  | "HARBOR"
  | "AIR_DEFENSE";

export type UnitName =
  | "LIGHT_INFANTRY"
  | "DEFENDER_INFANTRY"
  | "HEAVY_INFANTRY"
  | "SNIPER"
  | "SPECIAL_FORCES"
  | "RAIDER"
  | "TANK"
  | "MISSILE_LAUNCHER"
  | "DRONE"
  | "GOVERNOR";

export type UnitCategory = "INFANTRY" | "RANGE" | "MECHANIZED" | "SIEGE" | "CONQUER";

export interface Building {
  id: string;
  name: BuildingName;
  level: number;
}

export interface BuildingUpgradeOrder {
  id: string;
  buildingName: BuildingName;
  startAt: string;
  finishAt: string;
}

export interface Unit {
  id: string;
  name: UnitName;
  category: UnitCategory;
  quantity: number;
}

export interface RecruitmentOrder {
  id: string;
  unitName: UnitName;
  quantity: number;
  startAt: string;
  finishAt: string;
}

export interface CommandUnit {
  name: UnitName;
  quantity: number;
}

export interface OutgoingCommand {
  id: string;
  type: "ATTACK" | "SUPPORT" | "RESOURCES";
  status: string;
  arrivalAt: string;
  units: CommandUnit[];
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  toCity: { name: string; owner: { username: string } };
}

export interface IncomingCommand {
  id: string;
  type: "ATTACK" | "SUPPORT" | "RESOURCES";
  status: string;
  arrivalAt: string;
  units: CommandUnit[];
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  fromCity: { name: string; owner: { username: string } };
}

export interface CityCommands {
  outgoing: OutgoingCommand[];
  incoming: IncomingCommand[];
}

export interface CityOverview {
  id: string;
  name: string;
  money: number;
  energy: number;
  ammo: number;
  loyalty: number;
  buildings: Building[];
  units: Unit[];
  buildingUpgradeOrders: BuildingUpgradeOrder[];
  recruitmentOrders: RecruitmentOrder[];
}
