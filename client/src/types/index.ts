// Types matching backend Prisma response shapes
// BuildingName, UnitName, UnitCategory vin din sursa unica de adevar (shared/)

import type { BuildingName, UnitName, UnitCategory } from "@shared/gameConfig.ts";
export type { BuildingName, UnitName, UnitCategory };

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
  departureAt: string;
  arrivalAt: string;
  units: CommandUnit[];
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  toCity: { id: string; name: string; x: number; y: number; owner: { username: string } | null };
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
  fromCity: { name: string; x: number; y: number; owner: { username: string } | null };
}

export interface CityCommands {
  outgoing: OutgoingCommand[];
  incoming: IncomingCommand[];
}

export interface CityOverview {
  id: string;
  name: string;
  x: number;
  y: number;
  money: number;
  energy: number;
  ammo: number;
  loyalty: number;
  buildings: Building[];
  units: Unit[];
  supportUnits: BattleUnitCount[];
  totalPopulation: number;
  buildingUpgradeOrders: BuildingUpgradeOrder[];
  recruitmentOrders: RecruitmentOrder[];
}

export interface MapCity {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: { username: string } | null;
}

export interface WorldMap {
  size: number;
  cities: MapCity[];
}

export interface BattleUnitCount {
  name: UnitName;
  quantity: number;
}

export interface BattleReportData {
  attackerWon: boolean;
  attackerInitial: BattleUnitCount[];
  attackerSurvivors: BattleUnitCount[];
  defenderInitial: BattleUnitCount[];
  defenderSurvivors: BattleUnitCount[];
  airDefenseInitialLevel: number;
  newAirDefenseLevel: number;
  airDefenseLevelsDestroyed: number;
  stolenMoney: number;
  stolenEnergy: number;
  stolenAmmo: number;
  loyaltyDamage: number;
  battleAt: string;
}

export type CommandReportType = "ATTACK" | "SUPPORT" | "RESOURCES";

export interface BattleReport {
  id: string;
  type: CommandReportType;
  arrivalAt: string;
  status: string;
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  direction: "outgoing" | "incoming";
  units: BattleUnitCount[];
  fromCity: { id: string; name: string; x: number; y: number; owner: { username: string } | null };
  toCity:   { id: string; name: string; x: number; y: number; owner: { username: string } | null };
  report: BattleReportData | null;
}
