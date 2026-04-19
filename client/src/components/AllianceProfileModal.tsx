import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllianceProfile, uploadAllianceAvatar, type AllianceProfile } from "../api/alliance.ts";
import { getCurrentUserId } from "../api/client.ts";
import { usePlayerProfile } from "../context/PlayerProfileContext.tsx";

const ACCESS_LABEL: Record<AllianceProfile["accessMode"], string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  INVITE_ONLY: "Invite only",
  APPLICATION: "Application",
};
const ACCESS_COLOR: Record<AllianceProfile["accessMode"], string> = {
  OPEN: "#3fb950",
  CLOSED: "#8b949e",
  INVITE_ONLY: "#58a6ff",
  APPLICATION: "#d29922",
};

interface Props {
  allianceId: string;
  onClose: () => void;
}

export default function AllianceProfileModal({ allianceId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["alliance", "profile", allianceId],
    queryFn: () => getAllianceProfile(allianceId),
    retry: false,
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] shrink-0">
          <span className="text-sm tracking-wide text-[#b1bac4]">Alliance profile</span>
          <button
            onClick={onClose}
            className="text-xs text-[#8b949e] hover:text-[#c9d1d9] border border-[#30363d] rounded px-2 py-0.5"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <div className="text-xs text-[#8b949e]">Loading...</div>}
          {error && <div className="text-xs text-[#f85149]">Failed to load alliance profile.</div>}
          {data && <ProfileContent p={data} />}
        </div>
      </div>
    </div>
  );
}

function ProfileContent({ p }: { p: AllianceProfile }) {
  const { openPlayer } = usePlayerProfile();
  const myId = getCurrentUserId();
  const isLeader = myId === p.leader.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <AllianceAvatar allianceId={p.id} avatarUrl={p.avatarUrl} editable={isLeader} />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-[#e6b800]">
            [{p.tag}] {p.name}
          </div>
          <div className="text-[11px] text-[#8b949e] mt-0.5">
            Leader:{" "}
            <button
              type="button"
              onClick={() => openPlayer(p.leader.id)}
              className="hover:underline text-[#79c0ff]"
            >
              {p.leader.username}
            </button>{" "}&middot;{" "}
            <span style={{ color: ACCESS_COLOR[p.accessMode] }}>{ACCESS_LABEL[p.accessMode]}</span>{" "}
            &middot; Founded {new Date(p.createdAt).toLocaleDateString()}
          </div>
          {p.description && (
            <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap mt-2">{p.description}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Rank" value={`#${p.rank} / ${p.totalAlliances}`} color="#e6b800" />
        <Stat label="Total points" value={p.points.toLocaleString()} color="#e6b800" />
        <Stat label="Members" value={p.memberCount.toLocaleString()} />
        <Stat label="Cities" value={p.cities.toLocaleString()} />
        <Stat label="Points / member" value={p.pointsPerMember.toLocaleString()} />
        <Stat label="Points / city" value={p.pointsPerCity.toLocaleString()} />
        <Stat label="Total defeats" value={p.totalKills.toLocaleString()} color="#f85149" />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Members</div>
        <div className="border border-[#30363d] rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#0d1117]">
              <tr className="border-b border-[#30363d]">
                <th className="py-1.5 px-2 text-left text-[#b1bac4] font-medium">#</th>
                <th className="py-1.5 px-2 text-left text-[#b1bac4] font-medium">Player</th>
                <th className="py-1.5 px-2 text-right text-[#b1bac4] font-medium">Points</th>
                <th className="py-1.5 px-2 text-right text-[#b1bac4] font-medium">Cities</th>
                <th className="py-1.5 px-2 text-right text-[#b1bac4] font-medium">Defeats</th>
              </tr>
            </thead>
            <tbody>
              {p.members.map((m, i) => (
                <tr key={m.id} className="border-b border-[#21262d] last:border-0">
                  <td className="py-1.5 px-2 text-[#8b949e] font-mono">{i + 1}</td>
                  <td className="py-1.5 px-2 text-[#c9d1d9]">
                    <button
                      type="button"
                      onClick={() => openPlayer(m.id)}
                      className="hover:underline text-[#79c0ff]"
                    >
                      {m.username}
                    </button>
                    {m.id === p.leader.id && (
                      <span className="ml-1.5 text-[10px] text-[#e6b800]">(leader)</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[#e6b800]">
                    {m.points.toLocaleString()}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">{m.cities}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-[#f85149]">
                    {m.totalKills.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AllianceAvatar({ allianceId, avatarUrl, editable }: { allianceId: string; avatarUrl: string | null; editable: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadAllianceAvatar(allianceId, file),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["alliance", "profile", allianceId] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    upload.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      <div
        className="bg-[#0d1117] border border-[#30363d] rounded overflow-hidden flex items-center justify-center"
        style={{ width: 240, height: 180 }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Alliance avatar"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-[#484f58] font-bold" style={{ fontSize: 64 }}>?</span>
        )}
      </div>
      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="text-[11px] text-[#79c0ff] hover:underline disabled:opacity-40"
          >
            {upload.isPending ? "Uploading..." : "Change avatar"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFile}
            className="hidden"
          />
          {err && <div className="text-[10px] text-[#f85149]">{err}</div>}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-[#8b949e]">{label}</div>
      <div className="text-sm font-mono mt-0.5" style={{ color: color ?? "#c9d1d9" }}>
        {value}
      </div>
    </div>
  );
}
