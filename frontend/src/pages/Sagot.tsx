import { useState } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";

type Confidence = "high" | "medium" | "low";

type SagotRecord = {
  id: string;
  time: string;
  channel: string;
  lang: string;
  quote: string;
  sender: string;
  draft: string;
  confidence: Confidence;
  intent: string;
};

const FIXTURES: SagotRecord[] = [
  {
    id: "s1",
    time: "07:12 PM · today",
    channel: "inbound SMS",
    lang: "tagalog",
    quote: "hi po, gusto po naming mag donate ng tubig, saan po pwede ipadala?",
    sender: "+63 9XX XXX XX45",
    draft: "salamat po sa interes. pwede po mag drop off sa Brgy. San Roque relief center, 8am–6pm araw-araw. tubig at gamot ang pinaka kailangan ngayon. — akbay relief, Cebu",
    confidence: "high",
    intent: "donation offer",
  },
  {
    id: "s2",
    time: "06:34 PM · today",
    channel: "inbound SMS",
    lang: "english",
    quote: "is the relief center accepting clothing donations? are there sizes you need most?",
    sender: "+63 9XX XXX XX18",
    draft: "thanks for reaching out. we are accepting clothing — most needed are adult sizes (M–L) and children's. please drop off at Brgy. San Roque relief center, 8am–6pm. — akbay relief, Cebu",
    confidence: "high",
    intent: "donation inquiry",
  },
  {
    id: "s3",
    time: "06:02 PM · today",
    channel: "inbound SMS",
    lang: "tagalog",
    quote: "kamusta po, nasaan po ba ang malapit na relief center sa Liloan?",
    sender: "+63 9XX XXX XX91",
    draft: "ang pinakamalapit po sa Liloan ay ang Brgy. San Roque relief center, mga 6km papunta. bukas po 8am–6pm. — akbay relief, Cebu",
    confidence: "medium",
    intent: "location inquiry",
  },
];

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all",      label: "all" },
  { key: "donation", label: "donation" },
  { key: "location", label: "location" },
  { key: "low",      label: "low confidence" },
];

function matchesFilter(r: SagotRecord, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "low") return r.confidence === "low" || r.confidence === "medium";
  if (filter === "donation") return r.intent.toLowerCase().includes("donation");
  if (filter === "location") return r.intent.toLowerCase().includes("location");
  return true;
}

type DraftCardProps = { rec: SagotRecord };

function DraftCard({ rec }: DraftCardProps) {
  const [draft, setDraft] = useState(rec.draft);
  const [sent, setSent] = useState(false);
  const [rejected, setRejected] = useState(false);

  const confidenceColor =
    rec.confidence === "high"   ? "var(--color-damay)" :
    rec.confidence === "medium" ? "var(--color-araw)"  :
                                  "var(--color-tabang)";

  return (
    <div
      className="rounded-xl flex flex-col gap-3 px-5 py-4 mb-3"
      style={{
        background: "var(--color-paper-warm)",
        border: "1px solid var(--color-paper-edge)",
        opacity: rejected ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            background: sent ? "var(--color-damay-soft)" : rejected ? "var(--color-cloud)" : "var(--color-cloud)",
            color: sent ? "var(--color-damay)" : rejected ? "var(--color-ash)" : "var(--color-ink)",
            lineHeight: 1,
          }}
        >
          {sent ? "sent" : rejected ? "rejected" : "draft"}
        </span>
        <span className="text-xs" style={{ color: "var(--color-ash)" }}>
          {rec.time} · {rec.channel} · {rec.lang}
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          color: "var(--color-ink-soft)",
          lineHeight: 1.65,
          paddingLeft: 12,
          borderLeft: "2px solid var(--color-paper-edge)",
        }}
      >
        “{rec.quote}”
      </div>
      <div className="text-xs" style={{ color: "var(--color-ash)", paddingLeft: 12, marginTop: -8 }}>
        — {rec.sender}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-paper-edge)", margin: "4px 0" }} />

      <div>
        <div className="text-xs mb-1.5" style={{ color: "var(--color-ash)" }}>
          draft reply <span style={{ fontStyle: "italic" }}>· editable</span>
        </div>
        <textarea
          className="w-full rounded-md outline-none"
          style={{
            background: "var(--color-paper)",
            border: "1px solid var(--color-paper-edge)",
            padding: "11px 13px",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-ink)",
            resize: "vertical",
            minHeight: 90,
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sent || rejected}
        />
      </div>

      <div className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--color-ash)" }}>
        <span>confidence ·</span>
        <span style={{ color: confidenceColor, fontWeight: 600 }}>{rec.confidence}</span>
        <span>· intent:</span>
        <span style={{ color: "var(--color-ink)" }}>{rec.intent}</span>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-paper-edge)", margin: "4px 0" }} />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSent(true)}
          disabled={sent || rejected}
          className="text-sm font-semibold rounded-md px-3.5 py-2 inline-flex items-center gap-1.5"
          style={{
            background: sent ? "var(--color-damay)" : "var(--color-dagat)",
            color: "var(--color-bone)",
            border: "none",
            cursor: sent || rejected ? "default" : "pointer",
            opacity: rejected ? 0.5 : 1,
          }}
        >
          {sent ? "sent ✓" : "send as-is"}
        </button>
        <button
          disabled={sent || rejected}
          className="text-sm font-semibold rounded-md px-3.5 py-2"
          style={{
            background: "var(--color-paper)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-paper-edge)",
            cursor: sent || rejected ? "default" : "pointer",
            opacity: sent || rejected ? 0.5 : 1,
          }}
        >
          edit ↗
        </button>
        <button
          onClick={() => setRejected(true)}
          disabled={sent || rejected}
          className="text-sm font-semibold rounded-md px-3.5 py-2"
          style={{
            background: "transparent",
            color: "var(--color-ash)",
            border: "none",
            cursor: sent || rejected ? "default" : "pointer",
            opacity: sent || rejected ? 0.5 : 1,
          }}
        >
          reject
        </button>
      </div>
    </div>
  );
}

export function Sagot() {
  const [filter, setFilter] = useState("all");
  const records = FIXTURES.filter(r => matchesFilter(r, filter));

  return (
    <div className="h-screen font-body flex flex-col overflow-hidden" style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}>
      <TopNav />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 md:pb-8">
        <div className="mb-5">
          <h1
            className="font-display font-bold leading-tight"
            style={{ fontSize: 30, color: "var(--color-ink-soft)", letterSpacing: "-0.025em", margin: 0 }}
          >
            sagot
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
            drafted replies waiting on a human.
          </p>
        </div>

        <div
          className="mb-4 rounded-md px-3.5 py-2.5"
          style={{
            background: "var(--color-paper-warm)",
            borderLeft: "3px solid var(--color-araw)",
            fontSize: 13,
            color: "var(--color-ink)",
            fontStyle: "italic",
          }}
        >
          every reply is reviewed by a person before sending.
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 22, color: "var(--color-ink-soft)", letterSpacing: "-0.015em", lineHeight: 1.2 }}
            >
              drafted replies
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--color-ash)" }}>
              Gemma drafted; a comms volunteer reviews, edits, and sends.
            </p>
          </div>
          <div
            className="inline-flex p-[3px] rounded-full self-start sm:self-auto"
            style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
          >
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-colors"
                style={
                  filter === f.key
                    ? { background: "var(--color-paper)", color: "var(--color-ink)", boxShadow: "var(--shadow-1)", border: "none" }
                    : { background: "transparent", color: "var(--color-ash)", border: "none", cursor: "pointer" }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-3xl">
          {records.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--color-ash)" }}>
              no drafts match this filter.
            </p>
          ) : (
            records.map(r => <DraftCard key={r.id} rec={r} />)
          )}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
