import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getRankings, type RankingEntry } from "../api/ranking.ts";
import { getCurrentUserId } from "../api/client.ts";

type SortKey = "points" | "cities" | "totalKills" | "killsAsAttacker" | "killsAsDefender" | "killsAsSupporter" | "totalLooted";

const COLUMNS: { key: SortKey; label: string; short?: string }[] = [
  { key: "points",           label: "Points" },
  { key: "cities",           label: "Cities" },
  { key: "totalKills",       label: "Total kills",           short: "Total" },
  { key: "killsAsAttacker",  label: "Kills as Attacker",     short: "As Attacker" },
  { key: "killsAsDefender",  label: "Kills as Defender",     short: "As Defender" },
  { key: "killsAsSupporter", label: "Kills as Supporter",    short: "As Supporter" },
  { key: "totalLooted",      label: "Resources looted",      short: "Looted" },
];

export default function RankingsPage() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortKey>("points");
  const myId = getCurrentUserId();

  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ["rankings"],
    queryFn: getRankings,
    refetchInterval: 30000,
  });

  function sorted(rows: RankingEntry[]): RankingEntry[] {
    return [...rows].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-[#b1bac4]">Loading rankings...</div>;
  }
  if (error || !rankings) {
    return <div className="flex items-center justify-center h-screen text-[#f85149]">Failed to load rankings</div>;
  }

  const rows = sorted(rankings);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm uppercase tracking-widest text-[#b1bac4]">Rankings</span>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          ← Back
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[#161b22] z-10">
            <tr className="border-b border-[#30363d]">
              <th className="py-2 px-3 text-left text-[#b1bac4] font-medium w-10">#</th>
              <th className="py-2 px-3 text-left text-[#b1bac4] font-medium">Player</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => setSortBy(col.key)}
                  className="py-2 px-3 text-right text-[#b1bac4] font-medium cursor-pointer hover:text-[#c9d1d9] select-none whitespace-nowrap"
                >
                  {col.short ?? col.label}
                  {sortBy === col.key && <span className="ml-1 text-[#e6b800]">▼</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.id === myId;
              return (
                <tr
                  key={r.id}
                  className="border-b border-[#21262d] hover:bg-[#1c2129]"
                  style={{
                    background: isMe ? "rgba(232,90,173,0.08)" : undefined,
                  }}
                >
                  <td className="py-2 px-3 font-mono text-[#7d8590]">{i + 1}</td>
                  <td className="py-2 px-3">
                    <span className={isMe ? "text-[#e85aad] font-semibold" : "text-[#c9d1d9]"}>
                      {r.username}
                    </span>
                    {isMe && <span className="ml-1.5 text-[9px] text-[#e85aad] uppercase tracking-widest">(you)</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[#e6b800]">{r.points.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.cities}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.totalKills.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#f85149]">{r.killsAsAttacker.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#3fb950]">{r.killsAsDefender.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#58a6ff]">{r.killsAsSupporter.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#d29922]">{r.totalLooted.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="text-center text-[#7d8590] mt-8">No players yet</div>
        )}
      </div>
    </div>
  );
}
