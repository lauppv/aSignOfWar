import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getSharedReport } from "@/features/reports/api/report";
import { getSharedSiege } from "@/features/siege/api/siege";
import { BUILDING_DISPLAY, BUILDING_ORDER, UNIT_DISPLAY, UNIT_ORDER } from "@/shared/lib/labels";
import { useUnitInfo } from "@/shared/context/UnitInfoContext";
import { usePlayerProfile } from "@/features/rankings/context/PlayerProfileContext";
import { useNow } from "@/shared/context/TickContext";
import type { BattleReportData, SpyReportData, UnitName, BattleUnitCount } from "@/shared/types";
import UnitIcon from "@/shared/ui/UnitIcon";
import { useEffect, useState } from "react";

const REPORT_TAG = /\[report:([a-f0-9-]+)\]/gi;
const SIEGE_TAG  = /\[siege:([a-f0-9-]+)\]/gi;

// Returns a token list where strings are plain text segments and objects describe an embed.
// Tags can interleave freely in a single message body.
type Token = string | { kind: "report"; shareId: string } | { kind: "siege"; shareId: string };

function tokenize(content: string): Token[] {
  // Find all tag positions (both kinds), sort by index, slice plain text in between.
  const matches: { start: number; end: number; tok: Token }[] = [];
  for (const m of content.matchAll(REPORT_TAG)) {
    matches.push({ start: m.index!, end: m.index! + m[0].length, tok: { kind: "report", shareId: m[1] } });
  }
  for (const m of content.matchAll(SIEGE_TAG)) {
    matches.push({ start: m.index!, end: m.index! + m[0].length, tok: { kind: "siege", shareId: m[1] } });
  }
  matches.sort((a, b) => a.start - b.start);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) tokens.push(content.slice(cursor, m.start));
    tokens.push(m.tok);
    cursor = m.end;
  }
  if (cursor < content.length) tokens.push(content.slice(cursor));
  return tokens;
}
const ALL_UNITS: UnitName[] = [...UNIT_ORDER.filter(n => n !== "HACKER"), "GOVERNOR"] as UnitName[];

interface Props {
  content: string;
  onExpandChange?: (expanded: boolean) => void;
}

export default function MessageContent({ content, onExpandChange }: Props) {
  const tokens = tokenize(content);

  if (tokens.length === 1 && typeof tokens[0] === "string") {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {tokens.map((p, i) => {
        if (typeof p === "string") {
          return <span key={i} className="whitespace-pre-wrap break-words">{p}</span>;
        }
        if (p.kind === "report") {
          return <SharedReportCard key={i} shareId={p.shareId} onExpandChange={onExpandChange} />;
        }
        return <SharedSiegeCard key={i} shareId={p.shareId} onExpandChange={onExpandChange} />;
      })}
    </div>
  );
}

function fmtRemainingMs(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

const SIEGE_STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ACTIVE:              { text: "Under siege",         color: "#f85149" },
  BROKEN_BY_DEFENSE:   { text: "Siege broken",        color: "#3fb950" },
  BROKEN_BY_NEW_SIEGE: { text: "Replaced by another", color: "#e3b341" },
  COMPLETED_CONQUEST:  { text: "City conquered",      color: "#a371f7" },
};

function SharedSiegeCard({ shareId, onExpandChange }: { shareId: string; onExpandChange?: (e: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const now = useNow();

  useEffect(() => { onExpandChange?.(expanded); }, [expanded, onExpandChange]);

  // Polling refetch only when the card is expanded — collapsed cards just show the cached header.
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-siege", shareId],
    queryFn:  () => getSharedSiege(shareId),
    refetchInterval: expanded ? 5000 : false,
  });

  if (isLoading) {
    return <div className="rounded border border-[#30363d] bg-[#161b22] p-2 text-[11px] text-[#7d8590]">Loading siege...</div>;
  }
  if (error || !data) {
    return <div className="rounded border border-[#30363d] bg-[#161b22] p-2 text-[11px] text-[#7d8590]">Siege link unavailable</div>;
  }

  const meta = SIEGE_STATUS_LABEL[data.siege.status] ?? { text: data.siege.status, color: "#c9d1d9" };
  const remaining = data.siege.status === "ACTIVE"
    ? new Date(data.siege.endsAt).getTime() - now
    : null;

  return (
    <div className="rounded border border-[#30363d] bg-[#0d1117] text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#161b22] hover:bg-[#1c2129] cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: meta.color }}>{meta.text}</span>
          <span className="text-[#7d8590]">
            {data.siege.attacker.username} → {data.siege.city.name}
            {data.siege.defender && <span className="text-[#7d8590]"> ({data.siege.defender.username})</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {remaining !== null && remaining > 0 && (
            <span className="font-mono text-[#f85149]">{fmtRemainingMs(remaining)} left</span>
          )}
          <span className="text-[10px] text-[#7d8590]">shared by {data.sharedBy.username}</span>
          <span className="text-[#7d8590]">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex justify-between text-[#b1bac4] text-[11px]">
            <span>City: <span className="text-[#c9d1d9]">{data.siege.city.name}</span> <span className="font-mono">({data.siege.city.x}, {data.siege.city.y})</span></span>
            <span>Started: <span className="text-[#c9d1d9]">{new Date(data.siege.startedAt).toLocaleString()}</span></span>
          </div>

          {data.live ? (
            <>
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mt-1">Defending force</div>
              {data.live.defendingForce.length === 0 ? (
                <div className="text-[11px] text-[#7d8590] italic">No surviving units in the city</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.live.defendingForce.map(u => (
                    <UnitIcon key={u.name} name={u.name} quantity={u.quantity} size={24} />
                  ))}
                </div>
              )}
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mt-1">Incoming commands</div>
              {data.live.incomingCommands.length === 0 ? (
                <div className="text-[11px] text-[#7d8590] italic">None inbound</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {data.live.incomingCommands.map(c => (
                    <div key={c.id} className="flex justify-between bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-[11px]">
                      <span>
                        <span className="font-semibold text-[#c9d1d9]">{c.type}</span>
                        <span className="text-[#7d8590]"> from {c.fromCityName}{c.fromOwnerName && ` (${c.fromOwnerName})`}</span>
                      </span>
                      <span className="font-mono text-[#e3b341]">{fmtRemainingMs(new Date(c.arrivalAt).getTime() - now)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-[#7d8590] italic">
              This siege has ended — live status no longer available.
            </div>
          )}
        </div>
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
            <span className="text-[#f85149]">
              → {data.airDefenseInitialLevel - (data.airDefenseLevelsDestroyed ?? 0)} (−{data.airDefenseLevelsDestroyed})
            </span>
          )}
        </div>
      )}

      {data.targetBuilding && (data.buildingLevelsDestroyed ?? 0) > 0 && (
        <div className="flex items-center gap-3 text-xs text-[#b1bac4]">
          <img
            src={`/images/buildings/${data.targetBuilding.toLowerCase()}.jpg`}
            alt={data.targetBuilding}
            className="w-8 h-8 object-contain rounded"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span>{data.targetBuilding}: {data.targetBuildingInitialLevel}</span>
          <span className="text-[#f85149]">
            → {(data.targetBuildingInitialLevel ?? 0) - (data.buildingLevelsDestroyed ?? 0)} (−{data.buildingLevelsDestroyed})
          </span>
        </div>
      )}

      {(data.stolenMoney + data.stolenEnergy + data.stolenAmmo > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <SharedLoot label="Money" color="#7ee787" value={data.stolenMoney} />
          <SharedLoot label="Energy" color="#79c0ff" value={data.stolenEnergy} />
          <SharedLoot label="Ammo" color="#e3b341" value={data.stolenAmmo} />
        </div>
      )}

      {data.siegeStarted && (
        <div className="text-xs text-[#f85149] font-semibold">Siege started</div>
      )}

      {data.siegeDefenseReport && data.siegeBroken && (
        <div className="text-xs text-[#f85149] font-semibold">Siege destroyed</div>
      )}

      {data.siegeDefenseReport && !data.siegeBroken && (
        <div className="text-xs text-[#e3b341] font-semibold">Siege survived</div>
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
