import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upgradeBuilding } from "../api/city.ts";
import {
  BUILDINGS,
  getBuildingLevel,
  getBuildingUpgradeCost,
  getBuildingUpgradeTime,
  getResourceProduction,
  getWarehouseCapacity,
  getMaxPopulation,
  getHarborCapacity,
  getAirDefenseBonus,
  fmtDuration,
} from "../lib/gameConfig.ts";
import type { CityOverview, BuildingName } from "../types/index.ts";

// ── Config per clădire ────────────���───────────────────────────────────────────

const BUILDING_DISPLAY: Record<BuildingName, string> = {
  HEADQUARTERS:    "Headquarters",
  BANK:            "Bank",
  POWER_PLANT:     "Power Plant",
  WEAPONS_FACTORY: "Weapons Factory",
  HOUSING:         "Housing",
  WAREHOUSE:       "Warehouse",
  MILITARY_BASE:   "Military Base",
  HARBOR:          "Harbor",
  AIR_DEFENSE:     "Air Defense",
};

const BUILDING_DESCRIPTION: Record<BuildingName, string> = {
  HEADQUARTERS:    "The nerve center of your city. Reduces construction time and unlocks new buildings and units.",
  BANK:            "Generates money over time. Upgrade to increase hourly production.",
  POWER_PLANT:     "Generates energy over time. Upgrade to increase hourly production.",
  WEAPONS_FACTORY: "Generates ammo over time. Upgrade to increase hourly production.",
  HOUSING:         "Houses your population. Upgrade to allow larger armies.",
  WAREHOUSE:       "Stores your resources. Upgrade to increase storage capacity for all resource types.",
  MILITARY_BASE:   "Enables unit recruitment and reduces training time at higher levels.",
  HARBOR:          "Enables resource transfers to allied cities. Upgrade to increase transfer capacity.",
  AIR_DEFENSE:     "Protects your city against aerial attacks. Upgrade to increase defensive bonus.",
};

interface StatRow { label: string; current: string | number; next: string | number; }

function getStats(name: BuildingName, level: number, hqLevel: number): StatRow[] {
  const cfg     = BUILDINGS[name];
  const nextLvl = Math.min(level + 1, cfg.maxLevel);

  const timeNow  = level  > 0 ? fmtDuration(getBuildingUpgradeTime(name, level,  hqLevel)) : "—";
  const timeNext =               fmtDuration(getBuildingUpgradeTime(name, nextLvl, hqLevel));

  const base: StatRow[] = [
    { label: "Build time (next lvl)", current: timeNow, next: timeNext },
  ];

  switch (name) {
    case "BANK":
    case "POWER_PLANT":
    case "WEAPONS_FACTORY": {
      const res  = name === "BANK" ? "Money" : name === "POWER_PLANT" ? "Energy" : "Ammo";
      return [
        { label: `${res} production / hr`, current: level  > 0 ? getResourceProduction(level).toLocaleString()  : "—", next: getResourceProduction(nextLvl).toLocaleString() },
        ...base,
      ];
    }
    case "HOUSING":
      return [
        { label: "Max population", current: level > 0 ? getMaxPopulation(level).toLocaleString() : "—", next: getMaxPopulation(nextLvl).toLocaleString() },
        ...base,
      ];
    case "WAREHOUSE":
      return [
        { label: "Storage capacity", current: getWarehouseCapacity(level).toLocaleString(), next: getWarehouseCapacity(nextLvl).toLocaleString() },
        ...base,
      ];
    case "HARBOR":
      return [
        { label: "Transfer capacity", current: level > 0 ? getHarborCapacity(level).toLocaleString() : "—", next: getHarborCapacity(nextLvl).toLocaleString() },
        ...base,
      ];
    case "AIR_DEFENSE":
      return [
        { label: "Defense bonus", current: level > 0 ? `+${getAirDefenseBonus(level)}%` : "—", next: `+${getAirDefenseBonus(nextLvl)}%` },
        ...base,
      ];
    case "HEADQUARTERS":
      return [
        { label: "Build time reduction", current: `${Math.round((1 - Math.max(0.1, 1 - level * 0.02)) * 100)}%`, next: `${Math.round((1 - Math.max(0.1, 1 - nextLvl * 0.02)) * 100)}%` },
        ...base,
      ];
    case "MILITARY_BASE":
      return [
        { label: "Recruit speed bonus", current: level > 0 ? `${100 - [63,59,56,53,50,47,44,42,39,37,35,33,31,29,28,26,25,23,22,21,20,19,17,16,16][level-1]}%` : "—",
                                         next:             `${100 - [63,59,56,53,50,47,44,42,39,37,35,33,31,29,28,26,25,23,22,21,20,19,17,16,16][nextLvl-1]}%` },
        ...base,
      ];
    default:
      return base;
  }
}

// ── Component ────────────────────────────────────────��────────────────────────

interface Props {
  name: BuildingName;
  city: CityOverview;
  onClose: () => void;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function BuildingDetailView({ name, city, onClose }: Props) {
  const queryClient = useQueryClient();
  const invalidate  = () => queryClient.invalidateQueries({ queryKey: ["city"] });
  const upgradeMutation = useMutation({ mutationFn: upgradeBuilding, onSuccess: invalidate });

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg      = BUILDINGS[name];
  const building = city.buildings.find((b) => b.name === name);
  const level    = building?.level ?? 0;
  const hqLevel  = getBuildingLevel(city, "HEADQUARTERS");

  const isMaxLevel  = level >= cfg.maxLevel;
  const activeOrder = city.buildingUpgradeOrders.find((o) => o.buildingName === name);
  const isPending   = !!activeOrder;
  const needsHQ     = (cfg.requiresHQ ?? 0) > hqLevel;
  const cost        = getBuildingUpgradeCost(name, level);
  const canAfford   = city.money >= cost.money && city.energy >= cost.energy && city.ammo >= cost.ammo;
  const timeSec     = getBuildingUpgradeTime(name, level, hqLevel);

  const stats = getStats(name, level, hqLevel);

  let upgradeNode: React.ReactNode;
  if (isMaxLevel) {
    upgradeNode = <span className="text-[#3fb950] text-sm font-medium">Maximum level reached</span>;
  } else if (isPending && activeOrder) {
    const diff = new Date(activeOrder.finishAt).getTime() - Date.now();
    const s    = Math.max(0, Math.floor(diff / 1000));
    upgradeNode = (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[#d29922]">Upgrading to lvl {level + 1}</span>
        <span className="text-[#d29922] font-mono">{s === 0 ? "finishing..." : fmtDuration(s)}</span>
      </div>
    );
  } else if (needsHQ) {
    upgradeNode = <span className="text-[#f85149] text-sm">Requires HQ level {cfg.requiresHQ}</span>;
  } else {
    upgradeNode = (
      <div className="flex flex-col gap-3">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#484f58] border-b border-[#21262d]">
              <th className="text-right py-1 pr-4 font-normal">Money</th>
              <th className="text-right py-1 pr-4 font-normal">Energy</th>
              <th className="text-right py-1 pr-4 font-normal">Ammo</th>
              <th className="text-right py-1 font-normal">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`py-1 pr-4 text-right ${city.money  >= cost.money  ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cost.money)}</td>
              <td className={`py-1 pr-4 text-right ${city.energy >= cost.energy ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cost.energy)}</td>
              <td className={`py-1 pr-4 text-right ${city.ammo   >= cost.ammo   ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cost.ammo)}</td>
              <td className="py-1 text-right text-[#8b949e]">{fmtDuration(timeSec)}</td>
            </tr>
          </tbody>
        </table>
        <button
          onClick={() => building && upgradeMutation.mutate(building.id)}
          disabled={!canAfford || !building || upgradeMutation.isPending}
          className="self-start px-4 py-1.5 rounded text-sm font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2ea043]"
        >
          Upgrade to lvl {level + 1}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#e6b800]">{BUILDING_DISPLAY[name]}</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">{BUILDING_DESCRIPTION[name]}</p>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-[#8b949e] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#e6b800] hover:text-[#e6b800] cursor-pointer"
        >
          ← Back
        </button>
      </div>

      {/* Body: 40 / 60 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left 40%: image */}
        <div className="w-2/5 shrink-0 flex items-center justify-center bg-[#0d1117] border-r border-[#30363d] p-6">
          <img
            src={`/images/buildings/${name.toLowerCase()}.jpg`}
            alt={BUILDING_DISPLAY[name]}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Right 60% */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Level badge */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-[#e6b800]">{level}</span>
            <span className="text-[#484f58] text-lg">/ {cfg.maxLevel}</span>
            <span className="text-xs text-[#8b949e] uppercase tracking-widest">current level</span>
          </div>

          {/* Stats table */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-2">Stats</div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-[#484f58] border-b border-[#21262d]">
                  <th className="text-left py-1.5 font-normal">Stat</th>
                  <th className="text-right py-1.5 font-normal">Now (lvl {level})</th>
                  <th className="text-right py-1.5 font-normal pr-0">Next (lvl {Math.min(level + 1, cfg.maxLevel)})</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.label} className="border-b border-[#21262d]">
                    <td className="py-1.5 text-[#8b949e] text-xs">{row.label}</td>
                    <td className="py-1.5 text-right text-[#c9d1d9] text-xs">{row.current}</td>
                    <td className="py-1.5 text-right text-[#3fb950] text-xs pr-0 font-medium">{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upgrade */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-2">Upgrade</div>
            {upgradeNode}
          </div>
        </div>
      </div>
    </div>
  );
}
