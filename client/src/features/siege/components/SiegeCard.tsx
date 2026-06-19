import { useNow } from "@/shared/context/TickContext";
import type { SiegeStatus } from "@/features/siege/api/siege";
import UnitIcon from "@/shared/ui/UnitIcon";

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtETA(arrivalAt: string, now: number): string {
  const ms = new Date(arrivalAt).getTime() - now;
  return fmtRemaining(ms);
}

const TYPE_COLOR: Record<string, string> = {
  ATTACK:    "text-[#f85149]",
  SUPPORT:   "text-[#3fb950]",
  RESOURCES: "text-[#79c0ff]",
  SPY:       "text-[#d2a8ff]",
};

// Center modal that takes over the city dashboard when the city is under siege.
// Both attacker and defender (and their alliance members) see this with the same data.
export default function SiegeCard({ status }: { status: SiegeStatus }) {
  const now = useNow();
  if (!status.active || !status.endsAt) return null;
  const remainingMs = new Date(status.endsAt).getTime() - now;

  return (
    // Full-screen backdrop with pointer-events-auto absorbs ALL clicks so the player cannot
    // interact with the (visually blurred) city behind. The modal sits on top.
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0d1117]/40 backdrop-blur-[1px]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-[#0d1117] border-2 border-[#f85149] rounded-lg shadow-2xl w-[min(95vw,640px)] max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3 mb-3">
          <div>
            <div className="text-[#f85149] text-lg font-bold uppercase tracking-wider">Under siege</div>
            <div className="text-[11px] text-[#b1bac4] mt-0.5">
              Besieger: <span className="text-[#c9d1d9] font-semibold">{status.attacker?.username ?? "—"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-[#b1bac4]">Time left</div>
            <div className="font-mono text-[#f85149] text-lg font-bold">{fmtRemaining(remainingMs)}</div>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Defending force in city</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {status.defendingForce.length === 0 ? (
            <div className="text-[12px] text-[#7d8590] italic">No surviving units in the city</div>
          ) : (
            status.defendingForce.map(u => (
              <UnitIcon key={u.name} name={u.name} quantity={u.quantity} />
            ))
          )}
        </div>

        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1.5">Incoming commands</div>
        {status.incomingCommands.length === 0 ? (
          <div className="text-[12px] text-[#7d8590] italic">None inbound</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {status.incomingCommands.map(cmd => (
              <div key={cmd.id} className="bg-[#161b22] border border-[#30363d] rounded px-2.5 py-1.5 flex items-center justify-between gap-3 text-[12px]">
                <div className="min-w-0 flex-1">
                  <span className={`font-semibold ${TYPE_COLOR[cmd.type] ?? "text-[#c9d1d9]"}`}>{cmd.type}</span>
                  <span className="text-[#b1bac4] ml-2">
                    from <span className="text-[#c9d1d9]">{cmd.fromCityName}</span>
                    {cmd.fromOwnerName && (
                      <span className="text-[#7d8590]"> ({cmd.fromOwnerName})</span>
                    )}
                  </span>
                </div>
                <div className="font-mono text-[#e3b341] whitespace-nowrap">{fmtETA(cmd.arrivalAt, now)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-[#30363d] text-[11px] text-[#7d8590]">
          The city cannot be controlled while the siege is active. Recruitment and construction queues
          continue as scheduled. Attack the city to break the siege before the timer expires.
        </div>
      </div>
    </div>
  );
}
