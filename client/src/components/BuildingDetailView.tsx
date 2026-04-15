import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upgradeBuilding, cancelBuildingOrder } from "../api/city.ts";
import ConfirmModal from "./ConfirmModal.tsx";
import {
  BUILDINGS,
  getBuildingUpgradeCost,
  getBuildingUpgradeTime,
  getResourceProduction,
  getWarehouseCapacity,
  getHousingCapacity as getMaxPopulation,
  getHarborCapacity,
  getAirDefenseBonus,
} from "@shared/gameConfig.ts";
import { getBuildingLevel, fmtDuration } from "../lib/cityHelpers.ts";
import { GAME_SPEED } from "../lib/gameSpeed.ts";
import { BUILDING_DISPLAY, BUILDING_DESCRIPTION } from "../lib/labels.ts";
import type { CityOverview, BuildingName } from "../types/index.ts";

interface StatRow { label: string; current: string | number; next: string | number; }

function getStats(name: BuildingName, level: number, hqLevel: number): StatRow[] {
  const cfg     = BUILDINGS[name];
  const nextLvl = Math.min(level + 1, cfg.maxLevel);

  const timeNow  = level  > 0 ? fmtDuration(getBuildingUpgradeTime(name, level,  hqLevel, GAME_SPEED)) : "—";
  const timeNext =               fmtDuration(getBuildingUpgradeTime(name, nextLvl, hqLevel, GAME_SPEED));

  const base: StatRow[] = [
    { label: "Build time (next lvl)", current: timeNow, next: timeNext },
  ];

  switch (name) {
    case "BANK":
    case "POWER_PLANT":
    case "WEAPONS_FACTORY": {
      const res  = name === "BANK" ? "Money" : name === "POWER_PLANT" ? "Energy" : "Ammo";
      return [
        { label: `${res} production / hr`, current: level  > 0 ? getResourceProduction(level, GAME_SPEED).toLocaleString()  : "—", next: getResourceProduction(nextLvl, GAME_SPEED).toLocaleString() },
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
  const cancelMutation  = useMutation({ mutationFn: cancelBuildingOrder, onSuccess: invalidate });

  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg      = BUILDINGS[name];
  const building = city.buildings.find((b) => b.name === name);
  const level    = building?.level ?? 0;
  const hqLevel  = getBuildingLevel(city, "HEADQUARTERS");

  const now = Date.now();
  const pendingOrders = city.buildingUpgradeOrders.filter(
    (o) => o.buildingName === name && new Date(o.finishAt).getTime() > now
  );
  const effectiveLevel = level + pendingOrders.length;
  const isMaxLevel  = effectiveLevel >= cfg.maxLevel;
  const needsHQ     = (cfg.requiresHQ ?? 0) > hqLevel;
  const cost        = getBuildingUpgradeCost(name, effectiveLevel);
  const canAfford   = city.money >= cost.money && city.energy >= cost.energy && city.ammo >= cost.ammo;
  const timeSec     = getBuildingUpgradeTime(name, effectiveLevel, hqLevel, GAME_SPEED);

  const stats = getStats(name, level, hqLevel);

  function handleCancel(orderId: string) {
    setCancelOrderId(orderId);
  }

  let upgradeNode: React.ReactNode;
  if (isMaxLevel) {
    upgradeNode = <span className="text-[#3fb950] text-sm font-medium">Maximum level reached</span>;
  } else if (needsHQ) {
    upgradeNode = <span className="text-[#f85149] text-sm">Requires HQ level {cfg.requiresHQ}</span>;
  } else {
    upgradeNode = (
      <div className="flex flex-col gap-3">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#7d8590] border-b border-[#21262d]">
              <th className="text-right py-1 pr-4 font-normal text-[#7ee787]">Money</th>
              <th className="text-right py-1 pr-4 font-normal text-[#79c0ff]">Energy</th>
              <th className="text-right py-1 pr-4 font-normal text-[#e3b341]">Ammo</th>
              <th className="text-right py-1 font-normal">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`py-1 pr-4 text-right ${city.money  >= cost.money  ? "text-[#7ee787]" : "text-[#f85149]"}`}>{fmt(cost.money)}</td>
              <td className={`py-1 pr-4 text-right ${city.energy >= cost.energy ? "text-[#79c0ff]" : "text-[#f85149]"}`}>{fmt(cost.energy)}</td>
              <td className={`py-1 pr-4 text-right ${city.ammo   >= cost.ammo   ? "text-[#e3b341]" : "text-[#f85149]"}`}>{fmt(cost.ammo)}</td>
              <td className="py-1 text-right text-[#b1bac4]">{fmtDuration(timeSec)}</td>
            </tr>
          </tbody>
        </table>
        <button
          onClick={() => building && upgradeMutation.mutate(building.id)}
          disabled={!canAfford || !building || upgradeMutation.isPending}
          className="self-start px-4 py-1.5 rounded text-sm font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2ea043]"
        >
          Upgrade to lvl {effectiveLevel + 1}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0d1117]">
        {/* Left 40%: image */}
        <div className="w-2/5 shrink-0 flex flex-col bg-[#0d1117] border-r border-[#30363d]">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e6b800]">{BUILDING_DISPLAY[name]}</h2>
              <button
                onClick={onClose}
                className="text-sm text-[#b1bac4] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#e6b800] hover:text-[#e6b800] cursor-pointer"
              >
                ← Back
              </button>
            </div>
            <p className="text-xs text-[#b1bac4] mt-1">{BUILDING_DESCRIPTION[name]}</p>
          </div>
          <div className="flex items-center justify-center p-4 flex-1 min-h-0">
            <img
              src={`/images/buildings/${name.toLowerCase()}.jpg`}
              alt={BUILDING_DISPLAY[name]}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>
        </div>

        {/* Right 60% */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Level badge */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-[#e6b800]">{level}</span>
            <span className="text-[#b1bac4] text-lg">/ {cfg.maxLevel}</span>
          </div>

          {/* Stats table */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-2">Stats</div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-[#b1bac4] border-b border-[#21262d]">
                  <th className="text-left py-1.5 font-normal">Stat</th>
                  <th className="text-right py-1.5 font-normal">Now (lvl {level})</th>
                  <th className="text-right py-1.5 font-normal pr-0">Next (lvl {Math.min(level + 1, cfg.maxLevel)})</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.label} className="border-b border-[#21262d]">
                    <td className="py-1.5 text-[#b1bac4] text-xs">{row.label}</td>
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

          {/* Pending orders for this building */}
          {pendingOrders.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-2">Queue</div>
              <div className="flex flex-col gap-1.5">
                {pendingOrders.map((order, i) => {
                  const totalSec  = Math.round((new Date(order.finishAt).getTime() - new Date(order.startAt).getTime()) / 1000);
                  const diff      = new Date(order.finishAt).getTime() - Date.now();
                  const s         = Math.max(0, Math.floor(diff / 1000));
                  const countdown = s === 0 ? "finishing..." : fmtDuration(s);

                  return (
                    <div key={order.id} className="flex items-center gap-3 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded">
                      <span className="text-[#7d8590] text-xs w-4 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-sm text-[#c9d1d9]">
                        {level + i} → {level + i + 1}
                      </span>
                      <span className="text-xs text-[#b1bac4] shrink-0">{fmtDuration(totalSec)}</span>
                      <span className="text-xs text-[#d29922] font-mono w-20 text-right shrink-0">{countdown}</span>
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancelMutation.isPending}
                        className="text-[10px] text-[#7d8590] hover:text-[#f85149] cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {cancelOrderId && (
          <ConfirmModal
            message="You will lose 25% of the resources. Are you sure you want to continue?"
            confirmLabel="Cancel order"
            cancelLabel="Keep order"
            onConfirm={() => {
              cancelMutation.mutate(cancelOrderId);
              setCancelOrderId(null);
            }}
            onCancel={() => setCancelOrderId(null)}
          />
        )}
    </div>
  );
}
