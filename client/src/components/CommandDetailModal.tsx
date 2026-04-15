import type { OutgoingCommand, IncomingCommand } from "../types/index.ts";
import { UNIT_DISPLAY } from "../lib/labels.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

type MergedCommand =
  | ({ direction: "outgoing" } & OutgoingCommand)
  | ({ direction: "incoming" } & IncomingCommand);

interface Props {
  cmd: MergedCommand;
  onClose: () => void;
}

const TYPE_META = {
  ATTACK:    { label: "Attack",    fg: "#f85149", bg: "#3d1a1a" },
  SUPPORT:   { label: "Support",   fg: "#58a6ff", bg: "#0c2744" },
  RESOURCES: { label: "Resources", fg: "#d29922", bg: "#3d2e0a" },
  SPY:       { label: "Spy",       fg: "#a371f7", bg: "#2e1a3d" },
} as const;

function fmtArrival(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "arriving...";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function CommandDetailModal({ cmd, onClose }: Props) {
  const { openUnit } = useUnitInfo();
  const isOut  = cmd.direction === "outgoing";
  const meta   = TYPE_META[cmd.type];
  const other  = isOut
    ? (cmd as OutgoingCommand & { direction: "outgoing" }).toCity
    : (cmd as IncomingCommand & { direction: "incoming" }).fromCity;
  const isReturning = cmd.status === "RETURNING";
  const isStationed = cmd.status === "ARRIVED";
  const directionLabel = isStationed
    ? "⛨ stationed"
    : isReturning ? "↩ returning" : (isOut ? "▶ outgoing" : "◀ incoming");
  const activeUnits = cmd.units.filter(u => u.quantity > 0);
  const hiddenEnemyUnits = !isOut && (cmd.type === "ATTACK" || cmd.type === "SPY");
  const hasResources = cmd.resourceMoney + cmd.resourceEnergy + cmd.resourceAmmo > 0;
  const showLoot = cmd.type === "ATTACK" && isReturning && hasResources;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-lg w-[420px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ background: meta.bg, borderColor: meta.fg }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.fg }}>
              {meta.label}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#b1bac4]">
              {directionLabel}
            </span>
          </div>
          <button onClick={onClose} className="text-[#b1bac4] hover:text-[#c9d1d9] text-sm leading-none px-1">
            ×
          </button>
        </div>

        <div className="p-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#b1bac4]">{isOut ? "To" : "From"}</span>
            <span className="text-[#c9d1d9] font-semibold">
              {other.name}
              <span className="text-[#b1bac4] font-mono font-normal"> ({other.x}, {other.y})</span>
              <span className="text-[#7d8590]"> · {other.owner?.username ?? "Ghost city"}</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#b1bac4]">
              {isStationed ? "Status" : isReturning ? "Returns in" : "Arrives in"}
            </span>
            <span className="text-[#c9d1d9] font-mono">
              {isStationed ? "Stationed" : fmtArrival(cmd.arrivalAt)}
            </span>
          </div>

          {cmd.type === "RESOURCES" ? (
            <div className="mt-1 pt-2 border-t border-[#30363d] flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Resources</div>
              {hasResources ? (
                <div className="grid grid-cols-3 gap-2">
                  <ResourceCell label="Money"  color="#7ee787" value={cmd.resourceMoney}  />
                  <ResourceCell label="Energy" color="#79c0ff" value={cmd.resourceEnergy} />
                  <ResourceCell label="Ammo"   color="#e3b341" value={cmd.resourceAmmo}   />
                </div>
              ) : (
                <span className="text-[11px] text-[#7d8590]">Nothing</span>
              )}
            </div>
          ) : (
            <div className="mt-1 pt-2 border-t border-[#30363d] flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Units</div>
              {hiddenEnemyUnits ? (
                <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21262d] rounded px-2 py-2">
                  <span className="text-sm">❓</span>
                  <span className="text-[11px] text-[#b1bac4] italic">
                    Unknown enemy force — scouts couldn't count them
                  </span>
                </div>
              ) : activeUnits.length === 0 ? (
                <span className="text-[11px] text-[#7d8590]">No units</span>
              ) : (
                <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto pr-1">
                  {activeUnits.map(u => (
                    <div
                      key={u.name}
                      onClick={() => openUnit(u.name)}
                      className="flex items-center gap-2 bg-[#0d1117] border border-[#21262d] rounded px-2 py-1 cursor-pointer hover:border-[#484f58]"
                    >
                      <img
                        src={`/images/units/${u.name.toLowerCase()}.jpg`}
                        alt={UNIT_DISPLAY[u.name]}
                        className="w-8 h-8 object-contain rounded shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="flex-1 text-[#c9d1d9]">{UNIT_DISPLAY[u.name]}</span>
                      <span className="text-[#e6b800] font-mono font-semibold">
                        {u.quantity.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showLoot && (
            <div className="mt-1 pt-2 border-t border-[#30363d] flex flex-col gap-1">
              <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Loot</div>
              <div className="grid grid-cols-3 gap-2">
                <ResourceCell label="Money"  color="#7ee787" value={cmd.resourceMoney}  />
                <ResourceCell label="Energy" color="#79c0ff" value={cmd.resourceEnergy} />
                <ResourceCell label="Ammo"   color="#e3b341" value={cmd.resourceAmmo}   />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceCell({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-[#0d1117] rounded p-2 border border-[#21262d]">
      <span className="text-[9px] uppercase tracking-widest" style={{ color }}>{label}</span>
      <span className="text-[#c9d1d9] font-mono">{Math.floor(value).toLocaleString()}</span>
    </div>
  );
}
