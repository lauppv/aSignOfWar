import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upgradeBuilding, cancelBuildingOrder, recruitUnits } from "../api/city.ts";
import { BUILDINGS, UNITS, getBuildingUpgradeCost, getBuildingUpgradeTime, getRecruitmentTime } from "@shared/gameConfig.ts";
import { getBuildingLevel, fmtDuration } from "../lib/cityHelpers.ts";
import { BUILDING_DISPLAY, BUILDING_SHORT_DESC, BUILDING_ORDER } from "../lib/labels.ts";
import type { CityOverview, BuildingName } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

interface Props {
  city: CityOverview;
  onClose: () => void;
  onBuildingClick: (name: BuildingName) => void;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function BuildingsView({ city, onClose, onBuildingClick }: Props) {
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
    <div className="flex flex-1 overflow-hidden bg-[#0d1117]">
        {/* Left 40%: HQ image + Governor */}
        <div className="w-2/5 shrink-0 flex flex-col bg-[#0d1117] border-r border-[#30363d] overflow-y-auto">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e6b800]">Headquarters</h2>
              <button
                onClick={onClose}
                className="text-sm text-[#b1bac4] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#e6b800] hover:text-[#e6b800] cursor-pointer"
              >
                ← Back
              </button>
            </div>
            <p className="text-xs text-[#b1bac4] mt-1">{BUILDING_SHORT_DESC["HEADQUARTERS"]}</p>
          </div>
          <div className="flex items-center justify-center p-4 flex-1 min-h-0">
            <img
              src="/images/buildings/headquarters.jpg"
              alt="Headquarters"
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>

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
              <div className="p-4 pt-0 shrink-0">
                <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Governor</div>
                <div className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#21262d] rounded">
                  <img
                    src="/images/units/governor.jpg"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    alt="Governor"
                    className="w-14 h-14 object-cover rounded cursor-pointer hover:brightness-125 transition-[filter] shrink-0"
                    onClick={() => openUnit("GOVERNOR")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#c9d1d9]">Governor</div>
                    <div className="text-[10px] text-[#7d8590]">Conquer cities · HQ lvl 30 req.</div>
                    <div className="flex gap-2 mt-1 text-xs flex-wrap">
                      <span className={moneyOk  ? "text-[#7ee787]" : "text-[#f85149]"}>{cfg.costMoney.toLocaleString()} M</span>
                      <span className={energyOk ? "text-[#79c0ff]" : "text-[#f85149]"}>{cfg.costEnergy.toLocaleString()} E</span>
                      <span className={ammoOk   ? "text-[#e3b341]" : "text-[#f85149]"}>{cfg.costAmmo.toLocaleString()} A</span>
                      <span className="text-[#7d8590]">{fmtDuration(timeSec)}</span>
                    </div>
                    {unlocked ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={govQty}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const num = parseInt(raw);
                            setGovQty(raw === "" ? 1 : Math.max(1, num));
                          }}
                          className="w-14 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#c9d1d9] px-1.5 py-1 text-center focus:outline-none focus:border-[#58a6ff]"
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
                      <div className="text-[#f85149] text-xs mt-1">HQ lvl 30 req.</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right 60%: Building list */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-[#b1bac4] border-b border-[#30363d]">
                <th className="text-left py-2 pl-2 font-normal w-18"></th>
                <th className="text-left py-2 font-normal">Building</th>
                <th className="text-center py-2 font-normal">Level</th>
                <th className="text-right py-2 font-normal text-[#7ee787]">Money</th>
                <th className="text-right py-2 font-normal text-[#79c0ff]">Energy</th>
                <th className="text-right py-2 font-normal text-[#e3b341]">Ammo</th>
                <th className="text-right py-2 font-normal">Time</th>
                <th className="text-center py-2 pr-2 font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {BUILDING_ORDER.map((name) => {
                const cfg     = BUILDINGS[name];
                const building = city.buildings.find((b) => b.name === name);
                const level   = building?.level ?? 0;
                const pendingCount = city.buildingUpgradeOrders.filter((o) => o.buildingName === name).length;
                const effectiveLevel = level + pendingCount;
                const cost    = getBuildingUpgradeCost(name, effectiveLevel);
                const timeSec = getBuildingUpgradeTime(name, effectiveLevel, hqLevel);
                const isMaxLevel  = effectiveLevel >= cfg.maxLevel;
                const hqRequired  = cfg.requiresHQ ?? 0;
                const needsHQ     = hqLevel < hqRequired;
                const canAfford   = city.money >= cost.money && city.energy >= cost.energy && city.ammo >= cost.ammo;

                let actionNode: React.ReactNode;
                if (isMaxLevel) {
                  actionNode = <span className="text-[#3fb950] text-xs font-medium">Max</span>;
                } else if (needsHQ) {
                  actionNode = (
                    <span className="text-[#f85149] text-xs">HQ lvl {hqRequired} req.</span>
                  );
                } else {
                  actionNode = (
                    <button
                      onClick={(e) => { e.stopPropagation(); building && upgradeMutation.mutate(building.id); }}
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

                const isClickable = name !== "HEADQUARTERS";

                return (
                  <tr
                    key={name}
                    className={`border-b border-[#21262d] hover:bg-[#161b22] transition-colors ${isClickable ? "cursor-pointer" : ""}`}
                    onClick={isClickable ? () => onBuildingClick(name) : undefined}
                  >
                    <td className="py-2 pl-2">
                      <img
                        src={`/images/buildings/${name.toLowerCase()}.jpg`}
                        alt={BUILDING_DISPLAY[name]}
                        className="w-16 h-16 object-cover rounded"
                      />
                    </td>
                    <td className="py-2 pl-3">
                      <div className="text-[#c9d1d9]">{BUILDING_DISPLAY[name]}</div>
                    </td>
                    <td className="py-2 text-center text-[#b1bac4]">{level}</td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#7d8590]" : moneyOk ? "text-[#7ee787]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.money)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#7d8590]" : energyOk ? "text-[#79c0ff]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.energy)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#7d8590]" : ammoOk ? "text-[#e3b341]" : "text-[#f85149]"}`}>
                      {isMaxLevel ? "—" : fmt(cost.ammo)}
                    </td>
                    <td className={`py-2 text-right text-xs ${isMaxLevel || needsHQ ? "text-[#7d8590]" : "text-[#b1bac4]"}`}>
                      {isMaxLevel ? "—" : fmtDuration(timeSec)}
                    </td>
                    <td className="py-2 pr-2 text-center">{actionNode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Construction Queue */}
          {city.buildingUpgradeOrders.some((o) => new Date(o.finishAt).getTime() > Date.now()) && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Construction Queue</div>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const now = Date.now();
                  const activeOrders = city.buildingUpgradeOrders.filter(
                    (o) => new Date(o.finishAt).getTime() > now
                  );
                  const seenCount: Partial<Record<BuildingName, number>> = {};
                  return activeOrders.map((order, i) => {
                  const baseLevel = city.buildings.find((b) => b.name === order.buildingName)?.level ?? 0;
                  const offset = seenCount[order.buildingName] ?? 0;
                  seenCount[order.buildingName] = offset + 1;
                  const fromLevel = baseLevel + offset;
                  const toLevel = fromLevel + 1;

                  const totalSec = Math.round((new Date(order.finishAt).getTime() - new Date(order.startAt).getTime()) / 1000);
                  const diff     = new Date(order.finishAt).getTime() - Date.now();
                  const s        = Math.max(0, Math.floor(diff / 1000));
                  const countdown = s === 0 ? "finishing..." : fmtDuration(s);

                  return (
                    <div key={order.id} className="flex items-center gap-3 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded">
                      <span className="text-[#7d8590] text-xs w-4 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-sm text-[#c9d1d9]">
                        {BUILDING_DISPLAY[order.buildingName]} <span className="text-[#b1bac4] text-xs">{fromLevel} → {toLevel}</span>
                      </span>
                      <span className="text-xs text-[#b1bac4] shrink-0">{fmtDuration(totalSec)}</span>
                      <span className="text-xs text-[#d29922] font-mono w-20 text-right shrink-0">
                        {countdown}
                      </span>
                      <button
                        onClick={() => {
                          if (window.confirm("You will lose 25% of the resources. Are you sure you want to continue?")) {
                            cancelMutation.mutate(order.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="text-[10px] text-[#7d8590] hover:text-[#f85149] cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
