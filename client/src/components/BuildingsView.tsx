import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upgradeBuilding, cancelBuildingOrder, recruitUnits } from "../api/city.ts";
import { BUILDINGS, UNITS, getBuildingUpgradeCost, getBuildingLevel, getBuildingUpgradeTime, getRecruitmentTime, fmtDuration } from "../lib/gameConfig.ts";
import type { CityOverview, BuildingName } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

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

const BUILDING_ORDER: BuildingName[] = [
  "HEADQUARTERS", "BANK", "POWER_PLANT", "WEAPONS_FACTORY",
  "HOUSING", "WAREHOUSE", "MILITARY_BASE", "HARBOR", "AIR_DEFENSE",
];

interface Props {
  city: CityOverview;
  onClose: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function BuildingsView({ city, onClose }: Props) {
  const { openUnit }    = useUnitInfo();
  const queryClient     = useQueryClient();
  const invalidate      = () => queryClient.invalidateQueries({ queryKey: ["city"] });
  const upgradeMutation = useMutation({ mutationFn: upgradeBuilding, onSuccess: invalidate });
  const cancelMutation  = useMutation({ mutationFn: cancelBuildingOrder, onSuccess: invalidate });
  const recruitMutation = useMutation({
    mutationFn: ({ quantity }: { quantity: number }) => recruitUnits(city.id, "GOVERNOR", quantity),
    onSuccess: invalidate,
  });

  const [govQty, setGovQty] = useState(1);

  // Ticker pentru countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hqLevel = getBuildingLevel(city, "HEADQUARTERS");

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#e6b800]">Headquarters</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">{BUILDING_DESCRIPTION["HEADQUARTERS"]}</p>
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
        {/* Left 40%: HQ image */}
        <div className="w-2/5 shrink-0 flex items-center justify-center bg-[#0d1117] border-r border-[#30363d] p-6">
          <img
            src="/images/buildings/headquarters.jpg"
            alt="Headquarters"
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Right 60%: Building list */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-[#8b949e] border-b border-[#30363d]">
                <th className="text-left py-2 pl-2 font-normal w-8"></th>
                <th className="text-left py-2 font-normal">Building</th>
                <th className="text-center py-2 font-normal">Level</th>
                <th className="text-right py-2 font-normal">Money</th>
                <th className="text-right py-2 font-normal">Energy</th>
                <th className="text-right py-2 font-normal">Ammo</th>
                <th className="text-right py-2 font-normal">Time</th>
                <th className="text-center py-2 pr-2 font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {BUILDING_ORDER.map((name) => {
                const cfg     = BUILDINGS[name];
                const building = city.buildings.find((b) => b.name === name);
                const level   = building?.level ?? 0;
                const cost    = getBuildingUpgradeCost(name, level);
                const timeSec = getBuildingUpgradeTime(name, level, hqLevel);
                const isMaxLevel  = level >= cfg.maxLevel;
                const isPending   = city.buildingUpgradeOrders.some((o) => o.buildingName === name);
                const hqRequired  = cfg.requiresHQ ?? 0;
                const needsHQ     = hqLevel < hqRequired;
                const canAfford   = city.money >= cost.money && city.energy >= cost.energy && city.ammo >= cost.ammo;

                let actionNode: React.ReactNode;
                if (isMaxLevel) {
                  actionNode = <span className="text-[#3fb950] text-xs font-medium">Max</span>;
                } else if (isPending) {
                  actionNode = <span className="text-[#d29922] text-xs">In queue</span>;
                } else if (needsHQ) {
                  actionNode = (
                    <span className="text-[#f85149] text-xs">HQ lvl {hqRequired} req.</span>
                  );
                } else {
                  actionNode = (
                    <button
                      onClick={() => building && upgradeMutation.mutate(building.id)}
                      disabled={!canAfford || !building || upgradeMutation.isPending}
                      className="px-2.5 py-1 rounded text-xs font-medium cursor-pointer
                        bg-[#238636] text-white
                        disabled:opacity-40 disabled:cursor-not-allowed
                        hover:bg-[#2ea043]"
                    >
                      Upgrade
                    </button>
                  );
                }

                const moneyOk  = city.money  >= cost.money;
                const energyOk = city.energy >= cost.energy;
                const ammoOk   = city.ammo   >= cost.ammo;

                return (
                  <tr key={name} className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors">
                    <td className="py-2 pl-2">
                      <img
                        src={`/images/buildings/${name.toLowerCase()}.jpg`}
                        alt={BUILDING_DISPLAY[name]}
                        className="w-8 h-8 object-contain rounded"
                      />
                    </td>
                    <td className="py-2">
                      <div className="text-[#c9d1d9]">{BUILDING_DISPLAY[name]}</div>
                    </td>
                    <td className="py-2 text-center text-[#8b949e]">{level}</td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#484f58]" : moneyOk ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.money)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#484f58]" : energyOk ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.energy)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#484f58]" : ammoOk ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.ammo)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#484f58]" : "text-[#8b949e]"}`}>
                      {isMaxLevel ? "—" : fmtDuration(timeSec)}
                    </td>
                    <td className="py-2 pr-2 text-center">{actionNode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Governor */}
          {(() => {
            const cfg        = UNITS["GOVERNOR"];
            const hqLevel    = city.buildings.find(b => b.name === "HEADQUARTERS")?.level ?? 0;
            const unlocked   = hqLevel >= (cfg.requiresHQ ?? 0);
            const timeSec    = getRecruitmentTime("GOVERNOR", 0);
            const moneyOk    = city.money  >= cfg.costMoney  * govQty;
            const energyOk   = city.energy >= cfg.costEnergy * govQty;
            const ammoOk     = city.ammo   >= cfg.costAmmo   * govQty;
            const canAfford  = moneyOk && energyOk && ammoOk;

            return (
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-2">Governor</div>
                <div className="flex items-center gap-4 p-3 bg-[#0d1117] border border-[#21262d] rounded">
                  <img
                    src="/images/units/governor.jpg"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    alt="Governor"
                    className="w-12 h-12 object-contain rounded cursor-pointer hover:brightness-125 transition-[filter] shrink-0"
                    onClick={() => openUnit("GOVERNOR")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#c9d1d9]">Governor</div>
                    <div className="text-[10px] text-[#484f58]">Conquer cities · HQ lvl 30 required</div>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className={moneyOk  ? "text-[#8b949e]" : "text-[#f85149]"}>{cfg.costMoney.toLocaleString()} M</span>
                      <span className={energyOk ? "text-[#8b949e]" : "text-[#f85149]"}>{cfg.costEnergy.toLocaleString()} E</span>
                      <span className={ammoOk   ? "text-[#8b949e]" : "text-[#f85149]"}>{cfg.costAmmo.toLocaleString()} A</span>
                      <span className="text-[#484f58]">{fmtDuration(timeSec)}</span>
                    </div>
                  </div>
                  {unlocked ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={govQty}
                        onChange={(e) => setGovQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 bg-[#161b22] border border-[#30363d] rounded text-xs text-[#c9d1d9] px-1.5 py-1 text-center focus:outline-none focus:border-[#58a6ff]"
                      />
                      <button
                        onClick={() => recruitMutation.mutate({ quantity: govQty })}
                        disabled={!canAfford || recruitMutation.isPending}
                        className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2ea043]"
                      >
                        Recruit
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#f85149] text-xs shrink-0">HQ lvl 30 req.</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Construction Queue */}
          {city.buildingUpgradeOrders.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-2">Construction Queue</div>
              <div className="flex flex-col gap-1.5">
                {city.buildingUpgradeOrders.map((order, i) => {
                  const totalSec = Math.round((new Date(order.finishAt).getTime() - new Date(order.startAt).getTime()) / 1000);
                  const diff     = new Date(order.finishAt).getTime() - Date.now();
                  const s        = Math.max(0, Math.floor(diff / 1000));
                  const countdown = s === 0 ? "finishing..." : fmtDuration(s);

                  return (
                    <div key={order.id} className="flex items-center gap-3 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded">
                      <span className="text-[#484f58] text-xs w-4 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-sm text-[#c9d1d9]">
                        {BUILDING_DISPLAY[order.buildingName]}
                      </span>
                      <span className="text-xs text-[#8b949e] shrink-0">{fmtDuration(totalSec)}</span>
                      <span className="text-xs text-[#d29922] font-mono w-20 text-right shrink-0">
                        {countdown}
                      </span>
                      <button
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        className="text-[10px] text-[#484f58] hover:text-[#f85149] cursor-pointer disabled:opacity-40 shrink-0"
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
      </div>
    </div>
  );
}
