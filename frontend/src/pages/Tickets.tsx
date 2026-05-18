import { useEffect, useState, useCallback, useRef } from "react";
import {
  CheckCircle2, Clock, ChevronDown, ChevronRight, X,
  ToggleLeft, ToggleRight, MessageSquare, Plus,
  MoreVertical, Mic, Smartphone, UserCircle, AlertCircle,
  Loader2, ArrowRight, RefreshCw, Timer, Search, Archive,
} from "lucide-react";
import { useAuth, deviceHeaders } from "../context/AuthContext";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import type { ApiMessage } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

type TicketsTab = "my-tickets" | "inbox" | "archive";

// ─── Ticket types ────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#ca8a04",
  low:      "#16a34a",
};

const URGENCY_TEXT: Record<string, string> = {
  critical: "var(--color-tabang)",
  high:     "var(--color-signal)",
  medium:   "var(--color-araw)",
  low:      "var(--color-ash)",
};

type Ticket = ApiMessage & {
  replyNeeded: boolean;
  replyDraft: string | null;
  ticketStatus: string | null;
};

type ExtractedData = NonNullable<ApiMessage["extractedData"]>;

// ─── Inbox feed types ─────────────────────────────────────────────────────────

type InboxExtractedItem = {
  name: string;
  qty: number | null;
  canonical?: string | null;
  raw_text?: string | null;
  unit?: string | null;
  estimated?: boolean;
};

type InboxExtractedData = {
  location: string;
  urgency: string;
  persons: number;
  items: InboxExtractedItem[];
};

type InboxMessage = {
  id: string;
  type: string;
  source: string;
  time: string;
  content: string;
  status: "needs_processing" | "processing" | "processed" | "fulfilled" | "failed";
  extractedData: InboxExtractedData | null;
  processingStartedAt?: string;
  processingDurationMs?: number;
  processingNode?: string;
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ElapsedTimer({ startedAt }: { startedAt?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      100
    );
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return <span>0s</span>;
  return <span>{elapsed}s</span>;
}

function formatDuration(ms?: number): string | null {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function getInboxIcon(type: string) {
  switch (type) {
    case "sms":    return <Smartphone className="w-3.5 h-3.5" />;
    case "voice":  return <Mic className="w-3.5 h-3.5" />;
    case "walkin": return <UserCircle className="w-3.5 h-3.5" />;
    default:       return <MessageSquare className="w-3.5 h-3.5" />;
  }
}

// ─── Ticket sub-components ────────────────────────────────────────────────────

function ExtractedPanel({
  data: initialData,
  disabled,
  messageId,
  deviceId,
}: {
  data: ExtractedData;
  disabled?: boolean;
  messageId: string;
  deviceId: string;
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
          headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
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
  deviceId,
  onUpdate,
}: {
  msg: Ticket;
  deviceId: string;
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
        headers: { "Content-Type": "application/json", ...deviceHeaders(deviceId) },
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
    setApproving(true);
    if (draft.trim() && saveTimer.current) {
      clearTimeout(saveTimer.current);
      await persistDraft(draft);
    }
    try {
      await fetch(`${API_BASE}/api/tickets/${msg.id}/approve`, {
        method: "POST",
        headers: deviceHeaders(deviceId),
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
            deviceId={deviceId}
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
              disabled={approving}
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

function QueueSection({ tickets, deviceId, onUpdate }: { tickets: Ticket[]; deviceId: string; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  if (tickets.length === 0) return null;

  async function claim(id: string) {
    setClaiming(id);
    try {
      await fetch(`${API_BASE}/api/tickets/${id}/claim`, {
        method: "POST",
        headers: deviceHeaders(deviceId),
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

// ─── My Tickets tab ───────────────────────────────────────────────────────────

function MyTicketsTab({
  tickets,
  deviceId,
  loading,
  available,
  togglingAvail,
  toggleAvailability,
  fetchTickets,
}: {
  tickets: Ticket[];
  deviceId: string;
  loading: boolean;
  available: boolean;
  togglingAvail: boolean;
  toggleAvailability: () => void;
  fetchTickets: () => void;
}) {
  const active = tickets.filter((t) => t.ticketStatus === "pending_approval");
  const queued = tickets.filter((t) => t.ticketStatus === "queued");

  return (
    <div>
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div
            className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{ color: "var(--color-ash)" }}
          />
        </div>
      ) : active.length === 0 && queued.length === 0 ? (
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
                <TicketCard key={t.id} msg={t} deviceId={deviceId} onUpdate={fetchTickets} />
              ))}
            </div>
          )}
          <QueueSection tickets={queued} deviceId={deviceId} onUpdate={fetchTickets} />
        </>
      )}
    </div>
  );
}

// ─── Archive tab ──────────────────────────────────────────────────────────────

function ArchiveTab({
  tickets,
  deviceId,
  loading,
  fetchTickets,
}: {
  tickets: Ticket[];
  deviceId: string;
  loading: boolean;
  fetchTickets: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
          style={{ color: "var(--color-ash)" }}
        />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div
        className="rounded-xl border p-10 flex flex-col items-center gap-3 text-center"
        style={{ borderColor: "var(--color-paper-edge)", color: "var(--color-ash)" }}
      >
        <Archive className="w-8 h-8" strokeWidth={1.5} />
        <p className="font-semibold" style={{ color: "var(--color-ink-soft)" }}>no completed tickets</p>
        <p className="text-sm">approved tickets will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tickets.map((t) => (
        <TicketCard key={t.id} msg={t} deviceId={deviceId} onUpdate={fetchTickets} />
      ))}
    </div>
  );
}

// ─── Inbox tab ────────────────────────────────────────────────────────────────

function InboxTab() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [inboxOffset, setInboxOffset] = useState(0);
  const PAGE_SIZE = 50;
  const [activeSource, setActiveSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stats, setStats] = useState({ processed: 0, inQueue: 0, failed: 0 });
  const [, setProcessingIds] = useState<Set<string>>(new Set());
  const processingRefs = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  const doFetch = useCallback((src: string, q: string, offset: number, append: boolean) => {
    const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (src !== "all") p.set("source", src);
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/messages?${p}`)
      .then(r => r.json())
      .then((data: { messages: InboxMessage[]; total: number }) => {
        setMessages(prev => append ? [...prev, ...data.messages] : data.messages);
        setInboxTotal(data.total);
        setInboxOffset(offset + data.messages.length);
      })
      .catch(console.error);
  }, []);

  const fetchStats = () => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(console.error);
  };

  useEffect(() => {
    doFetch("all", "", 0, false);
    fetchStats();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "processing_started") {
          setMessages(prev => prev.map(m =>
            m.id === msg.msgId
              ? { ...m, status: "processing", processingStartedAt: msg.startedAt }
              : m
          ));
        } else if (msg.type === "processing_done") {
          setMessages(prev => prev.map(m =>
            m.id === msg.msgId
              ? { ...m, status: "processed", processingDurationMs: msg.durationMs, extractedData: msg.extractedData, processingNode: msg.nodeName }
              : m
          ));
          processingRefs.current.delete(msg.msgId);
          setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.msgId); return n; });
          fetchStats();
        } else if (msg.type === "processing_failed") {
          setMessages(prev => prev.map(m =>
            m.id === msg.msgId ? { ...m, status: "failed" } : m
          ));
          processingRefs.current.delete(msg.msgId);
          setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.msgId); return n; });
          fetchStats();
        }
      };

      ws.onclose = () => { if (!cancelled) setTimeout(connect, 3000); };
    };

    connect();
    return () => { cancelled = true; wsRef.current?.close(); };
  }, []);

  const loadOlder = () => doFetch(activeSource, searchQuery, inboxOffset, true);

  const triggerProcess = useCallback((msg: InboxMessage) => {
    if (processingRefs.current.has(msg.id)) return;
    processingRefs.current.add(msg.id);
    setProcessingIds(prev => new Set([...prev, msg.id]));

    const startedAt = new Date().toISOString();
    setMessages(prev => prev.map(m =>
      m.id === msg.id ? { ...m, status: "processing", processingStartedAt: startedAt } : m
    ));

    fetch("/api/process_message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg.content, id: msg.id }),
    })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(({ extractedData, durationMs }: { extractedData: InboxExtractedData; durationMs: number }) => {
        setMessages(prev => prev.map(m =>
          m.id === msg.id
            ? { ...m, status: "processed", extractedData, processingDurationMs: durationMs }
            : m
        ));
      })
      .catch(() => {
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, status: "needs_processing" } : m
        ));
      })
      .finally(() => {
        processingRefs.current.delete(msg.id);
        setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; });
      });
  }, []);

  const handleRetry = (msg: InboxMessage) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "needs_processing" } : m));
  };

  const handleRetryAll = () => {
    setMessages(prev => prev.map(m => m.status === "failed" ? { ...m, status: "processing" } : m));
    fetch("/api/retry-failed", { method: "POST" })
      .then(() => fetchStats())
      .catch(console.error);
  };

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleSaveInbox = (id: string, extractedData: InboxExtractedData) => {
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      fetch(`/api/messages/${id}/extracted`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: extractedData }),
      }).catch(() => {});
      saveTimers.current.delete(id);
    }, 600);
    saveTimers.current.set(id, timer);
  };

  const handleUpdateField = (id: string, field: string, value: unknown) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData) {
        const updated = { ...m.extractedData, [field]: value } as InboxExtractedData;
        scheduleSaveInbox(id, updated);
        return { ...m, extractedData: updated };
      }
      return m;
    }));
  };

  const handleUpdateItem = (id: string, index: number, field: string, value: unknown) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData?.items) {
        const newItems = [...m.extractedData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        const updated = { ...m.extractedData, items: newItems };
        scheduleSaveInbox(id, updated);
        return { ...m, extractedData: updated };
      }
      return m;
    }));
  };

  const handleRemoveItem = (id: string, index: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData?.items) {
        const updated = { ...m.extractedData, items: m.extractedData.items.filter((_, i) => i !== index) };
        scheduleSaveInbox(id, updated);
        return { ...m, extractedData: updated };
      }
      return m;
    }));
  };

  const handleFulfill = async (id: string) => {
    await fetch(`/api/messages/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "fulfilled" }),
    });
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleAddItem = (id: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData) {
        const updated = { ...m.extractedData, items: [...(m.extractedData.items || []), { name: "", qty: 1 }] };
        scheduleSaveInbox(id, updated as InboxExtractedData);
        return { ...m, extractedData: updated as InboxExtractedData };
      }
      return m;
    }));
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-2xl font-black text-on-surface leading-none">{stats.processed}</p>
            <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>processed</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
          <Loader2 className={`w-5 h-5 text-secondary shrink-0 ${stats.inQueue > 0 ? "animate-spin" : ""}`} />
          <div>
            <p className="text-2xl font-black text-on-surface leading-none">{stats.inQueue}</p>
            <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>in queue</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black text-on-surface leading-none">{stats.failed}</p>
            <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>failed</p>
          </div>
          {stats.failed > 0 && (
            <button
              onClick={handleRetryAll}
              className="shrink-0 flex items-center gap-1 px-2 py-1.5 bg-error/10 text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> retry all
            </button>
          )}
        </div>
      </div>

      {/* Source filter + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="inline-flex p-[3px] rounded-full"
          style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
        >
          {(["all sources", "sms", "voice", "manual"] as const).map((label) => {
            const val = label === "all sources" ? "all" : label;
            const active = activeSource === val;
            return (
              <button
                key={label}
                onClick={() => {
                  setActiveSource(val);
                  doFetch(val, searchQuery, 0, false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-colors"
                style={
                  active
                    ? { background: "var(--color-paper)", color: "var(--color-ink)", boxShadow: "var(--shadow-1)" }
                    : { background: "transparent", color: "var(--color-ash)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--color-ash)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (searchDebounce.current) clearTimeout(searchDebounce.current);
              searchDebounce.current = setTimeout(() => {
                doFetch(activeSource, val, 0, false);
              }, 300);
            }}
            placeholder="search by phone number, message content…"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-colors"
            style={{
              background: "var(--color-paper-warm)",
              border: "1px solid var(--color-paper-edge)",
              color: "var(--color-ink)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                doFetch(activeSource, "", 0, false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: "var(--color-ash)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Message feed */}
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl flex flex-col lg:flex-row transition-all"
            style={{
              background: "var(--color-paper-warm)",
              border: "1px solid var(--color-paper-edge)",
              opacity: message.status === "fulfilled" ? 0.7 : 1,
            }}
          >
            <div className="p-5 flex-1 max-w-2xl">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                    style={{
                      background: "var(--color-paper)",
                      border: "1px solid var(--color-paper-edge)",
                      color: "var(--color-ash)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      lineHeight: 1,
                    }}
                  >
                    {getInboxIcon(message.type)}
                    {message.source}
                  </span>
                  <span style={{ color: "var(--color-ash)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    · {message.time}
                  </span>
                </div>
                <button
                  className="rounded p-1"
                  style={{ color: "var(--color-ash)", background: "transparent", border: "none", cursor: "pointer" }}
                  aria-label="more"
                >
                  <MoreVertical className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <div
                className="mb-4"
                style={{ fontFamily: "var(--font-mono)", fontSize: 15, lineHeight: 1.6, color: "var(--color-ink-soft)" }}
              >
                {message.content}
              </div>

              {message.status === "needs_processing" && (
                <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                  <div className="flex items-center gap-2 text-error text-sm font-bold">
                    <AlertCircle className="w-4 h-4" />
                    needs processing
                  </div>
                  <button
                    onClick={() => triggerProcess(message)}
                    className="px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> reprocess with Gemma
                  </button>
                </div>
              )}

              {message.status === "processing" && (
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: "1px solid var(--color-paper-edge)" }}
                >
                  <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--color-ash)" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-damay)" }} />
                    <span>Gemma is thinking…</span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
                    style={{ background: "var(--color-damay-soft)", color: "var(--color-damay)" }}
                  >
                    <Timer className="w-3 h-3" strokeWidth={2} />
                    <ElapsedTimer startedAt={message.processingStartedAt} />
                  </span>
                </div>
              )}

              {message.status === "failed" && (
                <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                  <div className="flex items-center gap-2 text-error text-sm font-bold">
                    <AlertCircle className="w-4 h-4" />
                    extraction failed
                  </div>
                  <button
                    onClick={() => handleRetry(message)}
                    className="px-4 py-2 bg-error/10 text-error border border-error/30 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-error/20 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> retry
                  </button>
                </div>
              )}

              {message.status === "processed" && (
                <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                  <div className="flex items-center gap-2 text-primary text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    processed
                    {formatDuration(message.processingDurationMs) && (
                      <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">
                        {formatDuration(message.processingDurationMs)}
                      </span>
                    )}
                    {message.processingNode && (
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs rounded-full font-bold">
                        {message.processingNode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-on-surface-variant flex items-center gap-1 font-bold">
                    parsed <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>

            {message.status === "processed" && message.extractedData && (
              <div className="flex-1 bg-surface border-t lg:border-t-0 lg:border-l border-outline-variant/20 p-6 flex flex-col justify-center transition-all">
                <div className="flex justify-between items-center mb-4">
                  <span className="ak-caps" style={{ color: "var(--color-ash)" }}>extracted info</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block ak-caps mb-1.5" style={{ color: "var(--color-ash)" }}>location</label>
                    <input
                      type="text"
                      value={message.extractedData.location || ""}
                      onChange={(e) => handleUpdateField(message.id, "location", e.target.value)}
                      className="w-full bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block ak-caps mb-1.5" style={{ color: "var(--color-ash)" }}>persons</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={message.extractedData.persons || 0}
                        onChange={(e) => handleUpdateField(message.id, "persons", Number(e.target.value))}
                        className="w-full bg-surface-container hover:bg-surface-container-high rounded-md pl-2 pr-8 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                      />
                      <span className="absolute right-2 top-1.5 text-xs text-on-surface-variant pointer-events-none">est.</span>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block ak-caps mb-2" style={{ color: "var(--color-ash)" }}>required needs · item / qty</label>
                  <div className="flex flex-col gap-2">
                    {message.extractedData.items?.map((item, i) => (
                      <div key={i} className="flex gap-2 items-center group">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(message.id, i, "name", e.target.value)}
                          className="flex-1 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                        />
                        {item.unit === "triage" ? (
                          <span className="px-2 py-1 bg-error/10 text-error text-[10px] font-bold rounded whitespace-nowrap">
                            triage req.
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.qty ?? ""}
                              onChange={(e) => handleUpdateItem(message.id, i, "qty", e.target.value === "" ? null : Number(e.target.value))}
                              className={`w-14 rounded-md px-2 py-1.5 text-xs border-none ring-1 outline-none font-bold transition-colors text-center ${
                                item.estimated
                                  ? "bg-primary/8 ring-primary/30 text-primary focus:ring-primary"
                                  : "bg-surface-container hover:bg-surface-container-high ring-outline-variant/30 focus:ring-primary text-on-surface"
                              }`}
                            />
                            {item.unit && (
                              <span className="text-[10px] text-on-surface-variant font-bold whitespace-nowrap min-w-[24px]">
                                {item.unit}
                              </span>
                            )}
                          </div>
                        )}
                        <button onClick={() => handleRemoveItem(message.id, i)} className="text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 p-1 rounded transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddItem(message.id)}
                      className="text-xs text-primary font-bold hover:bg-primary/5 px-2 py-1 rounded transition-colors self-start mt-1"
                    >
                      + add item
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4">
                  <div className="flex items-center gap-2">
                    <label className="ak-caps" style={{ color: "var(--color-ash)" }}>urgency</label>
                    <select
                      value={message.extractedData.urgency || "low"}
                      onChange={(e) => handleUpdateField(message.id, "urgency", e.target.value)}
                      className="bg-surface-container rounded-md px-2 py-0.5 text-xs font-bold border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none"
                      style={{
                        color:
                          message.extractedData.urgency === "critical" ? "var(--color-tabang)" :
                          message.extractedData.urgency === "high"     ? "var(--color-signal)" :
                          message.extractedData.urgency === "medium"   ? "var(--color-araw)"   :
                                                                         "var(--color-ash)",
                      }}
                    >
                      <option value="critical">CRITICAL</option>
                      <option value="high">URGENT</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleFulfill(message.id)}
                    className="text-xs font-bold text-primary hover:underline hover:brightness-110 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> mark fulfilled
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {messages.length < inboxTotal && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadOlder}
            className="py-3 px-6 border-2 border-dashed border-outline-variant/30 text-on-surface-variant font-bold text-sm rounded-xl hover:bg-surface-container transition-colors"
          >
            load older messages ({inboxTotal - messages.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Tickets page ────────────────────────────────────────────────────────

export function Tickets() {
  const { deviceId, receiving, setReceiving } = useAuth();
  const [activeTab, setActiveTab] = useState<TicketsTab>("my-tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, { headers: deviceHeaders(deviceId) });
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const msgId = String(msg.msgId);
        if (msg.type === "reply_draft_ready") {
          setTickets((prev) =>
            prev.map((t) =>
              t.id === msgId ? { ...t, replyDraft: msg.replyDraft } : t
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
    setTogglingAvail(true);
    const next = !receiving;
    try {
      await setReceiving(next);
      fetchTickets();
    } finally {
      setTogglingAvail(false);
    }
  }

  const myTickets = tickets.filter((t) => t.ticketStatus === "pending_approval" || t.ticketStatus === "queued");
  const archived  = tickets.filter((t) => t.ticketStatus === "approved");

  const TABS: { id: TicketsTab; label: string; count?: number }[] = [
    { id: "my-tickets", label: "my tickets", count: myTickets.filter(t => t.ticketStatus === "pending_approval").length || undefined },
    { id: "inbox",      label: "inbox" },
    { id: "archive",    label: "archive", count: archived.length || undefined },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-paper)" }}>
      <TopNav />
      <MobileNav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 pb-24 md:pb-8">
        {/* Page header */}
        <div className="mb-6">
          <h1
            className="font-display font-bold mb-1"
            style={{ fontSize: 24, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
          >
            tickets
          </h1>
          <p className="text-sm" style={{ color: "var(--color-ash)" }}>
            manage assigned tickets, review the full inbox, and browse completed work.
          </p>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all"
                style={
                  active
                    ? { background: "var(--color-paper)", color: "var(--color-ink)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                    : { background: "transparent", color: "var(--color-ash)" }
                }
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                    style={
                      active
                        ? { background: "var(--color-dagat)", color: "var(--color-bone)" }
                        : { background: "var(--color-paper-edge)", color: "var(--color-ash)" }
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "my-tickets" && (
          <MyTicketsTab
            tickets={myTickets}
            deviceId={deviceId}
            loading={loading}
            available={receiving}
            togglingAvail={togglingAvail}
            toggleAvailability={toggleAvailability}
            fetchTickets={fetchTickets}
          />
        )}
        {activeTab === "inbox" && <InboxTab />}
        {activeTab === "archive" && (
          <ArchiveTab
            tickets={archived}
            deviceId={deviceId}
            loading={loading}
            fetchTickets={fetchTickets}
          />
        )}
      </main>
    </div>
  );
}
