import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getPlayerProfile, updateMyDescription, uploadMyAvatar, type PlayerProfile } from "@/features/rankings/api/user";
import { getCurrentUserId } from "@/shared/api/client";
import { useAllianceProfile } from "@/features/alliance/context/AllianceProfileContext";

const DESCRIPTION_MAX = 500;

interface Props {
  userId: string;
  onClose: () => void;
}

export default function PlayerProfileModal({ userId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["user", "profile", userId],
    queryFn: () => getPlayerProfile(userId),
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
          <span className="text-sm tracking-wide text-[#b1bac4]">Player profile</span>
          <button
            onClick={onClose}
            className="text-xs text-[#8b949e] hover:text-[#c9d1d9] border border-[#30363d] rounded px-2 py-0.5"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <div className="text-xs text-[#8b949e]">Loading...</div>}
          {error && <div className="text-xs text-[#f85149]">Failed to load player profile.</div>}
          {data && <ProfileContent p={data} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

function ProfileContent({ p, onClose }: { p: PlayerProfile; onClose: () => void }) {
  const { openAlliance } = useAllianceProfile();
  const navigate = useNavigate();
  const myId = getCurrentUserId();
  const isMe = myId === p.id;

  function goToCity(cityId: string) {
    onClose();
    navigate(`/map?selectCityId=${encodeURIComponent(cityId)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <Avatar userId={p.id} avatarUrl={p.avatarUrl} editable={isMe} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-lg font-semibold text-[#e6b800]">{p.username}</div>
          <div className="text-[11px] text-[#8b949e] mt-0.5">
            {p.alliance ? (
              <>
                {"Alliance: "}
                <button
                  type="button"
                  onClick={() => { onClose(); if (p.alliance) openAlliance(p.alliance.id); }}
                  className="text-[#79c0ff] hover:underline"
                >
                  [{p.alliance.tag}] {p.alliance.name}
                </button>
              </>
            ) : "No alliance"}
          </div>
          {!isMe && (
            <button
              type="button"
              onClick={() => { onClose(); navigate(`/messages?tab=private&peer=${p.id}`); }}
              className="mt-1.5 self-start text-[11px] px-3 py-1 rounded border border-[#58a6ff] bg-[#0c2744] text-[#58a6ff] hover:bg-[#163d6f]"
            >
              Send message
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Rank" value={`#${p.rank} / ${p.totalPlayers}`} color="#e6b800" />
        <Stat label="Total points" value={p.totalPoints.toLocaleString()} color="#e6b800" />
        <Stat label="Cities" value={p.totalCities.toLocaleString()} />
      </div>

      <DescriptionSection
        userId={p.id}
        initial={p.description ?? ""}
        editable={isMe}
      />

      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Cities</div>
        {p.cities.length === 0 ? (
          <div className="text-xs text-[#8b949e]">No cities.</div>
        ) : (
          <div className="border border-[#30363d] rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#0d1117]">
                <tr className="border-b border-[#30363d]">
                  <th className="py-1.5 px-2 text-left text-[#b1bac4] font-medium">#</th>
                  <th className="py-1.5 px-2 text-left text-[#b1bac4] font-medium">City</th>
                  <th className="py-1.5 px-2 text-left text-[#b1bac4] font-medium">Coords</th>
                  <th className="py-1.5 px-2 text-right text-[#b1bac4] font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {p.cities.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => goToCity(c.id)}
                    className="border-b border-[#21262d] last:border-0 cursor-pointer hover:bg-[#1c2129]"
                  >
                    <td className="py-1.5 px-2 text-[#8b949e] font-mono">{i + 1}</td>
                    <td className="py-1.5 px-2 text-[#e6b800] hover:underline">{c.name}</td>
                    <td className="py-1.5 px-2 text-[#8b949e] font-mono">({c.x}, {c.y})</td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#e6b800]">
                      {c.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ userId, avatarUrl, editable }: { userId: string; avatarUrl: string | null; editable: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["user", "profile", userId] });
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
            alt="Avatar"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-[#484f58] font-bold" style={{ fontSize: 96 }}>?</span>
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

function DescriptionSection({ userId, initial, editable }: {
  userId: string;
  initial: string;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setDraft(initial); }, [initial]);

  const save = useMutation({
    mutationFn: () => updateMyDescription(draft.trim().length > 0 ? draft.trim() : null),
    onSuccess: () => {
      setErr(null);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["user", "profile", userId] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  if (!editable) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">Description</div>
        {initial ? (
          <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap bg-[#0d1117] border border-[#30363d] rounded p-2">
            {initial}
          </div>
        ) : (
          <div className="text-xs text-[#8b949e] italic">No description.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-widest text-[#b1bac4]">Description</div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-[#79c0ff] hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, DESCRIPTION_MAX))}
            rows={4}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded p-2 text-xs text-[#c9d1d9] resize-none focus:outline-none focus:border-[#58a6ff]"
            placeholder="Tell other players about yourself..."
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8b949e]">{draft.length} / {DESCRIPTION_MAX}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft(initial); setErr(null); }}
                className="text-[11px] px-2 py-1 border border-[#30363d] rounded text-[#b1bac4] hover:bg-[#1c2129]"
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="text-[11px] px-2 py-1 border border-[#3fb950] rounded text-[#3fb950] hover:bg-[#0e2a14] disabled:opacity-40"
              >
                {save.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
        </div>
      ) : initial ? (
        <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap bg-[#0d1117] border border-[#30363d] rounded p-2">
          {initial}
        </div>
      ) : (
        <div className="text-xs text-[#8b949e] italic">No description.</div>
      )}
    </div>
  );
}
