import {
  Users, CheckCircle2, Clock, MapPin, Send, Package,
  Smartphone, Mic, UserCircle, MessageSquare
} from "lucide-react";
import type { LocationCard as LocationCardType, AggregatedItem } from "../types";

type LocationCardProps = {
  card: LocationCardType;
  now: number;
  onToggleItemPacked: (locationKey: string, itemKey: string) => void;
  onUpdateItemPackedQty: (locationKey: string, itemKey: string, qty: number) => void;
  onDispatch: (locationKey: string) => void;
};

const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-[#DC2626] text-white",
  high: "bg-[#EA580C] text-white",
  medium: "bg-[#D97706] text-white",
  low: "bg-[#65a30d] text-white",
};

const URGENCY_BORDER: Record<string, string> = {
  critical: "border-t-[#DC2626]",
  high: "border-t-[#EA580C]",
  medium: "border-t-[#D97706]",
  low: "border-t-[#65a30d]",
};

function channelIcon(type: string) {
  switch (type) {
    case "sms": return <Smartphone className="w-3.5 h-3.5" />;
    case "voice": return <Mic className="w-3.5 h-3.5" />;
    case "walkin": return <UserCircle className="w-3.5 h-3.5" />;
    default: return <MessageSquare className="w-3.5 h-3.5" />;
  }
}

function channelLabel(type: string) {
  switch (type) {
    case "sms": return "SMS";
    case "voice": return "Voice";
    case "walkin": return "Walk-in";
    case "manual": return "Manual";
    default: return type;
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
    } else {
      total += item.totalQty;
      packed += item.totalPacked;
    }
  }
  return { packed, total, pct: total > 0 ? (packed / total) * 100 : 0, hasUnknown };
}

export function LocationCard({ card, now, onToggleItemPacked, onUpdateItemPackedQty, onDispatch }: LocationCardProps) {
  const progress = computeProgress(card.items);
  const allPacked = card.items.every(i => i.totalQty != null && i.totalPacked >= i.totalQty);
  const somePacked = card.items.some(i => i.totalPacked > 0);

  const urgencyBadge = URGENCY_BADGE[card.urgency] ?? URGENCY_BADGE.medium;
  const urgencyBorder = URGENCY_BORDER[card.urgency] ?? URGENCY_BORDER.medium;

  const msgIdDisplay = card.messageIds.length > 0
    ? card.messageIds.map(id => `#${id}`).join(", ")
    : null;

  const snippet = card.contents.length > 0 ? card.contents[0] : null;
  const moreCount = card.contents.length > 1 ? card.contents.length - 1 : 0;

  return (
    <div className={`bg-surface-bright rounded-xl custom-shadow border-t-[6px] flex flex-col overflow-hidden transition-all ${urgencyBorder} ${card.isSplitRemainder ? "border-t-dashed" : ""}`}>
      {/* Header */}
      <div className="p-5 border-b border-outline-variant/10 bg-gradient-to-b from-surface-container-lowest to-surface flex flex-col gap-2">
        {/* Row 1: Location + msg IDs */}
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-headline font-black text-xl text-on-surface tracking-tight leading-snug flex items-start gap-1.5 min-w-0">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <span className="break-words">{card.location}</span>
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {card.isSplitRemainder && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-outline-variant/20 text-on-surface-variant">
                Remainder
              </span>
            )}
            {msgIdDisplay && (
              <span className="text-[11px] text-on-surface-variant/50 font-mono whitespace-nowrap">
                {msgIdDisplay}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Channel, people, items, time, urgency */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold text-on-surface-variant">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary">
            {channelIcon(card.channel)}
            {channelLabel(card.channel)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {card.totalPersons > 0 ? `${card.totalPersons} People` : "Unknown"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {card.items.length} {card.items.length === 1 ? "item" : "items"}
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            {card.receivedAt ? relativeTime(card.receivedAt, now) : "Unknown"}
          </span>
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm ${urgencyBadge}`}>
            {card.urgency}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1">
          {progress.total > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-container rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-primary"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant whitespace-nowrap">
                {Math.round(progress.pct)}%
                {progress.hasUnknown && <span className="ml-0.5 text-on-surface-variant/50">+?</span>}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-on-surface-variant/60 italic">Quantities unknown</p>
          )}
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-outline-variant/10">
          {card.items.map((item, idx) => {
            const isFullyPacked = item.totalQty != null && item.totalPacked >= item.totalQty;
            return (
              <li
                key={item.key}
                className={`p-4 flex items-start gap-4 transition-colors ${
                  isFullyPacked
                    ? "opacity-50 bg-surface-container-lowest grayscale"
                    : idx % 2 === 0
                    ? "bg-surface-bright"
                    : "bg-surface-container-lowest"
                }`}
              >
                <button
                  onClick={() => onToggleItemPacked(card.locationKey, item.key)}
                  className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors hover:border-primary ${
                    isFullyPacked
                      ? "border-primary bg-primary text-on-primary"
                      : item.totalPacked > 0
                      ? "border-primary text-primary bg-primary/10"
                      : "border-outline-variant text-transparent bg-surface-bright"
                  }`}
                >
                  {isFullyPacked ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : item.totalPacked > 0 ? (
                    <span className="text-sm font-black">-</span>
                  ) : null}
                </button>
                <div className="flex-1 overflow-hidden">
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-3">
                    <p className={`font-bold text-[1.1rem] leading-snug flex-1 min-w-0 break-words ${
                      isFullyPacked ? "line-through text-on-surface-variant" : "text-on-surface"
                    }`}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 font-black text-xl sm:text-2xl leading-none bg-surface-container px-2 py-1.5 shrink-0 rounded-lg whitespace-nowrap overflow-hidden">
                      <input
                        type="number"
                        min="0"
                        max={item.totalQty ?? undefined}
                        value={item.totalPacked === 0 ? "" : item.totalPacked}
                        placeholder="0"
                        onChange={(e) => onUpdateItemPackedQty(card.locationKey, item.key, parseInt(e.target.value) || 0)}
                        className={`w-10 sm:w-16 bg-surface-container-low text-center focus:ring-2 focus:ring-primary outline-none border-none rounded ${
                          item.totalPacked > 0 ? "text-primary" : "text-on-surface-variant"
                        }`}
                      />
                      <span className="text-on-surface-variant opacity-40 font-bold text-lg sm:text-xl">/</span>
                      <span className={isFullyPacked ? "text-on-surface-variant" : "text-on-surface"}>
                        {item.totalQty ?? "?"}
                      </span>
                      {item.unit && (
                        <span className="text-sm font-bold text-on-surface-variant/60 ml-0.5">{item.unit}</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Message snippet */}
      {snippet && (
        <div className="px-5 py-2.5 border-t border-outline-variant/10 bg-surface-container-lowest/50">
          <p className="text-xs text-on-surface-variant/70 italic truncate leading-relaxed">
            &ldquo;{snippet.length > 120 ? snippet.slice(0, 120) + "…" : snippet}&rdquo;
            {moreCount > 0 && (
              <span className="ml-1.5 not-italic font-bold text-on-surface-variant/50">
                (+{moreCount} more)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10">
        <button
          disabled={!somePacked}
          onClick={() => onDispatch(card.locationKey)}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            allPacked
              ? "bg-primary text-on-primary shadow-lg hover:brightness-110 active:scale-95"
              : somePacked
              ? "bg-tertiary text-on-tertiary shadow-lg hover:brightness-110 active:scale-95"
              : "bg-surface-container text-on-surface-variant opacity-70 cursor-not-allowed"
          }`}
        >
          {allPacked ? (
            <><Send className="w-5 h-5" /> Ready for Dispatch</>
          ) : somePacked ? (
            <><Send className="w-5 h-5" /> Dispatch Partial</>
          ) : (
            "Pack items to dispatch"
          )}
        </button>
      </div>
    </div>
  );
}
