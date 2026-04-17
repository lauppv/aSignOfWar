import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getRankings, getAllianceRankings,
  type RankingEntry, type AllianceRankingEntry,
} from "../api/ranking.ts";
import { getCurrentUserId } from "../api/client.ts";
import { useAllianceProfile } from "../context/AllianceProfileContext.tsx";

type MainTab = "alliances" | "players" | "defeatedAlliance" | "defeatedPlayer";
type KillCategory = "attacker" | "defender" | "supporter" | "total";

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: "alliances",        label: "Alliances" },
  { key: "players",          label: "Players" },
  { key: "defeatedAlliance", label: "Defeated enemies (alliance)" },
  { key: "defeatedPlayer",   label: "Defeated enemies (player)" },
];

const KILL_TABS: { key: KillCategory; label: string }[] = [
  { key: "attacker",  label: "As aggressor" },
  { key: "defender",  label: "As defender" },
  { key: "supporter", label: "As supporter" },
  { key: "total",     label: "Total" },
];

function playerKills(r: RankingEntry, cat: KillCategory): number {
  switch (cat) {
    case "attacker":  return r.killsAsAttacker;
    case "defender":  return r.killsAsDefender;
    case "supporter": return r.killsAsSupporter;
    case "total":     return r.totalKills;
  }
}

function allianceKills(r: AllianceRankingEntry, cat: KillCategory): number {
  switch (cat) {
    case "attacker":  return r.killsAsAttacker;
    case "defender":  return r.killsAsDefender;
    case "supporter": return r.killsAsSupporter;
    case "total":     return r.totalKills;
  }
}

export default function RankingsPage() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("players");
  const [killCat, setKillCat] = useState<KillCategory>("total");
  const myId = getCurrentUserId();

  const players = useQuery({
    queryKey: ["rankings", "players"],
    queryFn: getRankings,
    refetchInterval: 30000,
  });

  const alliances = useQuery({
    queryKey: ["rankings", "alliances"],
    queryFn: getAllianceRankings,
    refetchInterval: 30000,
  });

  const loading = players.isLoading || alliances.isLoading;
  const error   = players.error || alliances.error;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-[#b1bac4]">Loading rankings...</div>;
  }
  if (error || !players.data || !alliances.data) {
    return <div className="flex items-center justify-center h-full text-[#f85149]">Failed to load rankings</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm tracking-wide text-[#b1bac4]">Rankings</span>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          ← Back
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex border-b border-[#30363d] bg-[#0d1117] shrink-0 overflow-x-auto">
        {MAIN_TABS.map(t => {
          const active = mainTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              className="px-4 py-2 text-xs tracking-wide whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderColor: active ? "#e6b800" : "transparent",
                color: active ? "#e6b800" : "#b1bac4",
                background: active ? "#161b22" : undefined,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {mainTab === "players"          && <PlayersTable rows={players.data} myId={myId} />}
        {mainTab === "alliances"        && <AlliancesTable rows={alliances.data} />}
        {mainTab === "defeatedPlayer"   && (
          <>
            <SubTabs value={killCat} onChange={setKillCat} />
            <DefeatedPlayerTable rows={players.data} myId={myId} cat={killCat} />
          </>
        )}
        {mainTab === "defeatedAlliance" && (
          <>
            <SubTabs value={killCat} onChange={setKillCat} />
            <DefeatedAllianceTable rows={alliances.data} cat={killCat} />
          </>
        )}
      </div>
    </div>
  );
}

function SubTabs({ value, onChange }: { value: KillCategory; onChange: (v: KillCategory) => void }) {
  return (
    <div className="flex border-b border-[#30363d] bg-[#0d1117] shrink-0 overflow-x-auto">
      {KILL_TABS.map(t => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="px-3 py-1.5 text-[11px] tracking-wide whitespace-nowrap border-b-2"
            style={{
              borderColor: active ? "#58a6ff" : "transparent",
              color: active ? "#58a6ff" : "#b1bac4",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Players ────────────────────────────────────────────────────────────────────
function PlayersTable({ rows, myId }: { rows: RankingEntry[]; myId: string | null }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-[#161b22] z-10">
        <tr className="border-b border-[#30363d]">
          <Th className="w-10 text-left">Rank</Th>
          <Th className="text-left">Name</Th>
          <Th className="text-left">Alliance</Th>
          <Th className="text-right">Points</Th>
          <Th className="text-right">Cities</Th>
          <Th className="text-right">Points / city</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => {
          const isMe = r.id === myId;
          const ppc = r.cities > 0 ? Math.round(r.points / r.cities) : 0;
          return (
            <tr key={r.id} className="border-b border-[#21262d] hover:bg-[#1c2129]"
                style={{ background: isMe ? "rgba(232,90,173,0.08)" : undefined }}>
              <Td mono muted>{i + 1}</Td>
              <Td>
                <span className={isMe ? "text-[#e85aad] font-semibold" : "text-[#c9d1d9]"}>{r.username}</span>
                {isMe && <span className="ml-1.5 text-[10px] text-[#e85aad] tracking-wide">(you)</span>}
              </Td>
              <Td><AllianceTag alliance={r.alliance} /></Td>
              <Td mono right className="text-[#e6b800]">{r.points.toLocaleString()}</Td>
              <Td mono right>{r.cities}</Td>
              <Td mono right>{ppc.toLocaleString()}</Td>
            </tr>
          );
        })}
        {sorted.length === 0 && <EmptyRow cols={6} />}
      </tbody>
    </table>
  );
}

// ─── Alliances ──────────────────────────────────────────────────────────────────
function AlliancesTable({ rows }: { rows: AllianceRankingEntry[] }) {
  const { openAlliance } = useAllianceProfile();
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-[#161b22] z-10">
        <tr className="border-b border-[#30363d]">
          <Th className="w-10 text-left">Rank</Th>
          <Th className="text-left">Alliance</Th>
          <Th className="text-right">Total points</Th>
          <Th className="text-right">Members</Th>
          <Th className="text-right">Points / member</Th>
          <Th className="text-right">Cities</Th>
          <Th className="text-right">Points / city</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.id} className="border-b border-[#21262d] hover:bg-[#1c2129]">
            <Td mono muted>{i + 1}</Td>
            <Td>
              <button
                type="button"
                onClick={() => openAlliance(r.id)}
                className="text-left hover:underline"
              >
                <span className="text-[#e6b800] font-semibold">[{r.tag}]</span>{" "}
                <span className="text-[#c9d1d9]">{r.name}</span>
              </button>
            </Td>
            <Td mono right className="text-[#e6b800]">{r.points.toLocaleString()}</Td>
            <Td mono right>{r.memberCount}</Td>
            <Td mono right>{r.pointsPerMember.toLocaleString()}</Td>
            <Td mono right>{r.cities}</Td>
            <Td mono right>{r.pointsPerCity.toLocaleString()}</Td>
          </tr>
        ))}
        {sorted.length === 0 && <EmptyRow cols={7} text="No alliances yet" />}
      </tbody>
    </table>
  );
}

// ─── Defeated enemies (player) ──────────────────────────────────────────────────
function DefeatedPlayerTable({ rows, myId, cat }: { rows: RankingEntry[]; myId: string | null; cat: KillCategory }) {
  const sorted = [...rows].sort((a, b) => playerKills(b, cat) - playerKills(a, cat));
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-[#161b22] z-10">
        <tr className="border-b border-[#30363d]">
          <Th className="w-10 text-left">Rank</Th>
          <Th className="text-left">Name</Th>
          <Th className="text-left">Alliance</Th>
          <Th className="text-right">Defeats</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => {
          const isMe = r.id === myId;
          return (
            <tr key={r.id} className="border-b border-[#21262d] hover:bg-[#1c2129]"
                style={{ background: isMe ? "rgba(232,90,173,0.08)" : undefined }}>
              <Td mono muted>{i + 1}</Td>
              <Td>
                <span className={isMe ? "text-[#e85aad] font-semibold" : "text-[#c9d1d9]"}>{r.username}</span>
                {isMe && <span className="ml-1.5 text-[10px] text-[#e85aad] tracking-wide">(you)</span>}
              </Td>
              <Td><AllianceTag alliance={r.alliance} /></Td>
              <Td mono right className="text-[#f85149]">{playerKills(r, cat).toLocaleString()}</Td>
            </tr>
          );
        })}
        {sorted.length === 0 && <EmptyRow cols={4} />}
      </tbody>
    </table>
  );
}

// ─── Defeated enemies (alliance) ────────────────────────────────────────────────
function DefeatedAllianceTable({ rows, cat }: { rows: AllianceRankingEntry[]; cat: KillCategory }) {
  const sorted = [...rows].sort((a, b) => allianceKills(b, cat) - allianceKills(a, cat));
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-[#161b22] z-10">
        <tr className="border-b border-[#30363d]">
          <Th className="w-10 text-left">Rank</Th>
          <Th className="text-left">Alliance</Th>
          <Th className="text-right">Defeats</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.id} className="border-b border-[#21262d] hover:bg-[#1c2129]">
            <Td mono muted>{i + 1}</Td>
            <Td>
              <span className="text-[#e6b800] font-semibold">[{r.tag}]</span>{" "}
              <span className="text-[#c9d1d9]">{r.name}</span>
            </Td>
            <Td mono right className="text-[#f85149]">{allianceKills(r, cat).toLocaleString()}</Td>
          </tr>
        ))}
        {sorted.length === 0 && <EmptyRow cols={3} text="No alliances yet" />}
      </tbody>
    </table>
  );
}

// ─── Small primitives ───────────────────────────────────────────────────────────
function AllianceTag({ alliance }: { alliance: { id: string; tag: string; name: string } | null }) {
  const { openAlliance } = useAllianceProfile();
  if (!alliance) return <span className="text-[#8b949e]">—</span>;
  return (
    <button
      type="button"
      onClick={() => openAlliance(alliance.id)}
      title={alliance.name}
      className="text-left hover:underline"
    >
      <span className="text-[#e6b800] font-semibold">[{alliance.tag}]</span>{" "}
      <span className="text-[#c9d1d9]">{alliance.name}</span>
    </button>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 px-3 text-[#b1bac4] font-medium whitespace-nowrap ${className}`}>{children}</th>;
}

function Td({ children, mono, muted, right, className = "" }: {
  children: React.ReactNode; mono?: boolean; muted?: boolean; right?: boolean; className?: string;
}) {
  return (
    <td className={[
      "py-2 px-3",
      mono ? "font-mono" : "",
      right ? "text-right" : "",
      muted ? "text-[#8b949e]" : "",
      className,
    ].filter(Boolean).join(" ")}>
      {children}
    </td>
  );
}

function EmptyRow({ cols, text = "No entries yet" }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center text-[#8b949e] py-8">{text}</td>
    </tr>
  );
}
