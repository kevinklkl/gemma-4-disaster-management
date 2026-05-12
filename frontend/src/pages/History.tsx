import { useEffect, useMemo, useState } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { Clock, MapPin, Users, CheckCircle2, Smartphone, Mic, UserCircle, MessageSquare } from "lucide-react";
import type { ApiMessage } from "../types";
import { aggregateByLocation, sortCards } from "../utils/aggregate";

type Window = "today" | "week" | "all";

function channelIcon(type: string) {
  switch (type) {
    case "sms":    return <Smartphone className="w-3 h-3" strokeWidth={2} />;
    case "voice":  return <Mic className="w-3 h-3" strokeWidth={2} />;
    case "walkin": return <UserCircle className="w-3 h-3" strokeWidth={2} />;
    default:       return <MessageSquare className="w-3 h-3" strokeWidth={2} />;
  }
}

function channelLabel(type: string) {
  if (type === "sms") return "sms";
  if (type === "walkin") return "walk-in";
  return type;
}

function formatStamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (day.getTime() === today.getTime()) return `today · ${time}`;
  if (day.getTime() === yest.getTime())  return `yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function withinWindow(iso: string, w: Window): boolean {
  if (w === "all") return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const now = Date.now();
  const span = w === "today" ? 24 * 3600_000 : 7 * 24 * 3600_000;
  return now - t <= span;
}

export function History() {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [window_, setWindow] = useState<Window>("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/messages/history")
      .then(r => r.json())
      .then((msgs: ApiMessage[]) => setMessages(msgs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = useMemo(() => {
    const filtered = messages.filter(m => withinWindow(m.time, window_));
    return sortCards(aggregateByLocation(filtered));
  }, [messages, window_]);

  return (
    <div className="h-screen font-body flex flex-col overflow-hidden" style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}>
      <TopNav />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <h1
              className="font-display font-bold leading-tight"
              style={{ fontSize: 30, color: "var(--color-ink-soft)", letterSpacing: "-0.025em", margin: 0 }}
            >
              history
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
              the archive: resolved records, completed dispatches.
            </p>
          </div>
          <div
            className="inline-flex p-[3px] rounded-full self-start sm:self-auto"
            style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
          >
            {([
              ["today", "today"],
              ["week",  "this week"],
              ["all",   "all time"],
            ] as Array<[Window, string]>).map(([w, label]) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className="px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-colors"
                style={
                  window_ === w
                    ? { background: "var(--color-paper)", color: "var(--color-ink)", boxShadow: "var(--shadow-1)", border: "none" }
                    : { background: "transparent", color: "var(--color-ash)", border: "none", cursor: "pointer" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm py-12 text-center" style={{ color: "var(--color-ash)" }}>loading…</p>
        ) : cards.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--color-paper-warm)", color: "var(--color-ash)" }}
            >
              <Clock className="w-7 h-7" strokeWidth={1.75} />
            </div>
            <h2 className="font-display font-bold mb-1" style={{ fontSize: 22, color: "var(--color-ink-soft)", letterSpacing: "-0.015em" }}>
              nothing in the archive yet
            </h2>
            <p className="text-sm" style={{ color: "var(--color-ash)" }}>
              {window_ === "today" ? "no records resolved today." : window_ === "week" ? "no records resolved this week." : "no records resolved."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {cards.map(card => {
              const itemCount = card.items.length;
              return (
                <div
                  key={card.locationKey}
                  className="rounded-[10px] overflow-hidden flex flex-col"
                  style={{
                    background: "var(--color-paper-warm)",
                    border: "1px solid var(--color-paper-edge)",
                    boxShadow: "var(--shadow-1)",
                  }}
                >
                  <div style={{ height: 5, background: "var(--color-paper-edge)" }} />
                  <div className="px-5 pt-4 pb-4 flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-display font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
                        >
                          {card.messageIds.length > 0 ? `ORD-${card.messageIds[0]}` : "ORD-—"}
                          {card.messageIds.length > 1 && (
                            <span className="ml-1.5 text-[13px] font-medium" style={{ color: "var(--color-ash)" }}>
                              +{card.messageIds.length - 1}
                            </span>
                          )}
                        </div>
                        <div
                          className="inline-flex items-center gap-1.5 mt-1 text-[13px]"
                          style={{ color: "var(--color-ash)", wordBreak: "keep-all", overflowWrap: "anywhere" }}
                        >
                          <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                          <span>{card.location}</span>
                        </div>
                      </div>
                      <div
                        className="inline-flex flex-col items-end gap-0.5 rounded-lg px-2 py-1 shrink-0 whitespace-nowrap"
                        style={{ background: "var(--color-paper)", border: "1px solid var(--color-paper-edge)" }}
                      >
                        <span className="ak-caps" style={{ fontSize: 9, color: "var(--color-ash)" }}>delivered</span>
                        <span
                          className="inline-flex items-center gap-1 text-[11px]"
                          style={{ color: "var(--color-ink)", fontFamily: "var(--font-mono)" }}
                        >
                          <Clock className="w-2.5 h-2.5" strokeWidth={2.2} />
                          {formatStamp(card.receivedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]" style={{ color: "var(--color-ash)" }}>
                        <Users className="w-3.5 h-3.5" strokeWidth={2} />
                        {card.totalPersons > 0
                          ? `${card.totalPersons} ${card.totalPersons === 1 ? "person" : "people"}`
                          : "households unknown"}
                        <span className="inline-flex items-center gap-1 ml-2">
                          {channelIcon(card.channel)}
                          <span>{channelLabel(card.channel)}</span>
                        </span>
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{
                          padding: "5px 12px",
                          borderRadius: 999,
                          background: "var(--color-damay-soft)",
                          color: "var(--color-damay)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          lineHeight: 1,
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        resolved
                      </span>
                    </div>

                    {itemCount > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {card.items.slice(0, 4).map(item => (
                          <li
                            key={item.key}
                            className="flex items-center gap-2.5 rounded-md px-3 py-2"
                            style={{ background: "var(--color-paper)", border: "1px solid var(--color-paper-edge)" }}
                          >
                            <span
                              className="w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0"
                              style={{ background: "var(--color-damay)", color: "var(--color-bone)" }}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={3} />
                            </span>
                            <span
                              className="flex-1 text-[14px] min-w-0 truncate"
                              style={{ color: "var(--color-ink)", textDecoration: "line-through", opacity: 0.6 }}
                            >
                              {item.name}
                            </span>
                            <span
                              className="text-[13px] whitespace-nowrap"
                              style={{ color: "var(--color-ash)", fontFamily: "var(--font-mono)" }}
                            >
                              <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                                {item.totalQty ?? "?"}
                              </span>
                              {item.unit && <span className="ml-1">{item.unit}</span>}
                            </span>
                          </li>
                        ))}
                        {itemCount > 4 && (
                          <li className="text-xs px-3 py-1" style={{ color: "var(--color-ash)" }}>
                            +{itemCount - 4} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}
