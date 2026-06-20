// Types matching backend Prisma response shapes
// BuildingName, UnitName, UnitCategory come from the single source of truth (shared/)

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
  type: "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";
  status: string;
  departureAt: string;
  arrivalAt: string;
  units: CommandUnit[];
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  toCity: { id: string; name: string; x: number; y: number; owner: { id: string; username: string } | null };
}

export interface IncomingCommand {
  id: string;
  type: "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";
  status: string;
  arrivalAt: string;
  units: CommandUnit[];
  resourceMoney: number;
  resourceEnergy: number;
  resourceAmmo: number;
  fromCity: { name: string; x: number; y: number; owner: { id: string; username: string } | null };
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
  buildings: Building[];
  units: Unit[];
  supportUnits: BattleUnitCount[];
  totalPopulation: number;
  buildingUpgradeOrders: BuildingUpgradeOrder[];
  recruitmentOrders: RecruitmentOrder[];
  ownedCities: { id: string; name: string; x: number; y: number }[];
}

export interface MapCity {
  id: string;
  name: string;
  x: number;
  y: number;
  owner: {
    id: string;
    username: string;
    allianceId: string | null;
    alliance: { id: string; tag: string; name: string } | null;
  } | null;
  points: number;
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
  defenderInitial?: BattleUnitCount[];
  defenderSurvivors?: BattleUnitCount[];
  attackerLosses?: BattleUnitCount[];
  defenderLosses?: BattleUnitCount[];
  airDefenseInitialLevel?: number;
  newAirDefenseLevel?: number;
  airDefenseLevelsDestroyed?: number;
  targetBuilding?: string;
  targetBuildingInitialLevel?: number;
  buildingLevelsDestroyed?: number;
  stolenMoney: number;
  stolenEnergy: number;
  stolenAmmo: number;
  /** @deprecated kept for legacy reports; new system uses sieges, not loyalty drops. */
  loyaltyDamage?: number;
  /** @deprecated legacy field, kept so old reports still render. */
  conquered?: boolean;
  /** True when this attack started a siege (governor + survivors broke through). */
  siegeStarted?: boolean;
  /** Siege id created by this attack — used to power the "Share siege" button. */
  siegeId?: string | null;
  /** True when this report is a siege defense notification for the besieger. */
  siegeDefenseReport?: boolean;
  /** True when the siege was destroyed as a result of this battle. */
  siegeBroken?: boolean;
  battleAt: string;
}

export type CommandReportType = "ATTACK" | "SUPPORT" | "RESOURCES" | "SPY";

export interface WithdrawalReportData {
  withdrawal: true;
  withdrawnAt: string;
}

export interface SpyReportData {
  spyReport: true;
  success: boolean;
  attackerHackers: number;
  defenderHackers: number;
  defenderHackerLosses: number;
  attackerSurvivors: number;
  snapshot: {
    buildings: { name: BuildingName; level: number }[];
    units:     BattleUnitCount[];
    resources?: { money: number; energy: number; ammo: number };
  } | null;
  battleAt: string;
}

export interface ConquestReportData {
  conquestCompleted: true;
  siegeId: string;
  siegeStartedAt: string;
  siegeEndedAt: string;
  conqueredCityName: string;
  battleAt: string;
}

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
  fromCity: { id: string; name: string; x: number; y: number; owner: { id: string; username: string } | null };
  toCity:   { id: string; name: string; x: number; y: number; owner: { id: string; username: string } | null };
  report: BattleReportData | SpyReportData | WithdrawalReportData | ConquestReportData | null;
}