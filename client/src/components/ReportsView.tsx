import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getReports, deleteReport, shareReport } from "../api/report.ts";
import { listMyInvitations, acceptInvitation, rejectInvitation, type AllianceInvitationForMe } from "../api/alliance.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";
import { useNow } from "../context/TickContext.tsx";
import type { BattleReport, BattleReportData, BattleUnitCount, CommandReportType, SpyReportData, UnitName, WithdrawalReportData } from "../types/index.ts";
import { BUILDING_DISPLAY, BUILDING_ORDER, UNIT_DISPLAY, UNIT_ORDER } from "../lib/labels.ts";
import { usePlayerProfile } from "../context/PlayerProfileContext.tsx";
import { useAllianceProfile } from "../context/AllianceProfileContext.tsx";

const ALL_UNITS: UnitName[] = [...UNIT_ORDER.filter(n => n !== "HACKER"), "GOVERNOR"] as UnitName[];

const SKIP_CONFIRM_KEY = "skipReportDeleteConfirm";

interface Props {
  onClose: () => void;
  initiallyRead?: Set<string>;
}

// ─── Category helpers ────────────────────────────────────────────────────────

type Category = "victory" | "loss" | "resources" | "support" | "withdrawal" | "spy_success" | "spy_failed";

function isSpyReport(r: BattleReport["report"]): r is SpyReportData {
  return !!r && (r as SpyReportData).spyReport === true;
}

function isWithdrawalReport(r: BattleReport["report"]): r is WithdrawalReportData {
  return !!r && (r as WithdrawalReportData).withdrawal === true;
}

function reportTimestamp(r: BattleReport): string | undefined {
  if (isWithdrawalReport(r.report)) return r.report.withdrawnAt;
  if (isSpyReport(r.report))        return r.report.battleAt;
  if (r.report && "battleAt" in r.report) return r.report.battleAt;
  return undefined;
}

function categoryOf(r: BattleReport): Category {
  if (r.type === "RESOURCES") return "resources";
  if (r.type === "SUPPORT")   return isWithdrawalReport(r.report) ? "withdrawal" : "support";
  if (r.type === "SPY") {
    const spy = isSpyReport(r.report) ? r.report : null;
    const attackerWon = spy?.success ?? false;
    const isOut = r.direction === "outgoing";
    const userWon = isOut ? attackerWon : !attackerWon;
    return userWon ? "spy_success" : "spy_failed";
  }
  // ATTACK — perspective-aware
  const attackerWon = (r.report as BattleReportData | null)?.attackerWon ?? false;
  const isOut = r.direction === "outgoing";
  const userWon = isOut ? attackerWon : !attackerWon;
  return userWon ? "victory" : "loss";
}

const CATEGORY_META: Record<Category, { label: string; fg: string; bg: string; border: string }> = {
  victory:     { label: "Victory",     fg: "#3fb950", bg: "#1a3d1a", border: "#3fb950" },
  loss:        { label: "Loss",        fg: "#f85149", bg: "#3d1a1a", border: "#f85149" },
  resources:   { label: "Resources",   fg: "#e3b341", bg: "#3d2e0a", border: "#e3b341" },
  support:     { label: "Support",     fg: "#58a6ff", bg: "#0c2744", border: "#58a6ff" },
  withdrawal:  { label: "Withdrawal",  fg: "#d2a8ff", bg: "#2a1f3d", border: "#d2a8ff" },
  spy_success: { label: "Spy success", fg: "#a371f7", bg: "#2e1a3d", border: "#a371f7" },
  spy_failed:  { label: "Spy failed",  fg: "#f85149", bg: "#3d1a1a", border: "#f85149" },
};

const VERB_BY_TYPE: Record<CommandReportType, string> = {
  ATTACK:    "attacks",
  SUPPORT:   "supports",
  RESOURCES: "sends resources to",
  SPY:       "spies on",
};

function fmtTimeAgo(iso: string, now: number): string {
  const d = new Date(iso);
  const diff = now - d.getTime();
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

export default function ReportsView({ onClose, initiallyRead }: Props) {
  const now = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(initiallyRead ?? []));
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    refetchInterval: 10000,
  });

  const { data: invites } = useQuery({
    queryKey: ["alliance", "me", "invitations"],
    queryFn: listMyInvitations,
    refetchInterval: 10000,
  });

  const deleteSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => deleteReport(id)));
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["reports"] });
      const previous = queryClient.getQueryData<BattleReport[]>(["reports"]);
      queryClient.setQueryData<BattleReport[]>(["reports"], (old) =>
        (old ?? []).filter((r) => !ids.includes(r.id))
      );
      setSelectedId(prev => (prev && ids.includes(prev) ? null : prev));
      setCheckedIds(new Set());
      return { previous };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["reports"], ctx.previous);
    },
    onSettled: () => {
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

  // Layout pe 2 coloane: lista rapoarte (stanga) + detaliu raport (dreapta). Panoul de detaliu
  // randeaza breakdown-ul complet: pierderi, prada, damage cladiri, snapshot-uri spy.
  // Am considerat un modal, dar side-by-side iti permite sa scanezi mai multe rapoarte
  // fara sa tot deschizi/inchizi.
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

      <div className="flex w-full h-screen overflow-hidden justify-center">
        {/* Left column: list + action bar */}
        <div className="w-[440px] shrink-0 border-r border-[#30363d] flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {(invites?.length ?? 0) > 0 && invites!.map(inv => (
              <InviteNotification key={inv.id} inv={inv} />
            ))}
            {list.length === 0 && (invites?.length ?? 0) === 0 ? (
              <div className="text-[11px] text-[#dddddd] text-center mt-6 px-3">
                No reports yet.
              </div>
            ) : list.length === 0 ? null : (
              list.map(r => (
                <ReportRow
                  key={r.id}
                  report={r}
                  now={now}
                  active={selected?.id === r.id}
                  checked={checkedIds.has(r.id)}
                  unread={!readIds.has(r.id)}
                  onClick={() => { setSelectedId(r.id); setReadIds(prev => new Set(prev).add(r.id)); }}
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
        <div className="w-[720px] shrink-0 overflow-y-auto p-4">
          <div className="max-w-[720px]">
            {selected ? <ReportDetail report={selected} /> : (
              <div className="text-[#dddddd] text-xs text-center mt-6">Pick a report from the list</div>
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

function ReportRow({ report: r, now, active, checked, unread, onClick, onToggleChecked }: {
  report: BattleReport;
  now: number;
  active: boolean;
  checked: boolean;
  unread: boolean;
  onClick: () => void;
  onToggleChecked: () => void;
}) {
  const isOut   = r.direction === "outgoing";
  const cat     = categoryOf(r);
  const meta    = CATEGORY_META[cat];

  const fromName  = `${r.fromCity.name} (${r.fromCity.x}, ${r.fromCity.y})`;
  const toName    = `${r.toCity.name} (${r.toCity.x}, ${r.toCity.y})`;
  const fromOwner = r.fromCity.owner?.username ?? "A ghost city";

  let message: React.ReactNode;
  if (r.type === "SUPPORT" && isWithdrawalReport(r.report)) {
    message = isOut ? (
      <>Your units from <span className="font-semibold">{toName}</span> are on their way home.</>
    ) : (
      <><span className="font-semibold">{fromOwner}</span> withdrew their support from your city <span className="font-semibold">{r.toCity.name}</span>.</>
    );
  } else if (r.type === "SUPPORT") {
    message = isOut ? (
      <>Your units are supporting <span className="font-semibold">{toName}</span>.</>
    ) : (
      <><span className="font-semibold">{fromName}</span> is supporting your city <span className="font-semibold">{r.toCity.name}</span>.</>
    );
  } else {
    const verb = VERB_BY_TYPE[r.type];
    message = (
      <>
        <span className="font-semibold">{fromName}</span>
        {" "}{verb}{" "}
        <span className="font-semibold">{r.toCity.name}</span>.
      </>
    );
  }

  return (
    <div
      onClick={onClick}
      className="relative flex items-start gap-2 px-3 py-2 border-b border-[#21262d] cursor-pointer text-xs"
      style={{
        background: active ? "#1c2129" : unread ? "#161b22" : "#07090c",
        borderLeft: `3px solid ${unread ? meta.border : "#1f2530"}`,
        opacity: unread ? 1 : 0.42,
      }}
    >
      {unread && (
        <span
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ background: meta.fg, boxShadow: `0 0 4px ${meta.fg}` }}
          title="Unread"
        />
      )}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div>
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>
        <div
          className="text-[11px] leading-tight"
          style={{ color: unread ? "#f0f6fc" : "#8b949e", fontWeight: unread ? 600 : 400 }}
        >
          {message}
        </div>
        <div>
          <span className="text-[11px] text-[#b1bac4] uppercase tracking-widest">
            {isOut ? "▶ out" : "◀ in"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-[11px] text-[#b1bac4] whitespace-nowrap">{fmtTimeAgo(reportTimestamp(r) ?? r.arrivalAt, now)}</span>
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
  const { openPlayer } = usePlayerProfile();
  const navigate = useNavigate();
  const fromOwner = r.fromCity.owner;
  const toOwner = r.toCity.owner;
  const [sharing, setSharing] = useState(false);

  function goToCity(cityId: string) {
    navigate(`/map?selectCityId=${encodeURIComponent(cityId)}`);
  }

  const canShare = r.report && !isWithdrawalReport(r.report);

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
            <button type="button" onClick={() => goToCity(r.fromCity.id)} className="text-[#e6b800] hover:underline">
              {r.fromCity.name}
            </button>
            <span className="text-[#dddddd] font-mono"> ({r.fromCity.x}, {r.fromCity.y})</span>
            {" "}
            <span className="text-[#dddddd]">
              [{fromOwner ? (
                <button
                  type="button"
                  onClick={() => openPlayer(fromOwner.id)}
                  className="text-[#79c0ff] hover:underline"
                >
                  {fromOwner.username}
                </button>
              ) : "Ghost city"}]
            </span>
            {" → "}
            <button type="button" onClick={() => goToCity(r.toCity.id)} className="text-[#e6b800] hover:underline">
              {r.toCity.name}
            </button>
            <span className="text-[#dddddd] font-mono"> ({r.toCity.x}, {r.toCity.y})</span>
            {" "}
            <span className="text-[#dddddd]">
              [{toOwner ? (
                <button
                  type="button"
                  onClick={() => openPlayer(toOwner.id)}
                  className="text-[#79c0ff] hover:underline"
                >
                  {toOwner.username}
                </button>
              ) : "Ghost city"}]
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">

          <div className="text-[10px] text-[#dddddd] text-right">
            {canShare && (
            <button
              onClick={() => setSharing(true)}
              className="text-[12px] font-bold text-[#36bacf] border border-[#30363d] rounded px-2 py-0.5 hover:bg-[#1caf4d] hover:text-[#c9d1d9]"
            >
              Share
            </button>
          )}
            <div>{new Date(reportTimestamp(r) ?? r.arrivalAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {r.type === "ATTACK"    && r.report && !isSpyReport(r.report) && !isWithdrawalReport(r.report) && <AttackDetail report={r.report as BattleReportData} />}
      {r.type === "SUPPORT"   && (
        isWithdrawalReport(r.report)
          ? <WithdrawalDetail units={r.units} direction={r.direction} />
          : <SupportDetail units={r.units} />
      )}
      {r.type === "RESOURCES" && <ResourcesDetail money={r.resourceMoney} energy={r.resourceEnergy} ammo={r.resourceAmmo} />}
      {r.type === "SPY"       && isSpyReport(r.report) && <SpyDetail report={r.report} direction={r.direction} />}

      {sharing && <ShareReportModal report={r} onClose={() => setSharing(false)} />}
    </div>
  );
}

function AttackDetail({ report: data }: { report: BattleReportData }) {
  const { openUnit } = useUnitInfo();
  const atkInit = asMap(data.attackerInitial);
  const atkSurv = asMap(data.attackerSurvivors);
  const defInit = asMap(data.defenderInitial);
  const defSurv = asMap(data.defenderSurvivors);
  const defenderHidden = !data.defenderInitial;
  const airDefenseHidden = data.airDefenseInitialLevel == null;

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
              {defenderHidden ? (
                <tr>
                  <td colSpan={ALL_UNITS.length + 1} className="py-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#b1bac4] italic">
                      <span className="text-sm">❓</span>
                      <span className="text-[11px]">Defender forces unknown — your attack was defeated</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  <BattleRow label="Defender" labelColor="#3fb950" sublabel="Units"  units={ALL_UNITS} values={defInit} />
                  <BattleRow label=""         labelColor="#3fb950" sublabel="Losses" units={ALL_UNITS} values={defSurv} initial={defInit} kind="losses" />
                </>
              )}
            </tbody>
          </table>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Air defense</div>
          {airDefenseHidden ? (
            <div className="flex items-center justify-center gap-2 text-[#b1bac4] italic py-2">
              <span className="text-sm">❓</span>
              <span className="text-[11px]">Air defense unknown</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src="/images/buildings/air_defense.jpg"
                alt="Air defense"
                title="Air defense"
                className="w-12 h-12 object-contain rounded"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between text-[#c9d1d9]">
                  <span>Before</span>
                  <span className="font-mono">{data.airDefenseInitialLevel ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#c9d1d9]">After</span>
                  {(data.airDefenseLevelsDestroyed ?? 0) > 0 ? (
                    <span className="font-mono font-semibold text-[#f85149]">−{data.airDefenseLevelsDestroyed}</span>
                  ) : (
                    <span className="font-mono font-semibold text-[#c9d1d9]">0</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Loot</div>
          {data.stolenMoney + data.stolenEnergy + data.stolenAmmo === 0 ? (
            <div className="text-[#dddddd] text-[11px]">Nothing was taken.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <LootCell label="Money"  color="#7ee787" value={data.stolenMoney}  />
              <LootCell label="Energy" color="#79c0ff" value={data.stolenEnergy} />
              <LootCell label="Ammo"   color="#e3b341" value={data.stolenAmmo}   />
            </div>
          )}
        </div>
      </div>

      {data.targetBuilding && (data.buildingLevelsDestroyed ?? 0) > 0 && (
        <div className="rounded border border-[#d2a8ff] bg-[#2a1f3d] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Building demolished</div>
          <div className="flex items-center gap-3">
            <img
              src={`/images/buildings/${data.targetBuilding.toLowerCase()}.jpg`}
              alt={BUILDING_DISPLAY[data.targetBuilding as keyof typeof BUILDING_DISPLAY] ?? data.targetBuilding}
              className="w-10 h-10 object-contain rounded"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-[#c9d1d9]">{BUILDING_DISPLAY[data.targetBuilding as keyof typeof BUILDING_DISPLAY] ?? data.targetBuilding}</span>
              <div className="flex justify-between">
                <span className="text-[#c9d1d9]">Level {data.targetBuildingInitialLevel} → {(data.targetBuildingInitialLevel ?? 0) - (data.buildingLevelsDestroyed ?? 0)}</span>
                <span className="font-mono font-semibold text-[#d2a8ff]">−{data.buildingLevelsDestroyed}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.targetBuilding && (data.buildingLevelsDestroyed ?? 0) === 0 && (
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs text-[#dddddd]">
          Target: {BUILDING_DISPLAY[data.targetBuilding as keyof typeof BUILDING_DISPLAY] ?? data.targetBuilding} — no damage dealt
        </div>
      )}

      {data.loyaltyDamage > 0 && (
        <div className="rounded border border-[#d29922] bg-[#3d2e0a] p-3 text-xs flex justify-between text-[#d29922]">
          <span className="uppercase tracking-widest">Loyalty damage</span>
          <span className="font-mono">−{data.loyaltyDamage}</span>
        </div>
      )}

      {data.conquered && (
        <div className="rounded border border-[#3fb950] bg-[#0e2a14] p-3 text-xs text-[#7ee787] uppercase tracking-widest text-center font-semibold">
          City conquered — one Governor was consumed
        </div>
      )}
    </>
  );
}

function WithdrawalDetail({ units, direction }: { units: BattleUnitCount[]; direction: "outgoing" | "incoming" }) {
  const { openUnit } = useUnitInfo();
  const present = units.filter(u => u.quantity > 0);
  const heading = direction === "outgoing" ? "Your units returning home" : "Units that left your city";
  return (
    <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
      <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">{heading}</div>
      {present.length === 0 ? (
        <div className="text-[#dddddd] text-[11px]">No units</div>
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
              <span className="text-[#d2a8ff] font-mono">×{u.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportDetail({ units }: { units: BattleUnitCount[] }) {
  const { openUnit } = useUnitInfo();
  const present = units.filter(u => u.quantity > 0);
  return (
    <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
      <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Units transferred</div>
      {present.length === 0 ? (
        <div className="text-[#dddddd] text-[11px]">No units</div>
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
        <div className="text-[#dddddd] text-[11px]">Nothing was sent.</div>
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
        <span className="text-[10px] text-[#dddddd] ml-1">{sublabel}:</span>
      </td>
      {units.map(name => {
        const v = values.get(name) ?? 0;
        if (kind === "losses") {
          const sent = initial?.get(name) ?? 0;
          if (sent === 0) {
            return <td key={name} className="py-1 text-center font-semibold text-[#dddddd]">0</td>;
          }
          const lost = sent - v;
          return (
            <td key={name} className={`py-1 text-center font-semibold ${lost > 0 ? "text-[#f85149]" : "text-[#dddddd]"}`}>
              {lost > 0 ? `-${lost.toLocaleString()}` : "0"}
            </td>
          );
        }
        return (
          <td key={name} className={`py-1 text-center ${v > 0 ? "text-[#c9d1d9]" : "text-[#dddddd]"}`}>
            {v.toLocaleString()}
          </td>
        );
      })}
    </tr>
  );
}

function SpyDetail({ report: data, direction }: { report: SpyReportData; direction: "outgoing" | "incoming" }) {
  const isIncoming = direction === "incoming";
  const { openUnit } = useUnitInfo();

  const attackerLosses = data.attackerHackers - data.attackerSurvivors;
  const defenderLosses = 0; // defender hackers never die in spy missions

  // Atacatorul nu afla niciodata cati hackeri avea aparatorul daca spionajul a esuat.
  const hideDefenderCount = !isIncoming && !data.success;

  const hackerBox = (
    <div className="rounded border border-[#30363d] bg-[#161b22] p-3">
      <div className="flex items-center justify-around gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-widest text-[#f85149]">Attacker</span>
          <img
            src="/images/units/hacker.jpg"
            alt="Hacker"
            title="Hacker"
            className="w-12 h-12 object-contain rounded cursor-pointer hover:brightness-125 transition-[filter]"
            onClick={() => openUnit("HACKER")}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-[#c9d1d9] font-mono text-xs">{data.attackerHackers.toLocaleString()}</span>
          <span className="text-[#f85149] font-mono text-[11px]">
            {attackerLosses > 0 ? `−${attackerLosses.toLocaleString()}` : "−0"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-widest text-[#58a6ff]">Defender</span>
          <img
            src="/images/units/hacker.jpg"
            alt="Hacker"
            title="Hacker"
            className="w-12 h-12 object-contain rounded cursor-pointer hover:brightness-125 transition-[filter]"
            onClick={() => openUnit("HACKER")}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-[#c9d1d9] font-mono text-xs">
            {hideDefenderCount ? "?" : data.defenderHackers.toLocaleString()}
          </span>
          <span className="text-[#f85149] font-mono text-[11px]">
            {hideDefenderCount ? "−" : (defenderLosses > 0 ? `−${defenderLosses.toLocaleString()}` : "−0")}
          </span>
        </div>
      </div>
    </div>
  );

  if (!data.success || !data.snapshot) {
    return (
      <>
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">
            {isIncoming ? "Spy attempt blocked" : "Infiltration failed"}
          </div>
          <div className="text-[11px] text-[#b1bac4]">
            {isIncoming
              ? "An enemy tried to infiltrate your city. Your hackers detected and eliminated all intruders — no intel was leaked."
              : "The target had at least as many hackers as were sent. All attacking hackers were destroyed and no intel was retrieved."}
          </div>
        </div>
        {hackerBox}
      </>
    );
  }

  const { buildings, units } = data.snapshot;
  const resources = data.snapshot.resources ?? { money: 0, energy: 0, ammo: 0 };
  const hasResources = !!data.snapshot.resources;
  const buildingByName = new Map(buildings.map(b => [b.name, b.level]));
  const activeUnits = units.filter(u => u.quantity > 0);

  return (
    <>
      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4]">Infiltration successful</div>
      </div>

      {hackerBox}

      {hasResources && (
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Resources</div>
          <div className="grid grid-cols-3 gap-2">
            <LootCell label="Money"  color="#7ee787" value={resources.money} />
            <LootCell label="Energy" color="#79c0ff" value={resources.energy} />
            <LootCell label="Ammo"   color="#e3b341" value={resources.ammo} />
          </div>
        </div>
      )}

      {data.snapshot.loyalty !== undefined && (
        <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Loyalty</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-[#21262d] rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${data.snapshot.loyalty}%`,
                  background: data.snapshot.loyalty > 50 ? "#3fb950" : data.snapshot.loyalty > 25 ? "#e3b341" : "#f85149",
                }}
              />
            </div>
            <span className="text-[#c9d1d9] font-mono font-semibold">{data.snapshot.loyalty}%</span>
          </div>
        </div>
      )}

      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs">
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Buildings</div>
        <div className="grid grid-cols-3 gap-1.5">
          {BUILDING_ORDER.map(name => {
            const lvl = buildingByName.get(name) ?? 0;
            return (
              <div key={name} className="flex items-center gap-2 bg-[#0d1117] border border-[#21262d] rounded px-2 py-1">
                <img
                  src={`/images/buildings/${name.toLowerCase()}.jpg`}
                  alt={BUILDING_DISPLAY[name]}
                  title={BUILDING_DISPLAY[name]}
                  className="w-8 h-8 object-contain rounded shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-[#c9d1d9] truncate flex-1">{BUILDING_DISPLAY[name]}</span>
                <span className={`font-mono ${lvl > 0 ? "text-[#e6b800]" : "text-[#dddddd]"}`}>
                  {lvl > 0 ? lvl : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded border border-[#30363d] bg-[#161b22] p-3 text-xs overflow-x-auto">
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-2">Units in target city</div>
        {activeUnits.length === 0 ? (
          <div className="text-[#dddddd] text-[11px]">No units defending.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="w-16"></th>
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
              <tr>
                <td className="py-1 pr-2 text-right whitespace-nowrap">
                  <span className="text-[10px] text-[#dddddd]">Units:</span>
                </td>
                {ALL_UNITS.map(name => {
                  const u = activeUnits.find(x => x.name === name);
                  const q = u?.quantity ?? 0;
                  return (
                    <td key={name} className={`py-1 text-center ${q > 0 ? "text-[#c9d1d9]" : "text-[#dddddd]"}`}>
                      {q.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ShareReportModal({ report: r, onClose }: { report: BattleReport; onClose: () => void }) {
  const isBattle = r.type === "ATTACK" && r.report && !isSpyReport(r.report);
  const isSpy = r.type === "SPY" && r.report && isSpyReport(r.report);
  const hasOptions = isBattle || isSpy;

  const [hideOwnTroops, setHideOwnTroops] = useState(false);
  const [hideOwnInitial, setHideOwnInitial] = useState(false);
  const [hideEnemyTroops, setHideEnemyTroops] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleShare() {
    setPending(true);
    setError(null);
    try {
      const { id } = await shareReport(r.id, { hideOwnTroops, hideOwnInitial, hideEnemyTroops });
      const tag = `[report:${id}]`;
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Failed to create share link");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded p-5 w-[360px] text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-[#c9d1d9] font-semibold mb-3">Share report</div>

        {hasOptions && (
          <div className="flex flex-col gap-2 mb-4">
            <div className="text-[10px] uppercase tracking-widest text-[#dddddd] mb-1">Visibility options</div>
            <label className="flex items-center gap-2 text-[#b1bac4] cursor-pointer select-none">
              <input type="checkbox" checked={hideOwnTroops} onChange={(e) => { setHideOwnTroops(e.target.checked); if (e.target.checked) setHideOwnInitial(false); }} />
              Hide own troops
            </label>
            {isBattle && !hideOwnTroops && (
              <label className="flex items-center gap-2 text-[#b1bac4] cursor-pointer select-none ml-4">
                <input type="checkbox" checked={hideOwnInitial} onChange={(e) => setHideOwnInitial(e.target.checked)} />
                Show only own losses (hide initial count)
              </label>
            )}
            <label className="flex items-center gap-2 text-[#b1bac4] cursor-pointer select-none">
              <input type="checkbox" checked={hideEnemyTroops} onChange={(e) => setHideEnemyTroops(e.target.checked)} />
              {isSpy ? "Hide intel (buildings, units, resources)" : "Hide enemy troops"}
            </label>
          </div>
        )}

        {!hasOptions && (
          <div className="text-[#dddddd] mb-4">This report will be shared as-is.</div>
        )}

        {error && <div className="text-[#f85149] mb-2">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-[#b1bac4] border border-[#30363d] rounded hover:bg-[#1c2129]"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={pending}
            className="px-3 py-1 text-[#0d1117] bg-[#d2a8ff] rounded font-semibold hover:bg-[#b87aff] disabled:opacity-40"
          >
            {copied ? "Copied to clipboard!" : pending ? "Sharing..." : "Share"}
          </button>
        </div>

        {copied && (
          <div className="mt-3 text-[11px] text-[#dddddd]">
            Paste the tag into any message (private or alliance) to share this report.
          </div>
        )}
      </div>
    </div>
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

function InviteNotification({ inv }: { inv: AllianceInvitationForMe }) {
  const queryClient = useQueryClient();
  const { openPlayer } = usePlayerProfile();
  const { openAlliance } = useAllianceProfile();
  const [err, setErr] = useState<string | null>(null);

  function onDone() {
    queryClient.invalidateQueries({ queryKey: ["alliance"] });
  }

  const accept = useMutation({
    mutationFn: () => acceptInvitation(inv.id),
    onSuccess: onDone,
    onError: (e: Error) => setErr(e.message),
  });
  const reject = useMutation({
    mutationFn: () => rejectInvitation(inv.id),
    onSuccess: onDone,
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="px-3 py-2.5 border-b border-[#30363d] bg-[#0c2744]">
      <div className="text-xs text-[#c9d1d9]">
        <button
          type="button"
          onClick={() => openPlayer(inv.invitedBy.id)}
          className="text-[#79c0ff] hover:underline font-semibold"
        >
          {inv.invitedBy.username}
        </button>
        {" invited you to "}
        <button
          type="button"
          onClick={() => openAlliance(inv.alliance.id)}
          className="hover:underline"
        >
          <span className="text-[#e6b800] font-semibold">[{inv.alliance.tag}]</span>{" "}
          <span className="text-[#c9d1d9]">{inv.alliance.name}</span>
        </button>
        <span className="text-[#6e7681] ml-1.5 text-[10px]">
          {new Date(inv.createdAt).toLocaleDateString()}
        </span>
      </div>
      {err && <div className="text-[10px] text-[#f85149] mt-1">{err}</div>}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
          className="text-[10px] border border-[#3fb950] text-[#3fb950] bg-[#0e2a14] rounded px-3 py-1 hover:bg-[#1a3d1a] disabled:opacity-40 font-semibold"
        >
          Accept
        </button>
        <button
          onClick={() => reject.mutate()}
          disabled={reject.isPending}
          className="text-[10px] border border-[#f85149] text-[#f85149] rounded px-3 py-1 hover:bg-[#3d1a1a] disabled:opacity-40"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
