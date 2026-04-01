import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recruitUnits, cancelRecruitmentOrder } from "../api/city.ts";
import { UNITS, getBuildingLevel, getRecruitmentTime, fmtDuration, computePopulation, getMaxPopulation } from "../lib/gameConfig.ts";
import type { CityOverview, UnitName } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

const UNIT_DISPLAY: Record<UnitName, string> = {
  LIGHT_INFANTRY:     "Light Infantry",
  DEFENDER_INFANTRY:  "Defender Infantry",
  ANTI_TANK_INFANTRY: "Anti-Tank Infantry",
  SNIPER:             "Sniper",
  SPECIAL_FORCES:     "Special Forces",
  RAIDER:             "Raider",
  TANK:               "Tank",
  MISSILE_LAUNCHER:   "Missile Launcher",
  DRONE:              "Drone",
  GOVERNOR:           "Governor",
};

const UNIT_THEME: Record<UnitName, string> = {
  LIGHT_INFANTRY:     "Luptator cu topor",
  DEFENDER_INFANTRY:  "Luptator cu spada",
  ANTI_TANK_INFANTRY: "Lancier",
  SNIPER:             "Arcas",
  SPECIAL_FORCES:     "Arcas calare",
  RAIDER:             "Cavalerie usoara",
  TANK:               "Cavalerie grea",
  MISSILE_LAUNCHER:   "Berbec",
  DRONE:              "Catapulta",
  GOVERNOR:           "Governor",
};

const UNIT_ORDER: UnitName[] = [
  "LIGHT_INFANTRY", "DEFENDER_INFANTRY", "ANTI_TANK_INFANTRY",
  "SNIPER", "SPECIAL_FORCES", "RAIDER", "TANK", "MISSILE_LAUNCHER", "DRONE",
];

interface Props {
  city: CityOverview;
  onClose: () => void;
}

function fmt(n: number) { return n.toLocaleString(); }

export default function MilitaryBaseView({ city, onClose }: Props) {
  const { openUnit } = useUnitInfo();
  const queryClient  = useQueryClient();
  const invalidate   = () => queryClient.invalidateQueries({ queryKey: ["city"] });

  const recruitMutation = useMutation({
    mutationFn: ({ unitName, quantity }: { unitName: UnitName; quantity: number }) =>
      recruitUnits(city.id, unitName, quantity),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({ mutationFn: cancelRecruitmentOrder, onSuccess: invalidate });

  const [quantities, setQuantities] = useState<Partial<Record<UnitName, number>>>({});
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hqLevel = getBuildingLevel(city, "HEADQUARTERS");
  const mbLevel = getBuildingLevel(city, "MILITARY_BASE");
  const population    = computePopulation(city);
  const maxPopulation = getMaxPopulation(getBuildingLevel(city, "HOUSING"));
  const availablePop  = maxPopulation - population;

  function isUnlocked(name: UnitName): boolean {
    if (mbLevel === 0) return false;
    const cfg = UNITS[name];
    if (cfg.requiresHQ && hqLevel < cfg.requiresHQ) return false;
    if (cfg.requiresMilitaryBase && mbLevel < cfg.requiresMilitaryBase) return false;
    return true;
  }

  function lockedReason(name: UnitName): string {
    const cfg = UNITS[name];
    const parts: string[] = [];
    const mbRequired = cfg.requiresMilitaryBase ?? (mbLevel === 0 ? 1 : 0);
    if (mbRequired > mbLevel) parts.push(`Military Base lvl ${mbRequired}`);
    if (cfg.requiresHQ && hqLevel < cfg.requiresHQ) parts.push(`Headquarters lvl ${cfg.requiresHQ}`);
    return `Requires ${parts.join(" + ")}`;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#e6b800]">Military Base</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Enables unit recruitment and reduces training time at higher levels.
            Current level: <span className="text-[#c9d1d9]">{mbLevel}</span>
            {" · "}Available population: <span className="text-[#c9d1d9]">{fmt(availablePop)}</span>
          </p>
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
            src="/images/buildings/military_base.jpg"
            alt="Military Base"
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Right 60%: unit list + queue */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-[#8b949e] border-b border-[#30363d]">
                <th className="text-left py-2 pl-2 font-normal w-8"></th>
                <th className="text-left py-2 font-normal">Unit</th>
                <th className="text-right py-2 font-normal">Money</th>
                <th className="text-right py-2 font-normal">Energy</th>
                <th className="text-right py-2 font-normal">Ammo</th>
                <th className="text-right py-2 font-normal">Pop</th>
                <th className="text-right py-2 font-normal">Time</th>
                <th className="text-center py-2 pr-2 font-normal">Recruit</th>
              </tr>
            </thead>
            <tbody>
              {UNIT_ORDER.map((name) => {
                const cfg      = UNITS[name];
                const unlocked = isUnlocked(name);
                const timeSec  = getRecruitmentTime(name, mbLevel);
                const qty      = quantities[name] ?? 1;

                const moneyOk   = city.money  >= cfg.costMoney  * qty;
                const energyOk  = city.energy >= cfg.costEnergy * qty;
                const ammoOk    = city.ammo   >= cfg.costAmmo   * qty;
                const popOk     = availablePop >= cfg.population * qty;
                const canAfford = moneyOk && energyOk && ammoOk && popOk;

                return (
                  <tr key={name} className={`border-b border-[#21262d] hover:bg-[#161b22] transition-colors ${!unlocked ? "opacity-40" : ""}`}>
                    <td className="py-2 pl-2">
                      <img
                        src={`/images/units/${name.toLowerCase()}.jpg`}
                        alt={UNIT_DISPLAY[name]}
                        className="w-8 h-8 object-contain rounded cursor-pointer hover:brightness-125 transition-[filter]"
                        onClick={() => openUnit(name)}
                      />
                    </td>
                    <td className="py-2">
                      <div className="text-[#c9d1d9] text-xs">{UNIT_DISPLAY[name]}</div>
                      <div className="text-[10px] text-[#484f58]">{UNIT_THEME[name]}</div>
                      {!unlocked && (
                        <div className="text-[10px] text-[#f85149] mt-0.5">{lockedReason(name)}</div>
                      )}
                    </td>
                    <td className={`py-2 text-right text-xs ${!unlocked ? "text-[#484f58]" : moneyOk  ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cfg.costMoney)}</td>
                    <td className={`py-2 text-right text-xs ${!unlocked ? "text-[#484f58]" : energyOk ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cfg.costEnergy)}</td>
                    <td className={`py-2 text-right text-xs ${!unlocked ? "text-[#484f58]" : ammoOk   ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{fmt(cfg.costAmmo)}</td>
                    <td className={`py-2 text-right text-xs ${!unlocked ? "text-[#484f58]" : popOk    ? "text-[#c9d1d9]" : "text-[#f85149]"}`}>{cfg.population}</td>
                    <td className={`py-2 text-right text-xs ${!unlocked ? "text-[#484f58]" : "text-[#8b949e]"}`}>{fmtDuration(timeSec)}</td>
                    <td className="py-2 pr-2 text-center">
                      {unlocked ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => setQuantities((prev) => ({
                              ...prev,
                              [name]: Math.max(1, parseInt(e.target.value) || 1),
                            }))}
                            className="w-14 bg-[#0d1117] border border-[#30363d] rounded text-xs text-[#c9d1d9] px-1.5 py-1 text-center focus:outline-none focus:border-[#58a6ff]"
                          />
                          <button
                            onClick={() => recruitMutation.mutate({ unitName: name, quantity: qty })}
                            disabled={!canAfford || recruitMutation.isPending}
                            className="px-2 py-1 rounded text-xs font-medium cursor-pointer bg-[#238636] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2ea043]"
                          >
                            Recruit
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#484f58] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Recruitment Queue */}
          {city.recruitmentOrders.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-2">Recruitment Queue</div>
              <div className="flex flex-col gap-1.5">
                {city.recruitmentOrders.map((order, i) => {
                  const totalSec  = Math.round((new Date(order.finishAt).getTime() - new Date(order.startAt).getTime()) / 1000);
                  const diff      = new Date(order.finishAt).getTime() - Date.now();
                  const s         = Math.max(0, Math.floor(diff / 1000));
                  const countdown = s === 0 ? "finishing..." : fmtDuration(s);

                  return (
                    <div key={order.id} className="flex items-center gap-3 px-3 py-2 bg-[#161b22] border border-[#30363d] rounded">
                      <span className="text-[#484f58] text-xs w-4 shrink-0">{i + 1}.</span>
                      <img
                        src={`/images/units/${order.unitName.toLowerCase()}.jpg`}
                        className="w-6 h-6 object-contain rounded shrink-0"
                      />
                      <span className="flex-1 text-sm text-[#c9d1d9]">
                        {UNIT_DISPLAY[order.unitName]} <span className="text-[#8b949e]">×{order.quantity}</span>
                      </span>
                      <span className="text-xs text-[#8b949e] shrink-0">{fmtDuration(totalSec)}</span>
                      <span className="text-xs text-[#d29922] font-mono w-20 text-right shrink-0">{countdown}</span>
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
