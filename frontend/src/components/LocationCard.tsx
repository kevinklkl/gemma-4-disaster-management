import { memo } from "react";
import {
  Users, CheckCircle2, Clock, MapPin, Send,
  Smartphone, Mic, UserCircle, MessageSquare
} from "lucide-react";
import type { LocationCard as LocationCardType, AggregatedItem } from "../types";

const PRIO_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "var(--color-tabang)", fg: "var(--color-bone)", label: "critical" },
  high:     { bg: "var(--color-signal)", fg: "var(--color-bone)", label: "high priority" },
  medium:   { bg: "var(--color-araw)",   fg: "var(--color-ink)",  label: "medium priority" },
  low:      { bg: "var(--color-cloud)",  fg: "var(--color-ash)",  label: "low" },
};

const PRIO_ACCENT: Record<string, string> = {
  critical: "var(--color-tabang)",
  high:     "var(--color-signal)",
  medium:   "var(--color-araw)",
  low:      "var(--color-paper-edge)",
};

type LocationCardProps = {
  card: LocationCardType;
  now: number;
  onToggleItemPacked: (locationKey: string, itemKey: string) => void;
  onUpdateItemPackedQty: (locationKey: string, itemKey: string, qty: number) => void;
  onDispatch: (locationKey: string) => void;
};

function channelIcon(type: string) {
  switch (type) {
    case "sms":    return <Smartphone className="w-3 h-3" strokeWidth={2} />;
    case "voice":  return <Mic className="w-3 h-3" strokeWidth={2} />;
    case "walkin": return <UserCircle className="w-3 h-3" strokeWidth={2} />;
    default:       return <MessageSquare className="w-3 h-3" strokeWidth={2} />;
  }
}

function channelLabel(type: string) {
  switch (type) {
    case "sms":    return "sms";
    case "voice":  return "voice";
    case "walkin": return "walk-in";
    case "manual": return "manual";
    case "mixed":  return "mixed";
    default:       return type;
  }
}

function relativeTime(isoTime: string, now: number): string {
  const ms = now - new Date(isoTime).getTime();
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainMin = minutes % 60;
    return remainMin > 0 ? `${hours}h ${remainMin}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}d ${remainHours}h ago` : `${days}d ago`;
}

function computeProgress(items: AggregatedItem[]): { packed: number; total: number; pct: number; hasUnknown: boolean } {
  let packed = 0;
  let total = 0;
  let hasUnknown = false;
  for (const item of items) {
    if (item.totalQty == null) {
      hasUnknown = true;
      total += 1;
      if (item.totalPacked > 0) packed += 1;
    } else {
      total += item.totalQty;
      packed += item.totalPacked;
    }
  }
  return { packed, total, pct: total > 0 ? (packed / total) * 100 : 0, hasUnknown };
}

function itemIsPacked(item: AggregatedItem): boolean {
  return item.totalQty != null ? item.totalPacked >= item.totalQty : item.totalPacked > 0;
}

export const LocationCard = memo(function LocationCard({ card, now, onToggleItemPacked, onUpdateItemPackedQty, onDispatch }: LocationCardProps) {
  const progress = computeProgress(card.items);
  const allPacked = card.items.every(itemIsPacked);
  const somePacked = card.items.some(i => i.totalPacked > 0);

  const accent = PRIO_ACCENT[card.urgency] ?? PRIO_ACCENT.medium;
  const pill = PRIO_PILL[card.urgency] ?? PRIO_PILL.medium;

  const idDisplay = card.messageIds.length > 0
    ? `ORD-${card.messageIds[0]}${card.messageIds.length > 1 ? ` +${card.messageIds.length - 1}` : ""}`
    : "ORD-—";

  return (
    <div
      className="rounded-[10px] overflow-hidden flex flex-col"
      style={{
        background: "var(--color-paper-warm)",
        border: "1px solid var(--color-paper-edge)",
        boxShadow: "var(--shadow-1)",
        borderStyle: card.isSplitRemainder ? "dashed" : "solid",
      }}
    >
      <div style={{ height: 5, background: accent }} />

      <div className="px-5 pt-4 pb-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              className="font-display font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
            >
              {idDisplay}
            </div>
            <div
              className="inline-flex items-center gap-1.5 mt-1 text-[13px]"
              style={{ color: "var(--color-ash)", wordBreak: "keep-all", overflowWrap: "anywhere" }}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>{card.location}</span>
              {card.isSplitRemainder && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: "var(--color-paper-deep)", color: "var(--color-ash)" }}
                >
                  remainder
                </span>
              )}
            </div>
          </div>

          <div
            className="inline-flex flex-col items-end gap-0.5 rounded-lg px-2 py-1 shrink-0 whitespace-nowrap"
            style={{ background: "var(--color-paper)", border: "1px solid var(--color-paper-edge)" }}
          >
            <span className="ak-caps" style={{ fontSize: 9, color: "var(--color-ash)" }}>last updated</span>
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-mono)" }}
            >
              <Clock className="w-2.5 h-2.5" strokeWidth={2.2} />
              {card.receivedAt ? relativeTime(card.receivedAt, now) : "—"}
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 12px",
              borderRadius: 999,
              background: pill.bg,
              color: pill.fg,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              lineHeight: 1,
            }}
          >
            {pill.label}
          </span>
        </div>

        {progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-full h-1.5 overflow-hidden"
              style={{ background: "var(--color-paper)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.pct}%`, background: "var(--color-damay)" }}
              />
            </div>
            <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--color-ash)" }}>
              {Math.round(progress.pct)}%
              {progress.hasUnknown && <span className="ml-0.5">+?</span>}
            </span>
          </div>
        )}

        {card.items.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {card.items.map(item => {
              const isFullyPacked = itemIsPacked(item);
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2"
                  style={{
                    background: "var(--color-paper)",
                    border: "1px solid var(--color-paper-edge)",
                  }}
                >
                  <button
                    onClick={() => onToggleItemPacked(card.locationKey, item.key)}
                    className="w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isFullyPacked ? "var(--color-damay)" : "transparent",
                      border: `1.5px solid ${isFullyPacked ? "var(--color-damay)" : "var(--color-paper-edge)"}`,
                      color: "var(--color-bone)",
                    }}
                  >
                    {isFullyPacked && <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={3} />}
                  </button>
                  <span
                    className="flex-1 text-[14px] min-w-0 truncate"
                    style={{
                      color: "var(--color-ink)",
                      textDecoration: isFullyPacked ? "line-through" : "none",
                      opacity: isFullyPacked ? 0.6 : 1,
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[13px] whitespace-nowrap inline-flex items-center gap-1"
                    style={{ color: "var(--color-ash)", fontFamily: "var(--font-mono)" }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={item.totalQty ?? undefined}
                      value={item.totalPacked === 0 ? "" : item.totalPacked}
                      placeholder="0"
                      onChange={(e) => onUpdateItemPackedQty(card.locationKey, item.key, parseInt(e.target.value) || 0)}
                      className="w-9 text-center rounded outline-none"
                      style={{
                        background: "transparent",
                        color: item.totalPacked > 0 ? "var(--color-ink)" : "var(--color-ash)",
                        fontWeight: 600,
                        border: "1px solid transparent",
                        fontFamily: "inherit",
                      }}
                    />
                    <span style={{ opacity: 0.5 }}>/</span>
                    <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>{item.totalQty ?? "?"}</span>
                    {item.unit && <span className="ml-0.5">{item.unit}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-4 pb-4 pt-1">
        <button
          disabled={!somePacked}
          onClick={() => onDispatch(card.locationKey)}
          className="w-full rounded-lg py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          style={
            allPacked
              ? { background: "var(--color-dagat)", color: "var(--color-bone)" }
              : somePacked
                ? { background: "var(--color-araw)", color: "var(--color-ink)" }
                : { background: "var(--color-paper)", color: "var(--color-ash)", border: "1px solid var(--color-paper-edge)", cursor: "default" }
          }
        >
          {allPacked ? (
            <>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              ready for dispatch
            </>
          ) : somePacked ? (
            <>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              dispatch partial
            </>
          ) : (
            "pack items to dispatch"
          )}
        </button>
      </div>
    </div>
  );
});
