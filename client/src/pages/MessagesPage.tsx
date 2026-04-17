import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUserId } from "../api/client.ts";
import {
  listMessages, postMessage, deleteAllianceMessage,
  type AllianceMessage,
} from "../api/alliance.ts";
import {
  listDirectConversations, listDirectThread, sendDirectMessage, deleteDirectMessage,
  type DirectConversation, type DirectMessage,
} from "../api/message.ts";
import { getMyAlliance } from "../api/alliance.ts";



type Tab = "alliance" | "private";

export default function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "alliance";
  const myId = getCurrentUserId();

  function setTab(t: Tab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm tracking-wide text-[#b1bac4]">Messages</span>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
        >
          Back
        </button>
      </div>

      <div className="flex border-b border-[#30363d] bg-[#0d1117] shrink-0 center self-center mt-1 mb-3">
        {(["alliance", "private"] as const).map(t => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs tracking-wide border-b-2 transition-colors"
              style={{
                borderColor: active ? "#e6b800" : "transparent",
                color: active ? "#e6b800" : "#b1bac4",
                background: active ? "#161b22" : undefined,
              }}
            >
              {t === "alliance" ? "Alliance" : "Private"}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "alliance" ? <AllianceMessages myId={myId} /> : <PrivateMessages myId={myId} />}
      </div>
    </div>
  );
}

// ─── Alliance tab ───────────────────────────────────────────────────────────

function AllianceMessages({ myId }: { myId: string | null }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading, error } = useQuery<AllianceMessage[]>({
    queryKey: ["alliance", "messages"],
    queryFn: listMessages,
    refetchInterval: 3000,
    retry: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const post = useMutation({
    mutationFn: () => postMessage(content),
    onSuccess: () => {
      setContent("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["alliance", "messages"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAllianceMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alliance", "messages"] }),
  });

  if (error) {
    return (
      <div className="p-4 text-xs text-[#8b949e]">
        You need to be in an alliance to see alliance messages.
      </div>
    );
  }


  return (
    <div className="flex max-w-[480px] flex-col h-full p-3 gap-2 ml-auto mr-auto">
      <div className="flex  bg-[#161b22] border border-[#30363d] rounded p-3 overflow-y-auto flex flex-col gap-2">
        {isLoading && <div className="text-xs text-[#8b949e]">Loading messages…</div>}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <div className="text-xs text-[#8b949e]">No messages yet. Start the conversation.</div>
        )}
        {messages?.map(m => {
          const isMine = m.author.id === myId;
          return (
            <div key={m.id} className="group flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className={`text-[11px] font-semibold ${isMine ? "text-[#e85aad]" : "text-[#58a6ff]"}`}>
                  {m.author.username}
                </span>
                <span className="text-[10px] text-[#8b949e]">{new Date(m.createdAt).toLocaleString()}</span>
                {isMine && (
                  <button
                    onClick={() => del.mutate(m.id)}
                    className="ml-1 text-[10px] text-[#8b949e] hover:text-[#f85149] opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="text-xs text-[#c9d1d9] whitespace-pre-wrap break-words">{m.content}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter to send. Shift+Enter for new line"
          rows={2}
          className="flex w-[480px] bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && content.trim()) {
              e.preventDefault();
              post.mutate();
            }
          }}
        />
        {/* <button
          onClick={() => post.mutate()}
          disabled={!content.trim() || post.isPending}
          className="text-xs border border-[#3fb950] text-[#3fb950] rounded px-3 py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
        >
          Send
        </button> */}
      </div>
    </div>
  );
}

// ─── Private tab ────────────────────────────────────────────────────────────

function PrivateMessages({ myId }: { myId: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePeerId = searchParams.get("peer");
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: conversations } = useQuery<DirectConversation[]>({
    queryKey: ["messages", "conversations"],
    queryFn: listDirectConversations,
    refetchInterval: 3000,
  });

  function selectPeer(peerId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (peerId) next.set("peer", peerId);
    else next.delete("peer");
    setSearchParams(next, { replace: true });
  }

  const activePeer = useMemo(() => {
    return conversations?.find(c => c.peer.id === activePeerId)?.peer ?? null;
  }, [conversations, activePeerId]);

  return (
  <div className="flex w-full h-full justify-center">
    <div className="flex h-full max-w-[960px] w-full">

      {/* Left: conversations */}
      <div className="w-72 shrink-0 bg-[#0d1117] border-r border-[#30363d] overflow-y-auto flex flex-col">
        <div className="p-2 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-[#b1bac4]">
            Conversations
          </span>
          <button
            onClick={() => setComposeOpen(true)}
            className="text-[11px] border border-[#30363d] rounded px-2 py-0.5 text-[#3fb950] hover:bg-[#1a3d1a]"
          >
            + New
          </button>
        </div>

        {(conversations?.length ?? 0) === 0 && (
          <div className="p-4 text-[11px] text-[#8b949e]">
            No conversations yet. Click{" "}
            <span className="text-[#3fb950]">+ New</span> to send your first
            message.
          </div>
        )}

        {conversations?.map(c => {
          const isActive = c.peer.id === activePeerId;

          return (
            <button
              key={c.peer.id}
              onClick={() => selectPeer(c.peer.id)}
              className="text-left p-2 border-b border-[#21262d] hover:bg-[#1c2129]"
              style={{ background: isActive ? "#1c2129" : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? "text-[#e6b800]" : "text-[#c9d1d9]"
                  }`}
                >
                  {c.peer.username}
                </span>

                {c.unread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#f85149] text-white text-[10px] font-bold leading-[18px] text-center">
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-[#8b949e] truncate">
                {c.lastFromMe ? "You: " : ""}
                {c.lastContent}
              </div>

              <div className="text-[10px] text-[#6e7681]">
                {new Date(c.lastAt).toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Right: thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePeer ? (
          <Thread peer={activePeer} myId={myId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[11px] text-[#8b949e]">
            Select a conversation or start a new one.
          </div>
        )}
      </div>

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSent={(peerId) => {
            setComposeOpen(false);
            selectPeer(peerId);
          }}
        />
      )}
    </div>
  </div>
);
}

function Thread({ peer, myId }: { peer: { id: string; username: string }; myId: string | null }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading } = useQuery<DirectMessage[]>({
    queryKey: ["messages", "thread", peer.id],
    queryFn: () => listDirectThread(peer.id),
    refetchInterval: 3000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.length]);

  // Cand deschid firul, serverul marcheaza toate ca citite → reimprospatam conversatiile + unread
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
    qc.invalidateQueries({ queryKey: ["messages", "unread"] });
  }, [thread?.length, qc]);

  const send = useMutation({
    mutationFn: () => sendDirectMessage(peer.username, content),
    onSuccess: () => {
      setContent("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["messages", "thread", peer.id] });
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDirectMessage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", "thread", peer.id] });
      qc.invalidateQueries({ queryKey: ["messages", "conversations"] });
    },
  });

return (
  <div className="flex w-full h-screen overflow-hidden justify-center">
    <div className="flex flex-col max-w-[480px] w-full">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-[#b1bac4]">Conversation with</span>
        <span className="text-sm font-semibold text-[#30e24d]">{peer.username}</span>
      </div>

      <div className="flex flex-col w-full bg-[#161b22] border border-[#30363d] rounded p-3 overflow-y-auto gap-2">
        {isLoading && <div className="text-xs text-[#8b949e]">Loading messages…</div>}
        {!isLoading && (thread?.length ?? 0) === 0 && (
          <div className="text-xs text-[#8b949e]">No messages yet. Say hi.</div>
        )}
        {thread?.map(m => {
          const isMine = m.from.id === myId;
          return (
            <div key={m.id} className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div className="flex items-baseline gap-2">
                <span className={`text-[11px] font-semibold ${isMine ? "text-[#e85aad]" : "text-[#58a6ff]"}`}>
                  {isMine ? "You" : m.from.username}
                </span>
                <span className="text-[10px] text-[#8b949e]">{new Date(m.createdAt).toLocaleString()}</span>
                <button
                  onClick={() => del.mutate(m.id)}
                  className="text-[10px] text-[#8b949e] hover:text-[#f85149] opacity-0 group-hover:opacity-100"
                  title="Delete for me"
                >
                  Delete
                </button>
              </div>
              <div
                className={`text-xs whitespace-pre-wrap break-words rounded px-2 py-1 max-w-[75%] ${
                  isMine ? "bg-[#1c2a3a] text-[#c9d1d9]" : "bg-[#0d1117] text-[#c9d1d9] border border-[#30363d]"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="w-full mt-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Enter to send. Shift+Enter for new line`}
          rows={2}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && content.trim()) {
              e.preventDefault();
              send.mutate();
            }
          }}
        />
      </div>
    </div>

    {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
  </div>
);
}

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: (peerId: string) => void }) {
  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => sendDirectMessage(username.trim(), content),
    onSuccess: (msg) => onSent(msg.to.id),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded shadow-2xl w-full max-w-md p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#e6b800] font-semibold">New message</span>
          <button onClick={onClose} className="text-xs text-[#8b949e] hover:text-[#c9d1d9]">Close</button>
        </div>
        <label className="text-[11px] text-[#b1bac4]">Recipient username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. player42"
          className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
        />
        <label className="text-[11px] text-[#b1bac4]">Message</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Write your message…"
          className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
        />
        {err && <div className="text-[11px] text-[#f85149]">{err}</div>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs border border-[#30363d] text-[#b1bac4] rounded px-3 py-1 hover:bg-[#1c2129]"
          >
            Cancel
          </button>
          <button
            onClick={() => send.mutate()}
            disabled={!username.trim() || !content.trim() || send.isPending}
            className="text-xs border border-[#3fb950] text-[#3fb950] rounded px-3 py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
