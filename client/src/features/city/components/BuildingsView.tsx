import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { upgradeBuilding, cancelBuildingOrder, renameMyCity, cancelRecruitmentOrder } from "@/features/city/api/city";
import { getGovernorState, depositGovernor, recruitGovernor, type GovernorResource } from "@/features/city/api/governor";
import { BUILDINGS, getBuildingUpgradeCost, getBuildingUpgradeTime } from "@shared/gameConfig.ts";
import { getBuildingLevel, fmtDuration } from "@/features/city/lib/cityHelpers";
import { GAME_SPEED } from "@/shared/lib/gameSpeed";
import { BUILDING_DESCRIPTION, BUILDING_DISPLAY, BUILDING_ORDER } from "@/shared/lib/labels";
import type { CityOverview, BuildingName } from "@/shared/types";
import { useUnitInfo } from "@/shared/context/UnitInfoContext";
import { useNow } from "@/shared/context/TickContext";
import ConfirmModal from "@/shared/ui/ConfirmModal";

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
  const renameMutation = useMutation({
    mutationFn: (name: string) => renameMyCity(name, city.id),
    onSuccess: invalidate,
  });

  const governorQuery = useQuery({
    queryKey: ["governor"],
    queryFn:  getGovernorState,
  });
  const depositMutation = useMutation({
    mutationFn: ({ resource, amount }: { resource: GovernorResource; amount: number }) =>
      depositGovernor(city.id, resource, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governor"] });
      invalidate();
    },
  });
  const recruitGovernorMutation = useMutation({
    mutationFn: () => recruitGovernor(city.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governor"] });
      invalidate();
    },
  });
  const cancelGovernorMutation = useMutation({
    mutationFn: (orderId: string) => cancelRecruitmentOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governor"] });
      invalidate();
    },
  });
  const [confirmRecruitGovernor, setConfirmRecruitGovernor] = useState(false);
  const [cancelGovernorOrderId, setCancelGovernorOrderId] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(city.name);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  useEffect(() => { setNameDraft(city.name); }, [city.name]);

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== city.name) {
      renameMutation.mutate(trimmed);
    } else {
      setNameDraft(city.name);
    }
    setEditingName(false);
  }

  const now = useNow();

  const hqLevel = getBuildingLevel(city, "HEADQUARTERS");

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0d1117]">
        {/* Left 40%: HQ image + Governor */}
        <div className="w-2/5 shrink-0 flex flex-col bg-[#0d1117] border-r border-[#30363d] overflow-y-auto">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#e6b800]">Headquarters</h2>
              <button
                onClick={onClose}
                className="text-sm text-[#b1bac4] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#e6b800] hover:text-[#e6b800] cursor-pointer"
              >
                ← Back
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-widest text-[#b1bac4]">City name</span>
              {editingName ? (
                <input
                  autoFocus
                  type="text"
                  value={nameDraft}
                  maxLength={50}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") { setNameDraft(city.name); setEditingName(false); }
                  }}
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded text-sm text-[#c9d1d9] px-2 py-1 focus:outline-none focus:border-[#e6b800]"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="flex-1 text-left text-sm text-[#c9d1d9] border border-transparent hover:border-[#30363d] rounded px-2 py-1 cursor-pointer"
                  title="Click to rename"
                >
                  {city.name} <span className="text-[10px] text-[#7d8590]">✎</span>
                </button>
              )}
            </div>
            <p className="text-xs text-[#b1bac4] mt-2">{BUILDING_DESCRIPTION["HEADQUARTERS"]}</p>
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
            const hqLvl    = city.buildings.find(b => b.name === "HEADQUARTERS")?.level ?? 0;
            const unlocked = hqLvl >= 30;
            const state    = governorQuery.data;

            const resources: { key: GovernorResource; label: string; color: string; cityAmount: number }[] = [
              { key: "money",  label: "M", color: "#7ee787", cityAmount: city.money  },
              { key: "energy", label: "E", color: "#79c0ff", cityAmount: city.energy },
              { key: "ammo",   label: "A", color: "#e3b341", cityAmount: city.ammo   },
            ];

            return (
              <div className="p-4 pt-0 shrink-0">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-[#b1bac4]">Governor</div>
                  {state && (
                    <div className="text-[10px] text-[#7d8590]">
                      Recruited: <span className="text-[#c9d1d9] font-medium">{state.recruited}</span>
                      {" · "}
                      Next: #{state.nextNumber}
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#161b22] border border-[#21262d] rounded">
                  <img
                    src="/images/units/governor.jpg"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    alt="Governor"
                    className="w-14 h-14 object-cover rounded cursor-pointer hover:brightness-125 transition-[filter] shrink-0"
                    onClick={() => openUnit("GOVERNOR")}
                  />
                  <div className="flex-1 min-w-0">
                    {!unlocked && (
                      <div className="text-[#f85149] text-xs">HQ lvl 30 required in this city</div>
                    )}
                    {unlocked && !state && (
                      <div className="text-[10px] text-[#7d8590]">Loading…</div>
                    )}
                    {unlocked && state && (
                      <div className="flex flex-col gap-1.5">
                        {resources.map(({ key, label, color, cityAmount }) => {
                          const current = state.deposits[key];
                          const target  = state.nextCost[key];
                          const pct     = Math.min(100, (current / target) * 100);
                          const remaining = Math.max(0, target - current);
                          const depositable = Math.min(remaining, Math.floor(cityAmount));
                          const full = current >= target;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold w-3 shrink-0" style={{ color }}>{label}</span>
                              <div className="flex-1 min-w-0">
                                <div className="h-3 bg-[#0d1117] border border-[#30363d] rounded overflow-hidden relative">
                                  <div
                                    className="h-full transition-[width]"
                                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-[#c9d1d9] pointer-events-none">
                                    {fmt(Math.floor(current))} / {fmt(target)}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => depositMutation.mutate({ resource: key, amount: depositable })}
                                disabled={full || depositable <= 0 || depositMutation.isPending}
                                title={full ? "Full" : `Deposit ${fmt(depositable)}`}
                                className="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2ea043] shrink-0"
                              >
                                +{fmt(depositable)}
                              </button>
                            </div>
                          );
                        })}

                        {(() => {
                          const pending = state.pendingOrders.find(o => o.cityId === city.id) ?? null;
                          if (pending) {
                            const diff = new Date(pending.finishAt).getTime() - now;
                            const s    = Math.max(0, Math.floor(diff / 1000));
                            const countdown = s === 0 ? "finishing..." : fmtDuration(s);
                            return (
                              <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded">
                                <span className="text-[10px] text-[#b1bac4] flex-1 truncate">
                                  Recruiting in <span className="text-[#c9d1d9]">{pending.cityName}</span>
                                </span>
                                <span className="text-[10px] text-[#d29922] font-mono">{countdown}</span>
                                <button
                                  onClick={() => setCancelGovernorOrderId(pending.id)}
                                  disabled={cancelGovernorMutation.isPending}
                                  className="text-[10px] text-[#7d8590] hover:text-[#f85149] cursor-pointer disabled:opacity-40"
                                  title="Cancel recruitment"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-1 mt-1">
                              <button
                                onClick={() => setConfirmRecruitGovernor(true)}
                                disabled={!state.barsReady || recruitGovernorMutation.isPending}
                                className="px-2 py-1 rounded text-[10px] font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2ea043]"
                                title={state.barsReady ? `Recruit Governor (${fmtDuration(state.recruitTimeSec)})` : "Fill all bars first"}
                              >
                                Recruit Governor · {fmtDuration(state.recruitTimeSec)}
                              </button>
                              {recruitGovernorMutation.isError && (
                                <div className="text-[10px] text-[#f85149]">
                                  {(recruitGovernorMutation.error as Error)?.message ?? "Error"}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
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
                const timeSec = getBuildingUpgradeTime(name, effectiveLevel, hqLevel, GAME_SPEED);
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
          {city.buildingUpgradeOrders.some((o) => new Date(o.finishAt).getTime() > now) && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Construction Queue</div>
              <div className="flex flex-col gap-1.5">
                {(() => {
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
                  const diff     = new Date(order.finishAt).getTime() - now;
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
                        onClick={() => setCancelOrderId(order.id)}
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
        {confirmRecruitGovernor && (
          <ConfirmModal
            message={`Start recruiting a Governor in ${city.name}? This will consume the deposited resources and take ${fmtDuration(governorQuery.data?.recruitTimeSec ?? 0)}.`}
            confirmLabel="Recruit"
            cancelLabel="Not now"
            variant="primary"
            onConfirm={() => {
              recruitGovernorMutation.mutate();
              setConfirmRecruitGovernor(false);
            }}
            onCancel={() => setConfirmRecruitGovernor(false)}
          />
        )}
        {cancelGovernorOrderId && (
          <ConfirmModal
            message="You will lose 25% of the deposited resources. Are you sure you want to cancel the Governor recruitment?"
            confirmLabel="Cancel recruitment"
            cancelLabel="Keep recruiting"
            onConfirm={() => {
              cancelGovernorMutation.mutate(cancelGovernorOrderId);
              setCancelGovernorOrderId(null);
            }}
            onCancel={() => setCancelGovernorOrderId(null)}
          />
        )}
    </div>
  );
}
