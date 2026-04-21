import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getSharedReport } from "../api/report.ts";
import { BUILDING_DISPLAY, BUILDING_ORDER, UNIT_DISPLAY, UNIT_ORDER } from "../lib/labels.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";
import { usePlayerProfile } from "../context/PlayerProfileContext.tsx";
import type { BattleReportData, SpyReportData, UnitName, BattleUnitCount } from "../types/index.ts";
import { useEffect, useState } from "react";

const REPORT_TAG = /\[report:([a-f0-9-]+)\]/gi;
const ALL_UNITS: UnitName[] = [...UNIT_ORDER.filter(n => n !== "HACKER"), "GOVERNOR"] as UnitName[];

interface Props {
  content: string;
  onExpandChange?: (expanded: boolean) => void;
}

export default function MessageContent({ content, onExpandChange }: Props) {
  const parts: (string | { shareId: string })[] = [];
  let last = 0;

  for (const match of content.matchAll(REPORT_TAG)) {
    if (match.index! > last) parts.push(content.slice(last, match.index!));
    parts.push({ shareId: match[1] });
    last = match.index! + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));

  if (parts.length === 1 && typeof parts[0] === "string") {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i} className="whitespace-pre-wrap break-words">{p}</span>
        ) : (
          <SharedReportCard key={i} shareId={p.shareId} onExpandChange={onExpandChange} />
        )
      )}
    </div>
  );
}

function SharedReportCard({ shareId, onExpandChange }: { shareId: string; onExpandChange?: (expanded: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded, onExpandChange]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-report", shareId],
    queryFn: () => getSharedReport(shareId),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="rounded border border-[#30363d] bg-[#161b22] p-2 text-[11px] text-[#7d8590]">
        Loading report...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-[#30363d] bg-[#161b22] p-2 text-[11px] text-[#7d8590]">
        Report unavailable
      </div>
    );
  }

  const r = data;
  const report = r.report as Record<string, unknown> | null;

  const headerColor = r.type === "ATTACK"
    ? ((report as any)?.attackerWon ? "#3fb950" : "#f85149")
    : r.type === "SPY"
      ? ((report as any)?.success ? "#a371f7" : "#f85149")
      : r.type === "RESOURCES"
        ? "#e3b341"
        : "#58a6ff";

  const headerLabel = r.type === "ATTACK"
    ? ((report as any)?.attackerWon ? "Victory" : "Loss")
    : r.type === "SPY"
      ? ((report as any)?.success ? "Spy success" : "Spy failed")
      : r.type === "RESOURCES"
        ? "Resources"
        : "Support";

  return (
    <div className="rounded border border-[#30363d] bg-[#0d1117] text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#161b22] hover:bg-[#1c2129] cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: headerColor }}>{headerLabel}</span>
          <span className="text-[#7d8590]">
            {r.fromCity.name} → {r.toCity.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7d8590]">
            shared by {r.sharedBy.username}
          </span>
          <span className="text-[#7d8590]">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 flex flex-col gap-2">
          <SharedReportBody report={r} />
        </div>
      )}
    </div>
  );
}

function SharedReportBody({ report: r }: { report: any }) {
  const { openPlayer } = usePlayerProfile();
  const navigate = useNavigate();

  function goToCity(cityId: string) {
    navigate(`/map?selectCityId=${encodeURIComponent(cityId)}`);
  }

  const fromOwner = r.fromCity.owner;
  const toOwner = r.toCity.owner;

  return (
    <>
      <div className="text-[11px] text-[#b1bac4]">
        <button type="button" onClick={() => goToCity(r.fromCity.id)} className="text-[#e6b800] hover:underline">
          {r.fromCity.name}
        </button>
        <span className="text-[#7d8590] font-mono"> ({r.fromCity.x}, {r.fromCity.y})</span>
        {" "}
        <span className="text-[#7d8590]">
          [{fromOwner ? (
            <button type="button" onClick={() => openPlayer(fromOwner.id)} className="text-[#79c0ff] hover:underline">{fromOwner.username}</button>
          ) : "Ghost city"}]
        </span>
        {" → "}
        <button type="button" onClick={() => goToCity(r.toCity.id)} className="text-[#e6b800] hover:underline">
          {r.toCity.name}
        </button>
        <span className="text-[#7d8590] font-mono"> ({r.toCity.x}, {r.toCity.y})</span>
        {" "}
        <span className="text-[#7d8590]">
          [{toOwner ? (
            <button type="button" onClick={() => openPlayer(toOwner.id)} className="text-[#79c0ff] hover:underline">{toOwner.username}</button>
          ) : "Ghost city"}]
        </span>
      </div>

      {r.type === "ATTACK" && r.report && <SharedAttackDetail report={r.report} />}
      {r.type === "SPY" && r.report && <SharedSpyDetail report={r.report} />}
      {r.type === "RESOURCES" && <SharedResourcesDetail money={r.resourceMoney} energy={r.resourceEnergy} ammo={r.resourceAmmo} />}
      {r.type === "SUPPORT" && <SharedSupportDetail units={r.units} />}
    </>
  );
}

function asMap(units: BattleUnitCount[] | undefined): Map<UnitName, number> {
  const m = new Map<UnitName, number>();
  for (const u of units ?? []) m.set(u.name, u.quantity);
  return m;
}

function SharedAttackDetail({ report: data }: { report: BattleReportData }) {
  const { openUnit } = useUnitInfo();
  const atkInit = asMap(data.attackerInitial);
  const atkSurv = asMap(data.attackerSurvivors);
  const atkLosses = asMap(data.attackerLosses);
  const defInit = asMap(data.defenderInitial);
  const defSurv = asMap(data.defenderSurvivors);
  const defLosses = asMap(data.defenderLosses);

  const showAttacker = data.attackerSurvivors != null || data.attackerLosses != null;
  const showDefender = data.defenderInitial != null || data.defenderSurvivors != null || data.defenderLosses != null;
  const showAtkInitial = data.attackerInitial != null;
  const showDefInitial = data.defenderInitial != null;
  const atkLossesOnly = data.attackerLosses != null;
  const defLossesOnly = data.defenderLosses != null;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="w-20"></th>
              {ALL_UNITS.map(name => (
                <th key={name} className="px-1 pb-1 text-center">
                  <img
                    src={`/images/units/${name.toLowerCase()}.jpg`}
                    alt={UNIT_DISPLAY[name]}
                    title={UNIT_DISPLAY[name]}
                    className="w-8 h-8 object-contain rounded mx-auto cursor-pointer hover:brightness-125 transition-[filter]"
                    onClick={() => openUnit(name)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showAttacker && showAtkInitial && (
              <SharedBattleRow label="Attacker" labelColor="#f85149" sublabel="Units" units={ALL_UNITS} values={atkInit} />
            )}
            {showAttacker && !atkLossesOnly && (
              <SharedBattleRow
                label={showAtkInitial ? "" : "Attacker"} labelColor="#f85149" sublabel="Losses" units={ALL_UNITS}
                values={atkSurv} initial={showAtkInitial ? atkInit : undefined} kind="losses" borderBottom
              />
            )}
            {showAttacker && atkLossesOnly && (
              <SharedBattleRow label="Attacker" labelColor="#f85149" sublabel="Losses" units={ALL_UNITS} values={atkLosses} kind="direct-losses" borderBottom />
            )}
            {!showAttacker && (
              <tr>
                <td colSpan={ALL_UNITS.length + 1} className="py-2 text-center text-[#7d8590] italic">Attacker troops hidden</td>
              </tr>
            )}
            {showDefender && showDefInitial && (
              <SharedBattleRow label="Defender" labelColor="#3fb950" sublabel="Units" units={ALL_UNITS} values={defInit} />
            )}
            {showDefender && !defLossesOnly && (
              <SharedBattleRow
                label={showDefInitial ? "" : "Defender"} labelColor="#3fb950" sublabel="Losses" units={ALL_UNITS}
                values={defSurv} initial={showDefInitial ? defInit : undefined} kind="losses"
              />
            )}
            {showDefender && defLossesOnly && (
              <SharedBattleRow label="Defender" labelColor="#3fb950" sublabel="Losses" units={ALL_UNITS} values={defLosses} kind="direct-losses" />
            )}
            {!showDefender && (
              <tr>
                <td colSpan={ALL_UNITS.length + 1} className="py-2 text-center text-[#7d8590] italic">Defender troops hidden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.airDefenseInitialLevel != null && (
        <div className="flex items-center gap-3 text-xs text-[#b1bac4]">
          <img src="/images/buildings/air_defense.jpg" alt="Air defense" className="w-8 h-8 object-contain rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <span>Air defense: {data.airDefenseInitialLevel}</span>
          {(data.airDefenseLevelsDestroyed ?? 0) > 0 && (
            <span className="text-[#f85149]">(-{data.airDefenseLevelsDestroyed})</span>
          )}
        </div>
      )}

      {(data.stolenMoney + data.stolenEnergy + data.stolenAmmo > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <SharedLoot label="Money" color="#7ee787" value={data.stolenMoney} />
          <SharedLoot label="Energy" color="#79c0ff" value={data.stolenEnergy} />
          <SharedLoot label="Ammo" color="#e3b341" value={data.stolenAmmo} />
        </div>
      )}

      {data.loyaltyDamage > 0 && (
        <div className="text-xs text-[#d29922]">Loyalty damage: -{data.loyaltyDamage}</div>
      )}

      {data.conquered && (
        <div className="text-xs text-[#7ee787] font-semibold">City conquered</div>
      )}
    </>
  );
}

function SharedBattleRow({ label, labelColor, sublabel, units, values, initial, kind, borderBottom }: {
  label: string; labelColor: string; sublabel: string; units: UnitName[];
  values: Map<UnitName, number>; initial?: Map<UnitName, number>;
  kind?: "units" | "losses" | "direct-losses"; borderBottom?: boolean;
}) {
  return (
    <tr className={borderBottom ? "border-b border-[#30363d]" : ""}>
      <td className="py-1 pr-2 text-right whitespace-nowrap">
        {label && <span className="font-semibold text-xs" style={{ color: labelColor }}>{label}</span>}
        <span className="text-[10px] text-[#7d8590] ml-1">{sublabel}:</span>
      </td>
      {units.map(name => {
        const v = values.get(name) ?? 0;
        if (kind === "direct-losses") {
          return <td key={name} className={`py-1 text-center font-semibold ${v > 0 ? "text-[#f85149]" : "text-[#7d8590]"}`}>{v > 0 ? `-${v.toLocaleString()}` : "0"}</td>;
        }
        if (kind === "losses" && initial) {
          const sent = initial.get(name) ?? 0;
          if (sent === 0) return <td key={name} className="py-1 text-center font-semibold text-[#7d8590]">0</td>;
          const lost = sent - v;
          return <td key={name} className={`py-1 text-center font-semibold ${lost > 0 ? "text-[#f85149]" : "text-[#7d8590]"}`}>{lost > 0 ? `-${lost.toLocaleString()}` : "0"}</td>;
        }
        if (kind === "losses" && !initial) {
          return <td key={name} className={`py-1 text-center font-semibold ${v > 0 ? "text-[#f85149]" : "text-[#7d8590]"}`}>{v > 0 ? `-${v.toLocaleString()}` : "0"}</td>;
        }
        return <td key={name} className={`py-1 text-center ${v > 0 ? "text-[#c9d1d9]" : "text-[#7d8590]"}`}>{v.toLocaleString()}</td>;
      })}
    </tr>
  );
}

function SharedSpyDetail({ report: data }: { report: SpyReportData }) {
  const { openUnit } = useUnitInfo();
  const showAttacker = data.attackerHackers != null;
  const showSnapshot = data.snapshot != null;

  return (
    <>
      <div className="flex items-center justify-around gap-4">
        {showAttacker && (
          <div className="flex flex-col items-center gap-1 text-xs">
            <span className="text-[9px] uppercase tracking-widest text-[#f85149]">Attacker</span>
            <img src="/images/units/hacker.jpg" alt="Hacker" className="w-10 h-10 object-contain rounded cursor-pointer hover:brightness-125" onClick={() => openUnit("HACKER")} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span className="text-[#c9d1d9] font-mono">{data.attackerHackers}</span>
            <span className="text-[#f85149] font-mono text-[11px]">-{data.attackerHackers - data.attackerSurvivors}</span>
          </div>
        )}
        {data.defenderHackers != null && (
          <div className="flex flex-col items-center gap-1 text-xs">
            <span className="text-[9px] uppercase tracking-widest text-[#58a6ff]">Defender</span>
            <img src="/images/units/hacker.jpg" alt="Hacker" className="w-10 h-10 object-contain rounded cursor-pointer hover:brightness-125" onClick={() => openUnit("HACKER")} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span className="text-[#c9d1d9] font-mono">{data.defenderHackers}</span>
          </div>
        )}
      </div>

      {showSnapshot && data.snapshot && (
        <>
          {data.snapshot.resources && (
            <div className="grid grid-cols-3 gap-2">
              <SharedLoot label="Money" color="#7ee787" value={data.snapshot.resources.money} />
              <SharedLoot label="Energy" color="#79c0ff" value={data.snapshot.resources.energy} />
              <SharedLoot label="Ammo" color="#e3b341" value={data.snapshot.resources.ammo} />
            </div>
          )}

          {data.snapshot.loyalty !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#7d8590]">Loyalty</span>
              <div className="flex-1 h-2 bg-[#21262d] rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${data.snapshot.loyalty}%`,
                    background: data.snapshot.loyalty > 50 ? "#3fb950" : data.snapshot.loyalty > 25 ? "#e3b341" : "#f85149",
                  }}
                />
              </div>
              <span className="text-[#c9d1d9] font-mono text-[11px] font-semibold">{data.snapshot.loyalty}%</span>
            </div>
          )}

          <div className="text-[10px] uppercase tracking-widest text-[#7d8590]">Buildings</div>
          <div className="grid grid-cols-3 gap-1">
            {BUILDING_ORDER.map(name => {
              const b = data.snapshot!.buildings.find(x => x.name === name);
              const lvl = b?.level ?? 0;
              return (
                <div key={name} className="flex items-center gap-1.5 bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5">
                  <img src={`/images/buildings/${name.toLowerCase()}.jpg`} alt={BUILDING_DISPLAY[name]} className="w-6 h-6 object-contain rounded shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-[#c9d1d9] truncate flex-1 text-[11px]">{BUILDING_DISPLAY[name]}</span>
                  <span className={`font-mono text-[11px] ${lvl > 0 ? "text-[#e6b800]" : "text-[#7d8590]"}`}>{lvl > 0 ? lvl : "—"}</span>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] uppercase tracking-widest text-[#7d8590]">Units</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  {ALL_UNITS.map(name => (
                    <th key={name} className="px-0.5 pb-1 text-center">
                      <img src={`/images/units/${name.toLowerCase()}.jpg`} alt={UNIT_DISPLAY[name]} title={UNIT_DISPLAY[name]} className="w-8 h-8 object-contain rounded mx-auto cursor-pointer hover:brightness-125" onClick={() => openUnit(name)} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-1 text-right"><span className="text-[10px] text-[#7d8590]">Units:</span></td>
                  {ALL_UNITS.map(name => {
                    const u = data.snapshot!.units.find(x => x.name === name);
                    const q = u?.quantity ?? 0;
                    return <td key={name} className={`py-1 text-center ${q > 0 ? "text-[#c9d1d9]" : "text-[#7d8590]"}`}>{q.toLocaleString()}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function SharedResourcesDetail({ money, energy, ammo }: { money: number; energy: number; ammo: number }) {
  if (money + energy + ammo === 0) return <div className="text-[#7d8590] text-[11px]">Nothing was sent.</div>;
  return (
    <div className="grid grid-cols-3 gap-2">
      <SharedLoot label="Money" color="#7ee787" value={money} />
      <SharedLoot label="Energy" color="#79c0ff" value={energy} />
      <SharedLoot label="Ammo" color="#e3b341" value={ammo} />
    </div>
  );
}

function SharedSupportDetail({ units }: { units: BattleUnitCount[] }) {
  const { openUnit } = useUnitInfo();
  const present = units.filter(u => u.quantity > 0);
  if (present.length === 0) return <div className="text-[#7d8590] text-[11px]">No units.</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map(u => (
        <div key={u.name} onClick={() => openUnit(u.name)} className="flex items-center gap-1 bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5 cursor-pointer hover:border-[#484f58] text-xs">
          <img src={`/images/units/${u.name.toLowerCase()}.jpg`} alt={UNIT_DISPLAY[u.name]} className="w-5 h-5 object-contain rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <span className="text-[#c9d1d9]">{UNIT_DISPLAY[u.name]}</span>
          <span className="text-[#79c0ff] font-mono">x{u.quantity}</span>
        </div>
      ))}
    </div>
  );
}

function SharedLoot({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-[#161b22] rounded p-1.5 border border-[#21262d]">
      <span className="text-[9px] uppercase tracking-widest" style={{ color }}>{label}</span>
      <span className="text-[#c9d1d9] font-mono text-[11px]">{Math.floor(value).toLocaleString()}</span>
    </div>
  );
}
