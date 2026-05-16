import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, HelpCircle, Menu, Users, Map as MapIcon, Droplet, ShoppingBag, Tent,
  Hand as CleanHands, Shirt, Zap, Smartphone, Mic, UserCircle, MessageSquare,
  ArrowUpRight, Copy, Download, RefreshCw, Calendar, MapPin, Check,
} from "lucide-react";
import { MobileNav } from "../components/MobileNav";
import { Brand } from "../components/Brand";
import type { ApiMessage, ApiLocation } from "../types";

const URGENCY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const URGENCY_PILL: Record<string, { bg: string; fg: string; accent: string }> = {
  critical: { bg: "var(--color-tabang)",      fg: "var(--color-bone)", accent: "var(--color-tabang)" },
  high:     { bg: "var(--color-signal)",      fg: "var(--color-bone)", accent: "var(--color-signal)" },
  medium:   { bg: "var(--color-araw)",        fg: "var(--color-ink)",  accent: "var(--color-araw)" },
  low:      { bg: "var(--color-cloud)",       fg: "var(--color-ash)",  accent: "var(--color-paper-edge)" },
};

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  sms:    { label: "sms",     icon: <Smartphone className="w-4 h-4" strokeWidth={1.75} /> },
  voice:  { label: "voice",   icon: <Mic className="w-4 h-4" strokeWidth={1.75} /> },
  walkin: { label: "walk-in", icon: <UserCircle className="w-4 h-4" strokeWidth={1.75} /> },
  viber:  { label: "viber",   icon: <MessageSquare className="w-4 h-4" strokeWidth={1.75} /> },
};

function iconForItem(name: string): React.ReactNode {
  const n = name.toLowerCase();
  if (/(water|tubig|drink)/.test(n)) return <Droplet className="w-6 h-6" strokeWidth={1.75} />;
  if (/(food|pack|rice|kanin|meal|biscuit)/.test(n)) return <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />;
  if (/(tarp|shelter|tent|roof)/.test(n)) return <Tent className="w-6 h-6" strokeWidth={1.75} />;
  if (/(hygiene|soap|sanit)/.test(n)) return <CleanHands className="w-6 h-6" strokeWidth={1.75} />;
  if (/(cloth|shirt|blanket|kumot)/.test(n)) return <Shirt className="w-6 h-6" strokeWidth={1.75} />;
  if (/(light|power|battery|gas|fuel|candle)/.test(n)) return <Zap className="w-6 h-6" strokeWidth={1.75} />;
  return <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />;
}

function formatLocation(loc: ApiLocation): string {
  if (!loc) return "Unknown";
  if (typeof loc === "string") return loc;
  const parts = [loc.barangay, loc.city, loc.province].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

function formatSnapshot(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

type DonorItem = {
  name: string;
  unit: string;
  requested: number | null; // null when at least one source had unknown qty
  packed: number;
  hasUnknownQty: boolean;
  topUrgency: string;
};

type DonorLocation = {
  location: string;
  urgency: string;
  persons: number;
  reportCount: number;
  receivedAt: string;
};

type Snapshot = {
  takenAt: Date;
  totalPersons: number;
  reportCount: number;
  locations: DonorLocation[];
  items: DonorItem[];
  channelCounts: Record<string, number>;
};

function buildSnapshot(messages: ApiMessage[], takenAt: Date): Snapshot {
  const processed = messages.filter(m => m.status === "processed" && m.extractedData);

  const itemMap = new Map<string, DonorItem>();
  const locMap = new Map<string, DonorLocation>();
  const channelCounts: Record<string, number> = {};
  let totalPersons = 0;

  for (const msg of processed) {
    const ed = msg.extractedData!;
    const locName = formatLocation(ed.location);
    const urgency = ed.urgency || "low";
    totalPersons += ed.persons ?? 0;

    const ch = msg.type || "sms";
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;

    const locExisting = locMap.get(locName);
    if (locExisting) {
      locExisting.persons += ed.persons ?? 0;
      locExisting.reportCount += 1;
      if ((URGENCY_WEIGHT[urgency] ?? 0) > (URGENCY_WEIGHT[locExisting.urgency] ?? 0)) {
        locExisting.urgency = urgency;
      }
      if (msg.time > locExisting.receivedAt) locExisting.receivedAt = msg.time;
    } else {
      locMap.set(locName, {
        location: locName,
        urgency,
        persons: ed.persons ?? 0,
        reportCount: 1,
        receivedAt: msg.time,
      });
    }

    for (let i = 0; i < ed.items.length; i++) {
      const item = ed.items[i];
      const canonical = (item.canonical || item.name || "").toLowerCase().trim();
      if (!canonical) continue;
      const unit = item.unit || "";
      const key = `${canonical}|${unit}`;
      const packed = msg.packingState?.[String(i)] ?? 0;

      const existing = itemMap.get(key);
      if (existing) {
        if (item.qty == null) existing.hasUnknownQty = true;
        else existing.requested = (existing.requested ?? 0) + item.qty;
        existing.packed += packed;
        if ((URGENCY_WEIGHT[urgency] ?? 0) > (URGENCY_WEIGHT[existing.topUrgency] ?? 0)) {
          existing.topUrgency = urgency;
        }
      } else {
        itemMap.set(key, {
          name: item.name,
          unit,
          requested: item.qty,
          packed,
          hasUnknownQty: item.qty == null,
          topUrgency: urgency,
        });
      }
    }
  }

  const items = Array.from(itemMap.values())
    .filter(i => i.requested == null || i.packed < (i.requested ?? Infinity) || i.hasUnknownQty)
    .sort((a, b) => {
      const u = (URGENCY_WEIGHT[b.topUrgency] ?? 0) - (URGENCY_WEIGHT[a.topUrgency] ?? 0);
      if (u !== 0) return u;
      const aRem = a.requested == null ? Infinity : a.requested - a.packed;
      const bRem = b.requested == null ? Infinity : b.requested - b.packed;
      return bRem - aRem;
    });

  const locations = Array.from(locMap.values()).sort(
    (a, b) => (URGENCY_WEIGHT[b.urgency] ?? 0) - (URGENCY_WEIGHT[a.urgency] ?? 0),
  );

  return {
    takenAt,
    totalPersons,
    reportCount: processed.length,
    locations,
    items,
    channelCounts,
  };
}

function buildShareableText(s: Snapshot): string {
  const lines: string[] = [];
  lines.push("akbay — relief snapshot");
  lines.push(formatSnapshot(s.takenAt));
  lines.push("");
  if (s.locations.length === 0) {
    lines.push("no active reports.");
    return lines.join("\n");
  }
  lines.push(`active locations: ${s.locations.length}`);
  lines.push(`people affected (reported): ~${s.totalPersons}`);
  lines.push(`reports received: ${s.reportCount}`);
  lines.push("");
  lines.push("locations:");
  for (const l of s.locations) {
    lines.push(`  • ${l.location} — ${l.urgency}, ~${l.persons} people, ${l.reportCount} report${l.reportCount === 1 ? "" : "s"}`);
  }
  lines.push("");
  lines.push("still needed:");
  for (const it of s.items.slice(0, 12)) {
    const remaining = it.requested == null ? null : it.requested - it.packed;
    const qtyStr = remaining == null
      ? `unknown qty${it.unit ? ` (${it.unit})` : ""}`
      : `${remaining}${it.unit ? ` ${it.unit}` : ""}`;
    lines.push(`  • ${it.name} — ${qtyStr}${it.hasUnknownQty && remaining != null ? "+?" : ""}`);
  }
  lines.push("");
  lines.push("snapshot — not live. share fresh as conditions change.");
  return lines.join("\n");
}

export function DonorView() {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [snapshotAt, setSnapshotAt] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchMessages = () => {
    setLoading(true);
    return fetch("/api/messages?limit=1000")
      .then(r => r.json())
      .then((data: { messages: ApiMessage[] }) => {
        setMessages(data.messages || []);
        setSnapshotAt(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const snapshot = useMemo(() => buildSnapshot(messages, snapshotAt), [messages, snapshotAt]);

  const handleExport = () => window.print();
  const handleRefresh = () => fetchMessages();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareableText(snapshot));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  // Headline urgency = highest urgency across all locations
  const topUrgency = snapshot.locations[0]?.urgency ?? "low";
  const headlineLocation =
    snapshot.locations.length === 0 ? "No active reports"
    : snapshot.locations.length === 1 ? snapshot.locations[0].location
    : `${snapshot.locations.length} active locations`;

  const criticalItems = snapshot.items.filter(i =>
    i.topUrgency === "critical" || i.topUrgency === "high"
  ).slice(0, 6);
  const otherItems = snapshot.items.filter(i => !criticalItems.includes(i)).slice(0, 8);

  const channelEntries = Object.entries(snapshot.channelCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <header
        className="flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50 print:hidden"
        style={{ background: "var(--color-dagat)", color: "var(--color-bone)", borderBottom: "1px solid var(--color-dagat-deep)" }}
      >
        <Brand variant="on-dark" size={28} linkTo="/" />

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-1">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{ color: "rgba(251,246,232,0.7)" }}
            >
              pulso
            </Link>
            <Link
              to="/donor-view"
              className="px-3 py-1.5 rounded-md text-sm font-semibold"
              style={{ background: "rgba(224,138,30,0.18)", color: "var(--color-bone)" }}
            >
              donor view
            </Link>
          </nav>

          <div className="flex items-center gap-2" style={{ color: "rgba(251,246,232,0.7)" }}>
            <button className="p-2 rounded-full" aria-label="notifications">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button className="p-2 rounded-full" aria-label="help">
              <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <button
          className="md:hidden p-2 rounded-full"
          style={{ color: "var(--color-bone)" }}
          aria-label="menu"
        >
          <Menu className="w-6 h-6" strokeWidth={1.75} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12 mb-20 md:mb-8">
        <div className="mb-8 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold"
              style={{
                background: snapshot.locations.length ? URGENCY_PILL[topUrgency].bg : "var(--color-paper-deep)",
                color: snapshot.locations.length ? URGENCY_PILL[topUrgency].fg : "var(--color-ink-soft)",
              }}
            >
              {snapshot.locations.length > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 print:hidden"
                    style={{ background: "currentColor" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "currentColor" }} />
                </span>
              )}
              {snapshot.locations.length ? `ACTIVE RELIEF OPS — ${topUrgency.toUpperCase()}` : "NO ACTIVE OPS"}
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider"
              style={{ background: "var(--color-paper-deep)", color: "var(--color-ink-soft)" }}
            >
              snapshot — not live
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-black text-on-surface tracking-tight mb-3">
            {headlineLocation}
          </h1>
          {snapshot.locations.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {snapshot.locations.slice(0, 8).map(l => (
                <span
                  key={l.location}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: "var(--color-paper-warm)",
                    color: "var(--color-ink)",
                    border: `1px solid ${URGENCY_PILL[l.urgency]?.accent ?? "var(--color-paper-edge)"}`,
                  }}
                >
                  <MapPin className="w-3 h-3" strokeWidth={2} />
                  {l.location}
                </span>
              ))}
              {snapshot.locations.length > 8 && (
                <span className="text-xs self-center" style={{ color: "var(--color-ash)" }}>
                  +{snapshot.locations.length - 8} more
                </span>
              )}
            </div>
          )}

          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-5 p-4 rounded-xl border"
            style={{ background: "var(--color-paper-warm)", borderColor: "var(--color-paper-edge)" }}
          >
            <div className="flex items-start gap-3 text-left">
              <Calendar className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.75} style={{ color: "var(--color-dagat)" }} />
              <div>
                <div className="text-xs font-mono font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--color-ash)" }}>
                  snapshot captured
                </div>
                <div className="font-headline font-bold text-base md:text-lg" style={{ color: "var(--color-ink)" }}>
                  {formatSnapshot(snapshotAt)}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--color-ash)" }}>
                  share fresh as conditions change — this page does not update live.
                </div>
              </div>
            </div>

            <div className="flex gap-2 print:hidden shrink-0">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md py-2 px-3 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50"
                style={{ background: "transparent", color: "var(--color-dagat)", border: "1px solid var(--color-dagat)" }}
                aria-label="refresh snapshot"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
                refresh
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md py-2 px-3 text-sm font-semibold transition-colors active:scale-[0.98]"
                style={{ background: "var(--color-araw)", color: "var(--color-ink)" }}
                aria-label="export snapshot as PDF"
              >
                <Download className="w-4 h-4" strokeWidth={2.2} />
                export / print
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <Users className="text-primary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">
              {snapshot.totalPersons > 0 ? `~${snapshot.totalPersons}` : "—"}
            </div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">People Affected</div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <MapIcon className="text-tertiary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">{snapshot.locations.length}</div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">Active Locations</div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <MessageSquare className="text-primary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">{snapshot.reportCount}</div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">Reports Received</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-error-container text-error rounded-lg">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Critical Needs</h2>
              </div>

              {criticalItems.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ash)" }}>
                  no critical or high-priority items outstanding.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {criticalItems.map(it => {
                    const remaining = it.requested == null ? null : Math.max(0, it.requested - it.packed);
                    const pct = it.requested && it.requested > 0
                      ? Math.min(100, Math.round((it.packed / it.requested) * 100))
                      : null;
                    return (
                      <div
                        key={`${it.name}|${it.unit}`}
                        className="bg-surface-container-low p-6 rounded-lg border-l-4"
                        style={{ borderColor: URGENCY_PILL[it.topUrgency]?.accent ?? "var(--color-tabang)" }}
                      >
                        <div className="text-on-surface-variant mb-4">{iconForItem(it.name)}</div>
                        <h3 className="font-bold text-on-surface mb-1 capitalize">{it.name}</h3>
                        <p className="text-3xl font-headline font-black text-error">
                          {remaining == null ? "?" : remaining}
                          {it.unit && (
                            <span className="text-sm font-sans font-bold text-on-surface-variant uppercase ml-1">
                              {it.unit}
                            </span>
                          )}
                          {it.hasUnknownQty && remaining != null && (
                            <span className="text-sm font-mono font-bold text-on-surface-variant ml-0.5">+?</span>
                          )}
                        </p>
                        {pct != null && (
                          <div className="mt-3">
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-paper-edge)" }}>
                              <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-damay)" }} />
                            </div>
                            <div className="text-[11px] font-mono mt-1" style={{ color: "var(--color-ash)" }}>
                              {it.packed}/{it.requested} packed
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-primary-fixed text-primary rounded-lg">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Other Material Needs</h2>
              </div>
              {otherItems.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ash)" }}>
                  nothing else outstanding at this snapshot.
                </p>
              ) : (
                <div className="space-y-4">
                  {otherItems.map(it => {
                    const remaining = it.requested == null ? null : Math.max(0, it.requested - it.packed);
                    return (
                      <div
                        key={`${it.name}|${it.unit}`}
                        className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-on-surface-variant">{iconForItem(it.name)}</span>
                          <span className="font-bold text-on-surface capitalize">{it.name}</span>
                        </div>
                        <span className="bg-surface-container-highest px-4 py-1 rounded-full font-bold text-on-surface-variant text-sm">
                          {remaining == null ? "qty unknown" : `${remaining}${it.unit ? ` ${it.unit}` : ""}`}
                          {it.hasUnknownQty && remaining != null ? "+?" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <section className="bg-surface-container-high p-8 rounded-xl border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-tertiary-fixed text-tertiary rounded-lg">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-headline font-bold text-on-surface">How Reports Came In</h2>
              </div>
              {channelEntries.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ash)" }}>no reports yet.</p>
              ) : (
                <div className="space-y-4">
                  {channelEntries.map(([ch, count]) => {
                    const meta = CHANNEL_META[ch] ?? { label: ch, icon: <MessageSquare className="w-4 h-4" strokeWidth={1.75} /> };
                    const pct = snapshot.reportCount > 0 ? Math.round((count / snapshot.reportCount) * 100) : 0;
                    return (
                      <div key={ch} className="flex gap-4 items-center">
                        <div className="w-12 h-12 flex-shrink-0 bg-white rounded-full flex items-center justify-center text-tertiary shadow-sm">
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-2xl font-headline font-black text-on-surface">{count}</div>
                            <div className="text-xs font-mono" style={{ color: "var(--color-ash)" }}>{pct}%</div>
                          </div>
                          <div className="text-sm font-bold text-on-surface-variant lowercase">
                            via {meta.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs mt-6" style={{ color: "var(--color-ash)" }}>
                reports arrive through whatever channel is reachable — that's the offline-first guarantee.
              </p>
            </section>

            <section className="bg-primary text-on-primary p-8 rounded-xl shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl font-headline font-bold mb-4">Coordination Info</h2>
                <div className="space-y-4 mb-8">
                  <div className="flex gap-3">
                    <div>
                      <div className="text-xs uppercase font-bold opacity-70 tracking-widest">Brgy. Captain</div>
                      <div className="font-bold">+63 917 XXX XXXX</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <div className="text-xs uppercase font-bold opacity-70 tracking-widest">Location</div>
                      <div className="font-bold">Brgy. Hall, San Roque, Cebu City</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="w-full bg-on-primary text-primary font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-surface transition-all active:scale-95"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? "Copied!" : "Copy summary for sharing"}
                </button>
              </div>
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl"></div>
            </section>

            <div className="text-center md:text-left px-4 py-2 border-t border-outline-variant/30 mt-4">
              <p className="text-xs font-label text-on-surface-variant">
                <span className="font-bold text-primary">Powered by local Gemma 4.</span> Data stays in barangay.
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="max-w-7xl mx-auto px-4 mb-20 md:mb-12">
        <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/30">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-headline font-bold text-on-surface">Active Locations</h3>
            <Link to="/coverage" className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline">
              <ArrowUpRight className="w-4 h-4" />
              Open live map
            </Link>
          </div>
          {snapshot.locations.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: "var(--color-ash)" }}>
              no reports in this snapshot.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-2 pb-2">
              {snapshot.locations.map(l => (
                <div
                  key={l.location}
                  className="p-4 rounded-lg flex flex-col gap-1"
                  style={{
                    background: "var(--color-paper-warm)",
                    border: "1px solid var(--color-paper-edge)",
                    borderLeft: `4px solid ${URGENCY_PILL[l.urgency]?.accent ?? "var(--color-paper-edge)"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" strokeWidth={2} style={{ color: "var(--color-dagat)" }} />
                    <span className="font-bold text-sm" style={{ color: "var(--color-ink)" }}>{l.location}</span>
                  </div>
                  <div className="text-xs font-mono" style={{ color: "var(--color-ash)" }}>
                    {l.urgency} · ~{l.persons} people · {l.reportCount} report{l.reportCount === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="print:hidden">
        <MobileNav />
      </div>
    </div>
  );
}
