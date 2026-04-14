import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getReports, deleteReport } from "../api/report.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";
import type { BattleReport, BattleUnitCount, CommandReportType, UnitName } from "../types/index.ts";
import { UNIT_DISPLAY, UNIT_ORDER } from "../lib/labels.ts";

const ALL_UNITS: UnitName[] = [...UNIT_ORDER, "GOVERNOR"] as UnitName[];

const SKIP_CONFIRM_KEY = "skipReportDeleteConfirm";

interface Props {
  onClose: () => void;
}

// ─── Category helpers ────────────────────────────────────────────────────────

type Category = "victory" | "loss" | "resources" | "support";

function categoryOf(r: BattleReport): Category {
  if (r.type === "RESOURCES") return "resources";
  if (r.type === "SUPPORT")   return "support";
  // ATTACK — perspective-aware
  const attackerWon = r.report?.attackerWon ?? false;
  const isOut = r.direction === "outgoing";
  const userWon = isOut ? attackerWon : !attackerWon;
  return userWon ? "victory" : "loss";
}

const CATEGORY_META: Record<Category, { label: string; fg: string; bg: string; border: string }> = {
  victory:   { label: "Victory",   fg: "#3fb950", bg: "#1a3d1a", border: "#3fb950" },
  loss:      { label: "Loss",      fg: "#f85149", bg: "#3d1a1a", border: "#f85149" },
  resources: { label: "Resources", fg: "#e3b341", bg: "#3d2e0a", border: "#e3b341" },
  support:   { label: "Support",   fg: "#79c0ff", bg: "#0e1f3d", border: "#79c0ff" },
};

const VERB_BY_TYPE: Record<CommandReportType, string> = {
  ATTACK:    "attacks",
  SUPPORT:   "supports",
  RESOURCES: "sends resources to",
};

function fmtTimeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h >= 24) {
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  const s = Math.floor(diff / 1000);
  if (s < 60)        return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)        return `${m}m ago`;
  return `${h}h ago`;
}

function asMap(units: BattleUnitCount[] | undefined): Map<UnitName, number> {
  const m = new Map<UnitName, number>();
  for (const u of units ?? []) m.set(u.name, u.quantity);
  return m;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ReportsView({ onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    refetchInterval: 10000,
  });

  const deleteSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => deleteReport(id)));
    },
    onSuccess: (_, ids) => {
      setSelectedId(prev => (prev && ids.includes(prev) ? null : prev));
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  function toggleChecked(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function requestDelete() {
    if (checkedIds.size === 0 || deleteSelected.isPending) return;
    if (localStorage.getItem(SKIP_CONFIRM_KEY) === "1") {
      deleteSelected.mutate(Array.from(checkedIds));
      return;
    }
    setConfirming(true);
  }

  function runConfirmed(skipNext: boolean) {
    if (skipNext) localStorage.setItem(SKIP_CONFIRM_KEY, "1");
    deleteSelected.mutate(Array.from(checkedIds));
    setConfirming(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-[#b1bac4]">
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

  const list = reports ?? [];
  const selected = list.find(r => r.id === selectedId) ?? list[0] ?? null;
  const allChecked = list.length > 0 && checkedIds.size === list.length;

  function toggleSelectAll() {
    if (allChecked) setCheckedIds(new Set());
    else            setCheckedIds(new Set(list.map(r => r.id)));
  }

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm uppercase tracking-widest text-[#b1bac4]">Reports</span>
        <button
          onClick={onClose}
          className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column: list + action bar */}
        <div className="w-[440px] shrink-0 border-r border-[#30363d] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="text-[11px] text-[#7d8590] text-center mt-6 px-3">
                No reports yet.
              </div>
            ) : (
              list.map(r => (
                <ReportRow
                  key={r.id}
                  report={r}
                  active={selected?.id === r.id}
                  checked={checkedIds.has(r.id)}
                  onClick={() => setSelectedId(r.id)}
                  onToggleChecked={() => toggleChecked(r.id)}
                />
              ))
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[#30363d] bg-[#161b22] shrink-0">
            <button
              onClick={toggleSelectAll}
              disabled={list.length === 0}
              className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {allChecked ? "Deselect all" : "Select all"}
            </button>
            <button
              onClick={requestDelete}
              disabled={checkedIds.size === 0 || deleteSelected.isPending}
              className="text-xs text-[#f85149] border border-[#3d1a1a] rounded px-2.5 py-1 hover:bg-[#1f0e0e] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteSelected.isPending ? "Deleting..." : `Delete${checkedIds.size > 0 ? ` (${checkedIds.size})` : ""}`}
            </button>
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[720px]">
            {selected ? <ReportDetail report={selected} /> : (
              <div className="text-[#7d8590] text-xs text-center mt-6">Pick a report from the list</div>
            )}
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmDeleteModal
          count={checkedIds.size}
          onCancel={() => setConfirming(false)}
          onConfirm={runConfirmed}
        />
      )}
    </div>
  );
}

// ─── Report row (list card) ──────────────────────────────────────────────────

function ReportRow({ report: r, active, checked, onClick, onToggleChecked }: {
  report: BattleReport;
  active: boolean;
  checked: boolean;
  onClick: () => void;
  onToggleChecked: () => void;
}) {
  const isOut   = r.direction === "outgoing";
  const cat     = categoryOf(r);
  const meta    = CATEGORY_META[cat];
  const verb    = VERB_BY_TYPE[r.type];
  const subject = `${r.fromCity.name} (${r.fromCity.x}, ${r.fromCity.y})`;

  return (
    <div
      onClick={onClick}
      className="relative flex items-start gap-2 px-3 py-2 border-b border-[#21262d] cursor-pointer text-xs"
      style={{
        background: active ? "#1c2129" : undefined,
        borderLeft: `3px solid ${meta.border}`,
      }}
    >
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div>
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>
        <div className="text-[#c9d1d9] text-[11px] leading-tight">
          <span className="font-semibold">{subject}</span>
          {" "}{verb}{" "}
          <span className="font-semibold">{r.toCity.name}</span>.
        </div>
        <div>
          <span className="text-[11px] text-[#b1bac4] uppercase tracking-widest">
            {isOut ? "▶ out" : "◀ in"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-[11px] text-[#b1bac4] whitespace-nowrap">{fmtTimeAgo(r.arrivalAt)}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleChecked}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer accent-[#f85149]"
        />
      </div>
    </div>
  );
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmDeleteModal({ count, onCancel, onConfirm }: {
  count: number;
  onCancel: () => void;
  onConfirm: (skipNext: boolean) => void;
}) {
  const [skip, setSkip] = useState(false);
  const msg = count === 1
    ? "Are you sure you want to delete this report?"
    : `Are you sure you want to delete ${count} reports?`;
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded p-5 w-[340px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[#c9d1d9] mb-3">{msg}</div>
        <label className="flex items-center gap-2 text-[#b1bac4] mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          Don't ask me again
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[#b1bac4] border border-[#30363d] rounded hover:bg-[#1c2129]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(skip)}
            className="px-3 py-1 text-[#f85149] border border-[#3d1a1a] rounded hover:bg-[#1f0e0e]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function ReportDetail({ report: r }: { report: BattleReport }) {
  const cat  = categoryOf(r);
  const meta = CATEGORY_META[cat];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div
        className="rounded p-3 flex items-center justify-between border"
        style={{ background: meta.bg, borderColor: meta.border }}
      >
        <div>
          <div className="text-sm font-bold" style={{ color: meta.fg }}>
            {meta.label}
          </div>
          <div className="text-[11px] text-[#b1bac4] mt-0.5">
            {r.fromCity.name} <span className="text-[#7d8590]">({r.fromCity.owner?.username ?? "Ghost city"})</span>
            {" → "}
            {r.toCity.name} <span className="text-[#7d8590]">({r.toCity.owner?.username ?? "Ghost city"})</span>
          </div>
        </div>
        <div className="text-[10px] text-[#7d8590] text-right">
          <div>{new Date(r.report?.battleAt ?? r.arrivalAt).toLocaleString()}</div>
          <div className="uppercase tracking-widest mt-0.5">{r.direction}</div>
        </div>
      </div>

      {r.type === "ATTACK"    && r.report && <AttackDetail report={r.report} />}
      {r.type === "SUPPORT"   && <SupportDetail units={r.units} />}
      {r.type === "RESOURCES" && <ResourcesDetail money={r.resourceMoney} energy={r.resourceEnergy} ammo={r.resourceAmmo} />}
    </div>
  );
}

function AttackDetail({ report: data }: { report: NonNullable<BattleReport["report"]> }) {
  const { openUnit } = useUnitInfo();
  const atkInit = asMap(data.attackerInitial);
  const atkSurv = asMap(data.attackerSurvivors);
  const defInit = asMap(data.defenderInitial);
  const defSurv = asMap(data.defenderSurvivors);

  return (
    <>
      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 overflow-x-auto">
        <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-24"></th>
                {ALL_UNITS.map(name => (
                  <th key={name} className="px-1 pb-1 text-center">
                    <img
                      src={`/images/units/${name.toLowerCase()}.jpg`}
                      alt={UNIT_DISPLAY[name]}
                      title={UNIT_DISPLAY[name]}
                      className="w-10 h-10 object-contain rounded mx-auto cursor-pointer hover:brightness-125 transition-[filter]"
                      onClick={() => openUnit(name)}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <BattleRow label="Attacker" labelColor="#f85149" sublabel="Units"  units={ALL_UNITS} values={atkInit} />
              <BattleRow label=""         labelColor="#f85149" sublabel="Losses" units={ALL_UNITS} values={atkSurv} initial={atkInit} kind="losses" borderBottom />
              <BattleRow label="Defender" labelColor="#3fb950" sublabel="Units"  units={ALL_UNITS} values={defInit} />
              <BattleRow label=""         labelColor="#3fb950" sublabel="Losses" units={ALL_UNITS} values={defSurv} initial={defInit} kind="losses" />
            </tbody>
          </table>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Air defense</div>
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

        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Loot</div>
          {data.stolenMoney + data.stolenEnergy + data.stolenAmmo === 0 ? (
            <div className="text-[#7d8590] text-[11px]">Nothing was taken.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <LootCell label="Money"  color="#7ee787" value={data.stolenMoney}  />
              <LootCell label="Energy" color="#79c0ff" value={data.stolenEnergy} />
              <LootCell label="Ammo"   color="#e3b341" value={data.stolenAmmo}   />
            </div>
          )}
        </div>
      </div>

      {data.loyaltyDamage > 0 && (
        <div className="rounded border border-[#d29922] bg-[#3d2e0a] p-3 text-xs flex justify-between text-[#d29922]">
          <span className="uppercase tracking-widest">Loyalty damage</span>
          <span className="font-mono">−{data.loyaltyDamage}</span>
        </div>
      )}
    </>
  );
}

function SupportDetail({ units }: { units: BattleUnitCount[] }) {
  const { openUnit } = useUnitInfo();
  const present = units.filter(u => u.quantity > 0);
  return (
    <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
      <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Units transferred</div>
      {present.length === 0 ? (
        <div className="text-[#7d8590] text-[11px]">No units</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {present.map(u => (
            <div
              key={u.name}
              onClick={() => openUnit(u.name)}
              className="flex items-center gap-1.5 bg-[#0d1117] border border-[#21262d] rounded px-2 py-1 cursor-pointer hover:bg-[#161b22] hover:border-[#484f58] transition-colors"
            >
              <img
                src={`/images/units/${u.name.toLowerCase()}.jpg`}
                alt={UNIT_DISPLAY[u.name]}
                className="w-6 h-6 object-contain rounded"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <span className="text-[#c9d1d9]">{UNIT_DISPLAY[u.name]}</span>
              <span className="text-[#79c0ff] font-mono">×{u.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourcesDetail({ money, energy, ammo }: { money: number; energy: number; ammo: number }) {
  return (
    <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
      <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Resources transferred</div>
      {money + energy + ammo === 0 ? (
        <div className="text-[#7d8590] text-[11px]">Nothing was sent.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <LootCell label="Money"  color="#7ee787" value={money}  />
          <LootCell label="Energy" color="#79c0ff" value={energy} />
          <LootCell label="Ammo"   color="#e3b341" value={ammo}   />
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
  kind?: "units" | "losses";
  borderBottom?: boolean;
}) {
  return (
    <tr className={borderBottom ? "border-b border-[#30363d]" : ""}>
      <td className="py-1 pr-2 text-right whitespace-nowrap">
        {label && <span className="font-semibold text-xs" style={{ color: labelColor }}>{label}</span>}
        <span className="text-[10px] text-[#7d8590] ml-1">{sublabel}:</span>
      </td>
      {units.map(name => {
        const v = values.get(name) ?? 0;
        if (kind === "losses") {
          const sent = initial?.get(name) ?? 0;
          if (sent === 0) {
            return <td key={name} className="py-1 text-center font-semibold text-[#7d8590]">0</td>;
          }
          const lost = sent - v;
          return (
            <td key={name} className={`py-1 text-center font-semibold ${lost > 0 ? "text-[#f85149]" : "text-[#7d8590]"}`}>
              {lost > 0 ? `-${lost.toLocaleString()}` : "0"}
            </td>
          );
        }
        return (
          <td key={name} className={`py-1 text-center ${v > 0 ? "text-[#c9d1d9]" : "text-[#7d8590]"}`}>
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
