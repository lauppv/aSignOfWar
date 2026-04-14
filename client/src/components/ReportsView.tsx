import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getReports } from "../api/report.ts";
import type { BattleReport, BattleUnitCount, UnitName } from "../types/index.ts";
import { UNIT_DISPLAY, UNIT_ORDER } from "../lib/labels.ts";

const ALL_UNITS: UnitName[] = [...UNIT_ORDER, "GOVERNOR"] as UnitName[];

interface Props {
  onClose: () => void;
}

function fmtTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)        return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)        return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function asMap(units: BattleUnitCount[] | undefined): Map<UnitName, number> {
  const m = new Map<UnitName, number>();
  for (const u of units ?? []) m.set(u.name, u.quantity);
  return m;
}

export default function ReportsView({ onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-[#8b949e]">
        Loading reports...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 text-[#f85149]">
        Failed to load reports
      </div>
    );
  }

  const list = (reports ?? []).filter(r => r && r.report);
  const selected = list.find(r => r.id === selectedId) ?? list[0] ?? null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm uppercase tracking-widest text-[#8b949e]">Battle reports</span>
        <button
          onClick={onClose}
          className="text-xs text-[#8b949e] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="w-[300px] border-r border-[#30363d] overflow-y-auto">
          {list.length === 0 ? (
            <div className="text-[11px] text-[#484f58] text-center mt-6 px-3">
              No battle reports yet. Send an attack from the map and come back here when it lands.
            </div>
          ) : (
            list.map(r => <ReportRow key={r.id} report={r} active={selected?.id === r.id} onClick={() => setSelectedId(r.id)} />)
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selected ? <ReportDetail report={selected} /> : (
            <div className="text-[#484f58] text-xs text-center mt-6">Pick a report from the list</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportRow({ report: r, active, onClick }: { report: BattleReport; active: boolean; onClick: () => void }) {
  const isOut = r.direction === "outgoing";
  const won   = r.report.attackerWon;
  // Outcome from THIS user's perspective
  const userWon = isOut ? won : !won;
  const otherCity = isOut ? r.toCity : r.fromCity;
  const otherOwner = otherCity.owner?.username ?? "barbarians";

  return (
    <div
      onClick={onClick}
      className="px-3 py-2 border-b border-[#21262d] cursor-pointer text-xs flex flex-col gap-0.5"
      style={{
        background: active ? "#1c2129" : undefined,
        borderLeft: `3px solid ${userWon ? "#3fb950" : "#f85149"}`,
      }}
    >
      <div className="flex justify-between items-center">
        <span
          className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{
            background: userWon ? "#1a3d1a" : "#3d1a1a",
            color:      userWon ? "#3fb950" : "#f85149",
          }}
        >
          {userWon ? "victory" : "defeat"}
        </span>
        <span className="text-[9px] text-[#484f58] uppercase tracking-widest">
          {isOut ? "▶ out" : "◀ in"}
        </span>
      </div>
      <div className="text-[#c9d1d9] truncate">
        {isOut ? "→ " : "← "}{otherCity.name}
      </div>
      <div className="text-[10px] text-[#484f58] flex justify-between">
        <span className="truncate">{otherOwner} · [{otherCity.x},{otherCity.y}]</span>
        <span className="shrink-0 ml-2">{fmtTimeAgo(r.arrivalAt)}</span>
      </div>
    </div>
  );
}

function ReportDetail({ report: r }: { report: BattleReport }) {
  const isOut    = r.direction === "outgoing";
  const won      = r.report.attackerWon;
  const userWon  = isOut ? won : !won;
  const data     = r.report;

  const atkInit = asMap(data.attackerInitial);
  const atkSurv = asMap(data.attackerSurvivors);
  const defInit = asMap(data.defenderInitial);
  const defSurv = asMap(data.defenderSurvivors);

  // Doar coloanele in care a participat cineva (atacator sau aparator).
  const visibleUnits = ALL_UNITS.filter(n => (atkInit.get(n) ?? 0) > 0 || (defInit.get(n) ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {/* Header */}
      <div
        className="rounded p-3 flex items-center justify-between border"
        style={{
          background:  userWon ? "#0e1f0e" : "#1f0e0e",
          borderColor: userWon ? "#1a3d1a" : "#3d1a1a",
        }}
      >
        <div>
          <div
            className="text-xs uppercase font-bold tracking-widest"
            style={{ color: userWon ? "#3fb950" : "#f85149" }}
          >
            {userWon ? "Victory" : "Defeat"}
          </div>
          <div className="text-[11px] text-[#8b949e] mt-0.5">
            {r.fromCity.name} <span className="text-[#484f58]">({r.fromCity.owner?.username ?? "barbarians"})</span>
            {" → "}
            {r.toCity.name} <span className="text-[#484f58]">({r.toCity.owner?.username ?? "barbarians"})</span>
          </div>
        </div>
        <div className="text-[10px] text-[#484f58] text-right">
          <div>{new Date(data.battleAt ?? r.arrivalAt).toLocaleString()}</div>
          <div className="uppercase tracking-widest mt-0.5">{r.direction}</div>
        </div>
      </div>

      {/* Battle table (Tribal Wars style — same layout as the simulator) */}
      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 overflow-x-auto">
        {visibleUnits.length === 0 ? (
          <div className="text-[#484f58] text-[11px]">No units</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-24"></th>
                {visibleUnits.map(name => (
                  <th key={name} className="px-1 pb-1 text-center">
                    <img
                      src={`/images/units/${name.toLowerCase()}.jpg`}
                      alt={UNIT_DISPLAY[name]}
                      title={UNIT_DISPLAY[name]}
                      className="w-10 h-10 object-contain rounded mx-auto"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <BattleRow label="Attacker" labelColor="#f85149" sublabel="Units"     units={visibleUnits} values={atkInit} />
              <BattleRow label=""         labelColor="#f85149" sublabel="Survivors" units={visibleUnits} values={atkSurv} initial={atkInit} kind="survivors" borderBottom />
              <BattleRow label="Defender" labelColor="#3fb950" sublabel="Units"     units={visibleUnits} values={defInit} />
              <BattleRow label=""         labelColor="#3fb950" sublabel="Survivors" units={visibleUnits} values={defSurv} initial={defInit} kind="survivors" />
            </tbody>
          </table>
        )}
      </div>

      {/* Air defense */}
      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
        <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-1.5">Air defense</div>
        <div className="flex justify-between text-[#c9d1d9]">
          <span>Level before</span>
          <span className="font-mono">{data.airDefenseInitialLevel ?? "—"}</span>
        </div>
        <div className="flex justify-between text-[#c9d1d9]">
          <span>Level after</span>
          <span className="font-mono">{data.newAirDefenseLevel ?? "—"}</span>
        </div>
        {(data.airDefenseLevelsDestroyed ?? 0) > 0 && (
          <div className="flex justify-between text-[#f85149] mt-0.5">
            <span>Levels destroyed</span>
            <span className="font-mono">−{data.airDefenseLevelsDestroyed}</span>
          </div>
        )}
      </div>

      {/* Loot */}
      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
        <div className="text-[10px] uppercase tracking-widest text-[#8b949e] mb-1.5">Loot</div>
        {data.stolenMoney + data.stolenEnergy + data.stolenAmmo === 0 ? (
          <div className="text-[#484f58] text-[11px]">Nothing was taken.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <LootCell label="Money"  color="#7ee787" value={data.stolenMoney}  />
            <LootCell label="Energy" color="#79c0ff" value={data.stolenEnergy} />
            <LootCell label="Ammo"   color="#e3b341" value={data.stolenAmmo}   />
          </div>
        )}
      </div>

      {/* Loyalty */}
      {data.loyaltyDamage > 0 && (
        <div className="rounded border border-[#d29922] bg-[#3d2e0a] p-3 text-xs flex justify-between text-[#d29922]">
          <span className="uppercase tracking-widest">Loyalty damage</span>
          <span className="font-mono">−{data.loyaltyDamage}</span>
        </div>
      )}
    </div>
  );
}

function BattleRow({ label, labelColor, sublabel, units, values, initial, kind, borderBottom }: {
  label: string;
  labelColor: string;
  sublabel: string;
  units: UnitName[];
  values: Map<UnitName, number>;
  initial?: Map<UnitName, number>;
  kind?: "units" | "survivors";
  borderBottom?: boolean;
}) {
  return (
    <tr className={borderBottom ? "border-b border-[#30363d]" : ""}>
      <td className="py-1 pr-2 text-right whitespace-nowrap">
        {label && <span className="font-semibold text-xs" style={{ color: labelColor }}>{label}</span>}
        <span className="text-[10px] text-[#484f58] ml-1">{sublabel}:</span>
      </td>
      {units.map(name => {
        const v = values.get(name) ?? 0;
        if (kind === "survivors") {
          const sent = initial?.get(name) ?? 0;
          if (sent === 0) {
            return <td key={name} className="py-1 text-center font-semibold text-[#484f58]">0</td>;
          }
          const allDead = v === 0;
          return (
            <td key={name} className={`py-1 text-center font-semibold ${allDead ? "text-[#f85149]" : "text-[#3fb950]"}`}>
              {v.toLocaleString()}
            </td>
          );
        }
        return (
          <td key={name} className={`py-1 text-center ${v > 0 ? "text-[#c9d1d9]" : "text-[#484f58]"}`}>
            {v.toLocaleString()}
          </td>
        );
      })}
    </tr>
  );
}

function LootCell({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-[#0d1117] rounded p-2 border border-[#21262d]">
      <span className="text-[9px] uppercase tracking-widest" style={{ color }}>{label}</span>
      <span className="text-[#c9d1d9] font-mono">{Math.floor(value).toLocaleString()}</span>
    </div>
  );
}
