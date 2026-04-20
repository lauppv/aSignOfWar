import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listAlliances, getMyAlliance, createAlliance, joinAlliance, leaveAlliance,
  disbandAlliance, updateAlliance, kickMember, transferLeadership,
  inviteByUsername, listAllianceInvitations, cancelInvitation,
  listMyInvitations, acceptInvitation, rejectInvitation,
  submitApplication, getMyApplication, cancelMyApplication,
  listAllianceApplications, acceptApplication, rejectApplication,
  type AllianceDetail, type AllianceSummary, type AllianceAccess,
} from "../api/alliance.ts";
import { getCurrentUserId } from "../api/client.ts";
import { useAllianceProfile } from "../context/AllianceProfileContext.tsx";
import { usePlayerProfile } from "../context/PlayerProfileContext.tsx";
import { ACCESS_LABEL, ACCESS_COLOR } from "../lib/labels.ts";

export default function AlliancePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const myId = getCurrentUserId();

  const myQuery = useQuery({
    queryKey: ["alliance", "me"],
    queryFn: getMyAlliance,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["alliance"] });
    qc.invalidateQueries({ queryKey: ["rankings"] });
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm tracking-wide text-[#b1bac4]">Alliance</span>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {myQuery.isLoading && <div className="p-4 text-[#b1bac4]">Loading…</div>}
        {myQuery.error && <div className="p-4 text-[#f85149]">Failed to load alliance</div>}
        {!myQuery.isLoading && !myQuery.error && (
          myQuery.data
            ? <InAllianceView alliance={myQuery.data} myId={myId} onChanged={invalidateAll} />
            : <NoAllianceView onChanged={invalidateAll} />
        )}
      </div>
    </div>
  );
}

// ═══ IN AN ALLIANCE ═════════════════════════════════════════════════════════════
type MemberTab = "overview" | "members" | "settings" | "invitations" | "applications";

function InAllianceView({ alliance, myId, onChanged }: {
  alliance: AllianceDetail; myId: string | null; onChanged: () => void;
}) {
  const isLeader = alliance.leader.id === myId;
  const [tab, setTab] = useState<MemberTab>("overview");

  const TABS: { key: MemberTab; label: string; leaderOnly?: boolean }[] = [
    { key: "overview",     label: "Overview" },
    { key: "members",      label: "Members" },
    { key: "invitations",  label: "Invitations",  leaderOnly: true },
    { key: "applications", label: "Applications", leaderOnly: true },
    { key: "settings",     label: "Settings",     leaderOnly: true },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-[#30363d] bg-[#0d1117] shrink-0 overflow-x-auto">
        {TABS.filter(t => !t.leaderOnly || isLeader).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 text-xs tracking-wide whitespace-nowrap border-b-2"
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

      <div className="p-4 max-w-3xl w-full">
        {tab === "overview"     && <OverviewTab alliance={alliance} isLeader={isLeader} onChanged={onChanged} />}
        {tab === "members"      && <MembersTab alliance={alliance} myId={myId} isLeader={isLeader} onChanged={onChanged} />}
        {tab === "invitations"  && isLeader && <InvitationsTab onChanged={onChanged} />}
        {tab === "applications" && isLeader && <ApplicationsTab onChanged={onChanged} />}
        {tab === "settings"     && isLeader && <SettingsTab alliance={alliance} onChanged={onChanged} />}
      </div>
    </div>
  );
}

function OverviewTab({ alliance, isLeader, onChanged }: {
  alliance: AllianceDetail; isLeader: boolean; onChanged: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const soloLeader = isLeader && alliance.members.length === 1;

  const leave = useMutation({
    mutationFn: leaveAlliance,
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });
  const disband = useMutation({
    mutationFn: disbandAlliance,
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#e6b800]">[{alliance.tag}] {alliance.name}</div>
            <div className="text-[11px] text-[#8b949e]">
              Leader: {alliance.leader.username} ·{" "}
              <span style={{ color: ACCESS_COLOR[alliance.accessMode] }}>
                {ACCESS_LABEL[alliance.accessMode]}
              </span>
            </div>
          </div>
        </div>
        {alliance.description && (
          <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap">{alliance.description}</div>
        )}
      </div>

      {err && <div className="text-xs text-[#f85149]">{err}</div>}

      <div className="flex gap-2">
        {!isLeader && (
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="text-xs border border-[#f85149] text-[#f85149] rounded px-3 py-1.5 hover:bg-[#3d1a1a] disabled:opacity-40"
          >
            Leave alliance
          </button>
        )}
        {isLeader && soloLeader && (
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="text-xs border border-[#f85149] text-[#f85149] rounded px-3 py-1.5 hover:bg-[#3d1a1a] disabled:opacity-40"
          >
            Leave &amp; disband
          </button>
        )}
        {isLeader && !soloLeader && (
          <button
            onClick={() => {
              if (confirm("Disband the alliance? All members will be removed.")) disband.mutate();
            }}
            disabled={disband.isPending}
            className="text-xs border border-[#f85149] text-[#f85149] rounded px-3 py-1.5 hover:bg-[#3d1a1a] disabled:opacity-40"
          >
            Disband alliance
          </button>
        )}
      </div>
    </div>
  );
}

function MembersTab({ alliance, myId, isLeader, onChanged }: {
  alliance: AllianceDetail; myId: string | null; isLeader: boolean; onChanged: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const { openPlayer } = usePlayerProfile();
  const kick = useMutation({
    mutationFn: kickMember,
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });
  const transfer = useMutation({
    mutationFn: transferLeadership,
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
      <div className="text-xs text-[#b1bac4] mb-2">Members ({alliance.members.length})</div>
      <div className="flex flex-col divide-y divide-[#21262d]">
        {alliance.members.map(m => {
          const isMe = m.id === myId;
          const isLeaderMember = m.id === alliance.leader.id;
          return (
            <div key={m.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPlayer(m.id)}
                  className={`hover:underline ${isMe ? "text-[#e85aad] font-semibold" : "text-[#c9d1d9]"}`}
                >
                  {m.username}
                </button>
                {isLeaderMember && <span className="text-[10px] text-[#e6b800]">leader</span>}
                {isMe && !isLeaderMember && <span className="text-[10px] text-[#8b949e]">member</span>}
                {isMe && <span className="text-[10px] text-[#e85aad]">(you)</span>}
              </span>
              {isLeader && !isLeaderMember && (
                <span className="flex gap-1">
                  <button
                    onClick={() => transfer.mutate(m.id)}
                    disabled={transfer.isPending}
                    className="text-[10px] border border-[#e6b800] text-[#e6b800] rounded px-1.5 py-0.5 hover:bg-[#2e2710] disabled:opacity-40"
                  >
                    Transfer leadership
                  </button>
                  <button
                    onClick={() => kick.mutate(m.id)}
                    disabled={kick.isPending}
                    className="text-[10px] border border-[#f85149] text-[#f85149] rounded px-1.5 py-0.5 hover:bg-[#3d1a1a] disabled:opacity-40"
                  >
                    Kick
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {err && <div className="mt-2 text-[11px] text-[#f85149]">{err}</div>}
    </div>
  );
}

// Alliance messages au fost mutate in pagina dedicata /messages (tab Alliance).

function InvitationsTab({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["alliance", "invitations", "leader"],
    queryFn: listAllianceInvitations,
  });

  const invite = useMutation({
    mutationFn: () => inviteByUsername(username.trim()),
    onSuccess: () => {
      setUsername("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["alliance", "invitations", "leader"] });
      onChanged();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const cancel = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alliance", "invitations", "leader"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#161b22] border border-[#30363d] rounded p-4 flex flex-col gap-2">
        <div className="text-xs text-[#b1bac4]">Invite a player</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
          <button
            onClick={() => invite.mutate()}
            disabled={!username.trim() || invite.isPending}
            className="text-xs border border-[#58a6ff] text-[#58a6ff] rounded px-3 py-1 hover:bg-[#0c2744] disabled:opacity-40"
          >
            Invite
          </button>
        </div>
        {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
        <div className="text-xs text-[#b1bac4] mb-2">Pending invitations ({invites?.length ?? 0})</div>
        {isLoading ? (
          <div className="text-[11px] text-[#8b949e]">Loading…</div>
        ) : (invites?.length ?? 0) === 0 ? (
          <div className="text-[11px] text-[#8b949e]">No pending invitations.</div>
        ) : (
          <div className="flex flex-col divide-y divide-[#21262d]">
            {invites!.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-[#c9d1d9]">{inv.user.username}</span>
                <button
                  onClick={() => cancel.mutate(inv.id)}
                  disabled={cancel.isPending}
                  className="text-[10px] border border-[#f85149] text-[#f85149] rounded px-1.5 py-0.5 hover:bg-[#3d1a1a] disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationsTab({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const { data: apps, isLoading } = useQuery({
    queryKey: ["alliance", "applications"],
    queryFn: listAllianceApplications,
    refetchInterval: 15000,
  });

  const accept = useMutation({
    mutationFn: acceptApplication,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alliance", "applications"] });
      onChanged();
    },
    onError: (e: Error) => setErr(e.message),
  });
  const reject = useMutation({
    mutationFn: rejectApplication,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alliance", "applications"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
      <div className="text-xs text-[#b1bac4] mb-2">Applications ({apps?.length ?? 0})</div>
      {err && <div className="text-[11px] text-[#f85149] mb-2">{err}</div>}
      {isLoading ? (
        <div className="text-[11px] text-[#8b949e]">Loading…</div>
      ) : (apps?.length ?? 0) === 0 ? (
        <div className="text-[11px] text-[#8b949e]">No pending applications.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {apps!.map(a => (
            <div key={a.id} className="border border-[#30363d] rounded p-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#c9d1d9] font-semibold">{a.user.username}</span>
                <span className="text-[10px] text-[#8b949e]">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap">{a.message}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => accept.mutate(a.id)}
                  disabled={accept.isPending}
                  className="text-[10px] border border-[#3fb950] text-[#3fb950] rounded px-2 py-0.5 hover:bg-[#1a3d1a] disabled:opacity-40"
                >
                  Accept
                </button>
                <button
                  onClick={() => reject.mutate(a.id)}
                  disabled={reject.isPending}
                  className="text-[10px] border border-[#f85149] text-[#f85149] rounded px-2 py-0.5 hover:bg-[#3d1a1a] disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ alliance, onChanged }: { alliance: AllianceDetail; onChanged: () => void }) {
  const [name, setName] = useState(alliance.name);
  const [tag, setTag] = useState(alliance.tag);
  const [description, setDescription] = useState(alliance.description ?? "");
  const [accessMode, setAccessMode] = useState<AllianceAccess>(alliance.accessMode);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => updateAlliance({
      name,
      tag,
      description: description.trim() ? description : null,
      accessMode,
    }),
    onSuccess: () => {
      setErr(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onChanged();
    },
    onError: (e: Error) => { setSaved(false); setErr(e.message); },
  });

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded p-4 flex flex-col gap-3">
      <Field label="Name" value={name} onChange={setName} />
      <Field label="Tag" value={tag} onChange={(v) => setTag(v.toUpperCase())} />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-[#b1bac4]">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-[#b1bac4]">Access mode</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCESS_LABEL) as AllianceAccess[]).map(m => {
            const active = accessMode === m;
            return (
              <button
                key={m}
                onClick={() => setAccessMode(m)}
                className="text-[11px] border rounded px-2 py-1"
                style={{
                  borderColor: active ? ACCESS_COLOR[m] : "#30363d",
                  color: active ? ACCESS_COLOR[m] : "#b1bac4",
                  background: active ? "#0d1117" : undefined,
                }}
              >
                {ACCESS_LABEL[m]}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-[#8b949e] mt-1">
          {accessMode === "OPEN"        && "Any player can join without approval."}
          {accessMode === "CLOSED"      && "No one can join. Invitations still work."}
          {accessMode === "INVITE_ONLY" && "Only invited players can join."}
          {accessMode === "APPLICATION" && "Players must send an application that the leader reviews."}
        </span>
      </div>
      {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
      {saved && <div className="text-[11px] text-[#3fb950]">Saved.</div>}
      <div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="text-xs border border-[#3fb950] text-[#3fb950] rounded px-3 py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

// ═══ NOT IN AN ALLIANCE ═════════════════════════════════════════════════════════
function NoAllianceView({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const { openAlliance } = useAllianceProfile();
  const [mode, setMode] = useState<"none" | "create">("none");

  const { data: alliances, isLoading } = useQuery({
    queryKey: ["alliance", "list"],
    queryFn: listAlliances,
  });
  const { data: myInvites } = useQuery({
    queryKey: ["alliance", "me", "invitations"],
    queryFn: listMyInvitations,
  });
  const { data: myApp } = useQuery({
    queryKey: ["alliance", "me", "application"],
    queryFn: getMyApplication,
  });

  function refresh() {
    onChanged();
    qc.invalidateQueries({ queryKey: ["alliance", "me"] });
    qc.invalidateQueries({ queryKey: ["alliance", "list"] });
  }

  return (
    <div className="p-4 max-w-3xl flex flex-col gap-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded p-4 flex flex-col gap-2">
        <div className="text-sm text-[#c9d1d9]">You are not in an alliance.</div>
        {mode === "none" ? (
          <div className="flex gap-2">
            <button
              onClick={() => setMode("create")}
              className="text-xs border border-[#e6b800] text-[#e6b800] rounded px-3 py-1.5 hover:bg-[#2e2710]"
            >
              Create alliance
            </button>
          </div>
        ) : (
          <CreateAllianceForm onCancel={() => setMode("none")} onCreated={refresh} />
        )}
      </div>

      {(myInvites?.length ?? 0) > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
          <div className="text-xs text-[#b1bac4] mb-2">Pending invitations</div>
          <div className="flex flex-col divide-y divide-[#21262d]">
            {myInvites!.map(inv => <InviteRow key={inv.id} inv={inv} onChanged={refresh} />)}
          </div>
        </div>
      )}

      {myApp && (
        <div className="bg-[#161b22] border border-[#30363d] rounded p-4 flex flex-col gap-2">
          <div className="text-xs text-[#b1bac4]">Your pending application</div>
          <div className="text-xs">
            To{" "}
            <button
              type="button"
              onClick={() => openAlliance(myApp.alliance.id)}
              className="hover:underline"
            >
              <span className="text-[#e6b800] font-semibold">[{myApp.alliance.tag}]</span>{" "}
              <span className="text-[#c9d1d9]">{myApp.alliance.name}</span>
            </button>
          </div>
          <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap border border-[#30363d] rounded p-2 bg-[#0d1117]">
            {myApp.message}
          </div>
          <div>
            <CancelMyAppButton onDone={refresh} />
          </div>
        </div>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded p-4">
        <div className="text-xs text-[#b1bac4] mb-2">Browse alliances</div>
        {isLoading ? (
          <div className="text-xs text-[#b1bac4]">Loading…</div>
        ) : (alliances?.length ?? 0) === 0 ? (
          <div className="text-xs text-[#8b949e]">No alliances yet — be the first to create one.</div>
        ) : (
          <div className="flex flex-col divide-y divide-[#21262d]">
            {alliances!.map(a => (
              <BrowseRow
                key={a.id}
                alliance={a}
                hasApplication={!!myApp}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CancelMyAppButton({ onDone }: { onDone: () => void }) {
  const cancel = useMutation({ mutationFn: cancelMyApplication, onSuccess: onDone });
  return (
    <button
      onClick={() => cancel.mutate()}
      disabled={cancel.isPending}
      className="text-[11px] border border-[#f85149] text-[#f85149] rounded px-2 py-1 hover:bg-[#3d1a1a] disabled:opacity-40"
    >
      Cancel application
    </button>
  );
}

function InviteRow({ inv, onChanged }: {
  inv: { id: string; alliance: { id: string; tag: string; name: string; accessMode: AllianceAccess } };
  onChanged: () => void;
}) {
  const { openAlliance } = useAllianceProfile();
  const [err, setErr] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: () => acceptInvitation(inv.id),
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });
  const reject = useMutation({
    mutationFn: () => rejectInvitation(inv.id),
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <div className="flex items-center justify-between py-2 text-xs">
      <span>
        <button
          type="button"
          onClick={() => openAlliance(inv.alliance.id)}
          className="hover:underline"
        >
          <span className="text-[#e6b800] font-semibold">[{inv.alliance.tag}]</span>{" "}
          <span className="text-[#c9d1d9]">{inv.alliance.name}</span>
        </button>
        {err && <span className="ml-2 text-[10px] text-[#f85149]">{err}</span>}
      </span>
      <span className="flex gap-1">
        <button
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
          className="text-[10px] border border-[#3fb950] text-[#3fb950] rounded px-2 py-0.5 hover:bg-[#1a3d1a] disabled:opacity-40"
        >
          Accept
        </button>
        <button
          onClick={() => reject.mutate()}
          disabled={reject.isPending}
          className="text-[10px] border border-[#f85149] text-[#f85149] rounded px-2 py-0.5 hover:bg-[#3d1a1a] disabled:opacity-40"
        >
          Decline
        </button>
      </span>
    </div>
  );
}

function BrowseRow({ alliance, hasApplication, onChanged }: {
  alliance: AllianceSummary; hasApplication: boolean; onChanged: () => void;
}) {
  const { openAlliance } = useAllianceProfile();
  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => joinAlliance(alliance.id),
    onSuccess: onChanged,
    onError: (e: Error) => setErr(e.message),
  });
  const apply = useMutation({
    mutationFn: () => submitApplication(alliance.id, message),
    onSuccess: () => { setShowApply(false); setMessage(""); setErr(null); onChanged(); },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => openAlliance(alliance.id)}
            className="text-xs text-left hover:underline"
          >
            <span className="text-[#e6b800] font-semibold">[{alliance.tag}]</span>{" "}
            <span className="text-[#c9d1d9]">{alliance.name}</span>
          </button>
          <span className="text-[10px] text-[#8b949e]">
            Leader: {alliance.leader.username} · {alliance.memberCount} member{alliance.memberCount === 1 ? "" : "s"} ·{" "}
            <span style={{ color: ACCESS_COLOR[alliance.accessMode] }}>
              {ACCESS_LABEL[alliance.accessMode]}
            </span>
          </span>
          {err && <span className="text-[10px] text-[#f85149]">{err}</span>}
        </div>
        <div className="flex gap-1">
          {alliance.accessMode === "OPEN" && (
            <button
              onClick={() => { setErr(null); join.mutate(); }}
              disabled={join.isPending}
              className="text-[11px] border border-[#58a6ff] text-[#58a6ff] rounded px-3 py-1 hover:bg-[#0c2744] disabled:opacity-40"
            >
              Join
            </button>
          )}
          {alliance.accessMode === "APPLICATION" && !hasApplication && (
            <button
              onClick={() => { setErr(null); setShowApply(v => !v); }}
              className="text-[11px] border border-[#d29922] text-[#d29922] rounded px-3 py-1 hover:bg-[#3d2e0a]"
            >
              Apply
            </button>
          )}
          {alliance.accessMode === "APPLICATION" && hasApplication && (
            <span className="text-[10px] text-[#8b949e]">Application pending elsewhere</span>
          )}
          {alliance.accessMode === "INVITE_ONLY" && (
            <span className="text-[10px] text-[#8b949e]">Invite only</span>
          )}
          {alliance.accessMode === "CLOSED" && (
            <span className="text-[10px] text-[#8b949e]">Closed</span>
          )}
        </div>
      </div>
      {showApply && (
        <div className="flex flex-col gap-1 border border-[#30363d] rounded p-2">
          <span className="text-[10px] text-[#b1bac4]">Your application will only be visible to the leader.</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a short message…"
            rows={3}
            className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => apply.mutate()}
              disabled={!message.trim() || apply.isPending}
              className="text-[11px] border border-[#3fb950] text-[#3fb950] rounded px-2 py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
            >
              Send application
            </button>
            <button
              onClick={() => setShowApply(false)}
              className="text-[11px] border border-[#30363d] text-[#b1bac4] rounded px-2 py-1 hover:bg-[#1c2129]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAllianceForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => createAlliance({ name, tag, description: description.trim() || undefined }),
    onSuccess: onCreated,
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Field label="Name (3–32 chars)" value={name} onChange={setName} />
      <Field label="Tag (2–5 chars, A–Z / 0–9)" value={tag} onChange={(v) => setTag(v.toUpperCase())} />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-[#b1bac4]">Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
        />
      </div>
      {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
      <div className="flex gap-2">
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || !name.trim() || !tag.trim()}
          className="text-xs border border-[#3fb950] text-[#3fb950] rounded px-3 py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="text-xs border border-[#30363d] text-[#b1bac4] rounded px-3 py-1 hover:bg-[#1c2129]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[#b1bac4]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
      />
    </div>
  );
}
