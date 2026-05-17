import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, LogOut, ChevronDown, ChevronRight, X, ToggleLeft, ToggleRight, MessageSquare, Plus } from "lucide-react";
import { useAuth, authHeaders } from "../context/AuthContext";
import { TopNav } from "../components/TopNav";
import type { ApiMessage } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const URGENCY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#ca8a04",
  low:      "#16a34a",
};

type Ticket = ApiMessage & {
  replyNeeded: boolean;
  replyDraft: string | null;
  ticketStatus: string | null;
};

const URGENCY_TEXT: Record<string, string> = {
  critical: "var(--color-tabang)",
  high:     "var(--color-signal)",
  medium:   "var(--color-araw)",
  low:      "var(--color-ash)",
};

type ExtractedData = NonNullable<ApiMessage["extractedData"]>;

function ExtractedPanel({
  data: initialData,
  disabled,
  messageId,
  token,
}: {
  data: ExtractedData;
  disabled?: boolean;
  messageId: number;
  token: string | null;
}) {
  const [data, setData] = useState<ExtractedData>(initialData);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setData(initialData); }, [initialData]);

  function scheduleSave(next: ExtractedData) {
    if (disabled) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("idle");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await fetch(`${API_BASE}/api/tickets/${messageId}/extracted`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ extracted_data: next }),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("idle");
      }
    }, 600);
  }

  function setField(field: string, value: unknown) {
    setData(prev => {
      const next = { ...prev, [field]: value };
      scheduleSave(next);
      return next;
    });
  }

  function setItem(i: number, field: string, value: unknown) {
    setData(prev => {
      const items = [...(prev.items ?? [])];
      items[i] = { ...items[i], [field]: value };
      const next = { ...prev, items };
      scheduleSave(next);
      return next;
    });
  }

  function removeItem(i: number) {
    setData(prev => {
      const next = { ...prev, items: (prev.items ?? []).filter((_, j) => j !== i) };
      scheduleSave(next);
      return next;
    });
  }

  function addItem() {
    setData(prev => {
      const next = { ...prev, items: [...(prev.items ?? []), { name: "", qty: null, unit: "" }] };
      scheduleSave(next);
      return next;
    });
  }

  const inputCls = "w-full rounded-md px-2 py-1.5 text-sm font-semibold outline-none transition-colors";
  const inputStyle = {
    background: "var(--color-paper)",
    border: "1px solid var(--color-paper-edge)",
    color: "var(--color-ink)",
  };

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: "var(--color-paper-deep)", border: "1px solid var(--color-paper-edge)" }}
    >
      <div className="flex items-center justify-between">
        <p className="ak-caps text-xs" style={{ color: "var(--color-ash)" }}>extracted info</p>
        <span className="font-mono text-xs" style={{
          color: saveState === "saving" ? "var(--color-ash)" : saveState === "saved" ? "#16a34a" : "transparent",
        }}>
          {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : "·"}
        </span>
      </div>

      {/* location + persons */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="ak-caps text-xs block mb-1.5" style={{ color: "var(--color-ash)" }}>location</label>
          <input
            type="text"
            value={typeof data.location === "string" ? data.location : ""}
            onChange={e => setField("location", e.target.value)}
            disabled={disabled}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="ak-caps text-xs block mb-1.5" style={{ color: "var(--color-ash)" }}>persons</label>
          <div className="relative">
            <input
              type="number"
              value={data.persons ?? ""}
              onChange={e => setField("persons", e.target.value === "" ? null : Number(e.target.value))}
              disabled={disabled}
              className={inputCls}
              style={{ ...inputStyle, paddingRight: "2rem" }}
            />
            <span className="absolute right-2 top-1.5 text-xs pointer-events-none" style={{ color: "var(--color-ash)" }}>est.</span>
          </div>
        </div>
      </div>

      {/* items */}
      <div>
        <label className="ak-caps text-xs block mb-2" style={{ color: "var(--color-ash)" }}>required needs · item / qty</label>
        <div className="flex flex-col gap-2">
          {(data.items ?? []).map((item, i) => (
            <div key={i} className="flex gap-2 items-center group">
              <input
                type="text"
                value={item.name}
                onChange={e => setItem(i, "name", e.target.value)}
                disabled={disabled}
                className="flex-1 rounded-md px-2 py-1.5 text-sm font-semibold outline-none"
                style={inputStyle}
              />
              {item.unit === "triage" ? (
                <span className="px-2 py-1 text-xs font-bold rounded whitespace-nowrap shrink-0" style={{ background: "#fee2e2", color: "#dc2626" }}>
                  triage
                </span>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={item.qty ?? ""}
                    onChange={e => setItem(i, "qty", e.target.value === "" ? null : Number(e.target.value))}
                    disabled={disabled}
                    className="w-14 rounded-md px-2 py-1.5 text-xs font-bold outline-none text-center"
                    style={inputStyle}
                  />
                  {item.unit && (
                    <span className="text-xs font-bold whitespace-nowrap min-w-[24px]" style={{ color: "var(--color-ash)" }}>
                      {item.unit}
                    </span>
                  )}
                </div>
              )}
              {!disabled && (
                <button
                  onClick={() => removeItem(i)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                  style={{ color: "var(--color-ash)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              onClick={addItem}
              className="self-start flex items-center gap-1 text-xs font-bold px-1 py-0.5 rounded mt-1 transition-colors"
              style={{ color: "var(--color-dagat)" }}
            >
              <Plus className="w-3 h-3" strokeWidth={2.5} /> add item
            </button>
          )}
        </div>
      </div>

      {/* urgency */}
      <div className="flex items-center gap-2">
        <label className="ak-caps text-xs" style={{ color: "var(--color-ash)" }}>urgency</label>
        <select
          value={data.urgency || "medium"}
          onChange={e => setField("urgency", e.target.value)}
          disabled={disabled}
          className="rounded-md px-2 py-0.5 text-xs font-bold outline-none"
          style={{
            background: "var(--color-paper)",
            border: "1px solid var(--color-paper-edge)",
            color: URGENCY_TEXT[data.urgency || "medium"] || "var(--color-ash)",
          }}
        >
          <option value="critical">CRITICAL</option>
          <option value="high">URGENT</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </div>
    </div>
  );
}

function TicketCard({
  msg,
  token,
  onUpdate,
}: {
  msg: Ticket;
  token: string | null;
  onUpdate: () => void;
}) {
  const [draft, setDraft] = useState(msg.replyDraft || "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [approving, setApproving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEdited = useRef(false);
  const approved = msg.ticketStatus === "approved";
  const queued = msg.ticketStatus === "queued";
  const needsReply = msg.replyNeeded;

  useEffect(() => {
    if (!userEdited.current && msg.replyDraft && msg.replyDraft !== draft) {
      setDraft(msg.replyDraft);
    }
  }, [msg.replyDraft]);

  async function persistDraft(value: string) {
    if (!value.trim()) return;
    setSaveState("saving");
    try {
      await fetch(`${API_BASE}/api/tickets/${msg.id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ reply_draft: value }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("idle");
    }
  }

  function handleDraftChange(value: string) {
    userEdited.current = true;
    setDraft(value);
    setSaveState("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(value), 600);
  }

  async function approve() {
    if (needsReply && !draft.trim()) return;
    setApproving(true);
    if (draft.trim() && saveTimer.current) {
      clearTimeout(saveTimer.current);
      await persistDraft(draft);
    }
    try {
      await fetch(`${API_BASE}/api/tickets/${msg.id}/approve`, {
        method: "POST",
        headers: authHeaders(token),
      });
      onUpdate();
    } finally {
      setApproving(false);
    }
  }

  const urgency = msg.extractedData?.urgency || "medium";

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: "var(--color-paper-warm)",
        borderColor: approved ? "var(--color-dagat)" : "var(--color-paper-edge)",
        opacity: approved ? 0.75 : queued ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor: "var(--color-paper-edge)" }}>
        <span
          className="font-mono text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: URGENCY_COLOR[urgency] + "22", color: URGENCY_COLOR[urgency] }}
        >
          {urgency}
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--color-ash)" }}>
          from {msg.source}
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--color-smoke)" }}>
          · {msg.time ? new Date(msg.time).toLocaleString() : "—"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs font-semibold">
          {approved && (
            <span style={{ color: "var(--color-dagat)" }}>
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5" strokeWidth={2} />
              approved
            </span>
          )}
          {queued && (
            <span style={{ color: "var(--color-ash)" }}>
              <Clock className="w-3.5 h-3.5 inline mr-0.5" strokeWidth={2} />
              queued
            </span>
          )}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div>
          <p className="font-mono text-xs font-semibold mb-1.5" style={{ color: "var(--color-ash)" }}>
            original message
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
            {msg.content}
          </p>
        </div>

        {msg.extractedData && (
          <ExtractedPanel
            data={msg.extractedData}
            disabled={approved || queued}
            messageId={msg.id}
            token={token}
          />
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-mono text-xs font-semibold" style={{ color: "var(--color-ash)" }}>
              {needsReply ? "reply draft" : "reply (optional)"}
            </p>
            <span
              className="font-mono text-xs"
              style={{
                color: saveState === "saving" ? "var(--color-ash)"
                     : saveState === "saved"  ? "#16a34a"
                     :                          "transparent",
              }}
            >
              {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : "·"}
            </span>
          </div>
          {!needsReply && !approved && !queued && (
            <p className="text-xs mb-2" style={{ color: "var(--color-ash)" }}>
              No reply needed — add one below if you think it's necessary.
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            disabled={approved || queued}
            rows={3}
            placeholder={
              queued ? "Waiting for a responder…"
              : needsReply ? "Write a reply to send back via SMS…"
              : "Optionally write a reply…"
            }
            className="w-full rounded-lg border px-3 py-2.5 text-sm resize-y outline-none transition-colors"
            style={{
              background: approved || queued ? "var(--color-paper-deep)" : "var(--color-paper)",
              borderColor: "var(--color-paper-edge)",
              color: "var(--color-ink)",
            }}
          />
        </div>

        {!approved && !queued && (
          <div className="flex justify-end">
            <button
              onClick={approve}
              disabled={approving || (needsReply && !draft.trim())}
              className="inline-flex items-center gap-1.5 rounded-md py-2 px-4 text-sm font-semibold disabled:opacity-50 transition-colors"
              style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
              {approving ? "approving…" : needsReply ? "approve reply" : "mark reviewed"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueSection({ tickets, token, onUpdate }: { tickets: Ticket[]; token: string | null; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);
  if (tickets.length === 0) return null;

  async function claim(id: number) {
    setClaiming(id);
    try {
      await fetch(`${API_BASE}/api/tickets/${id}/claim`, {
        method: "POST",
        headers: authHeaders(token),
      });
      onUpdate();
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 mb-3 text-sm font-semibold"
        style={{ color: "var(--color-ash)" }}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Clock className="w-3.5 h-3.5" />
        queue — {tickets.length} waiting · approve a ticket to pull the next one in
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => {
            const urgency = t.extractedData?.urgency || "medium";
            return (
              <div
                key={t.id}
                className="rounded-xl border px-5 py-4 flex items-start justify-between gap-4"
                style={{ background: "var(--color-paper-warm)", borderColor: "var(--color-paper-edge)" }}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: URGENCY_COLOR[urgency] + "22", color: URGENCY_COLOR[urgency] }}
                    >
                      {urgency}
                    </span>
                    <span className="font-mono text-xs truncate" style={{ color: "var(--color-ash)" }}>
                      from {t.source} · {t.time ? new Date(t.time).toLocaleString() : "—"}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2 mt-1" style={{ color: "var(--color-ink-soft)" }}>
                    {t.content}
                  </p>
                </div>
                <button
                  onClick={() => claim(t.id)}
                  disabled={claiming === t.id}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md py-1.5 px-3 text-xs font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: "var(--color-paper-deep)", color: "var(--color-ink-soft)" }}
                >
                  {claiming === t.id ? "claiming…" : "Claim"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArchiveSection({ tickets, token, onUpdate }: { tickets: Ticket[]; token: string | null; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  if (tickets.length === 0) return null;
  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 mb-4 text-sm font-semibold"
        style={{ color: "var(--color-ash)" }}
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        archived ({tickets.length})
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {tickets.map((t) => (
            <TicketCard key={t.id} msg={t} token={token} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Tickets() {
  const { user, token, logout, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<boolean>(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  useEffect(() => {
    if (!isInitializing && !user) navigate("/login", { replace: true });
  }, [isInitializing, user, navigate]);

  useEffect(() => {
    if (!token || !user) return;
    fetch(`${API_BASE}/auth/me`, { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((d) => { if (typeof d.available === "boolean") setAvailable(d.available); })
      .catch(() => {});
  }, [token, user?.role]);

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, { headers: authHeaders(token) });
      if (res.status === 401) { logout(); navigate("/login", { replace: true }); return; }
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [token, logout, navigate]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "reply_draft_ready") {
          setTickets((prev) =>
            prev.map((t) =>
              t.id === msg.msgId ? { ...t, replyDraft: msg.replyDraft } : t
            )
          );
        }
        if (msg.type === "reply_draft_ready" || msg.type === "processing_done") {
          fetchTickets();
        }
      } catch {}
    };
    return () => ws.close();
  }, [fetchTickets]);

  async function toggleAvailability() {
    if (!token) return;
    setTogglingAvail(true);
    const next = !available;
    try {
      await fetch(`${API_BASE}/auth/users/me/available`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ available: next }),
      });
      setAvailable(next);
      fetchTickets();
    } finally {
      setTogglingAvail(false);
    }
  }

  const active   = tickets.filter((t) => t.ticketStatus === "pending_approval");
  const queued   = tickets.filter((t) => t.ticketStatus === "queued");
  const archived = tickets.filter((t) => t.ticketStatus === "approved");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-paper)" }}>
      <TopNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1
              className="font-display font-bold mb-1"
              style={{ fontSize: 24, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
            >
              tickets
            </h1>
            <p className="text-sm" style={{ color: "var(--color-ash)" }}>
              messages that need a reply — edit the draft and approve.
            </p>
          </div>

          {user && (
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="inline-flex items-center gap-1.5 rounded-md py-2 px-3 text-sm font-semibold shrink-0"
              style={{ background: "var(--color-paper-deep)", color: "var(--color-ink-soft)" }}
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{user.username} · </span>sign out
            </button>
          )}
        </div>

        {/* availability card */}
        {user && (
          <div
            className="mb-6 rounded-xl border overflow-hidden"
            style={{
              borderColor: available ? "#86efac" : "#fca5a5",
              background: available ? "#f0fdf4" : "#fff5f5",
            }}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: available ? "#16a34a" : "#dc2626" }}
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                    {available ? "Taking tickets" : "Paused"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-ash)" }}>
                    {available
                      ? "You will be assigned new tickets as they come in."
                      : "Your tickets have been reassigned. Turn on to receive new ones."}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleAvailability}
                disabled={togglingAvail}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shrink-0 transition-colors disabled:opacity-50"
                style={
                  available
                    ? { background: "#dcfce7", color: "#15803d" }
                    : { background: "var(--color-dagat)", color: "var(--color-bone)" }
                }
              >
                {available
                  ? <><ToggleRight className="w-4 h-4" strokeWidth={2} /> Pause</>
                  : <><ToggleLeft  className="w-4 h-4" strokeWidth={2} /> Resume</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ticket list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
              style={{ color: "var(--color-ash)" }}
            />
          </div>
        ) : active.length === 0 && queued.length === 0 && archived.length === 0 ? (
          <div
            className="rounded-xl border p-10 flex flex-col items-center gap-3 text-center"
            style={{ borderColor: "var(--color-paper-edge)", color: "var(--color-ash)" }}
          >
            <MessageSquare className="w-8 h-8" strokeWidth={1.5} />
            <p className="font-semibold" style={{ color: "var(--color-ink-soft)" }}>no tickets assigned</p>
            <p className="text-sm">tickets appear here when messages need a reply.</p>
          </div>
        ) : (
          <>
            {active.length === 0 ? (
              <div
                className="rounded-xl border p-8 flex flex-col items-center gap-2 text-center mb-4"
                style={{ borderColor: "var(--color-paper-edge)", color: "var(--color-ash)" }}
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
                <p className="text-sm">all caught up — approve a ticket to pull the next from the queue.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {active.map((t) => (
                  <TicketCard key={t.id} msg={t} token={token} onUpdate={fetchTickets} />
                ))}
              </div>
            )}
            <QueueSection tickets={queued} token={token} onUpdate={fetchTickets} />
            <ArchiveSection tickets={archived} token={token} onUpdate={fetchTickets} />
          </>
        )}
      </main>
    </div>
  );
}
