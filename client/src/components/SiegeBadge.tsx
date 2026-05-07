import { useNow } from "../context/TickContext";
import type { SiegeStatus } from "../api/siege";

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

export default function SiegeBadge({ status }: { status: SiegeStatus | undefined }) {
  const now = useNow();
  if (!status || !status.active || !status.endsAt) {
    return (
      <span className="text-[10px] uppercase tracking-widest">
        Siege: <span className="font-semibold text-[#3fb950]">None</span>
      </span>
    );
  }
  const remaining = new Date(status.endsAt).getTime() - now;
  return (
    <span className="text-[10px] uppercase tracking-widest">
      Siege: <span className="font-semibold text-[#f85149]">{fmtRemaining(remaining)} left</span>
    </span>
  );
}
