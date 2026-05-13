import { useState, useEffect, useRef, useMemo } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { LocationCard as LocationCardComponent } from "../components/LocationCard";
import { CheckCircle2, ClipboardList } from "lucide-react";
import type { ApiMessage, ApiLocation, LocationCard, AggregatedItem, ItemSource } from "../types";

const URGENCY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function formatLocation(loc: ApiLocation): string {
  if (!loc) return "Unknown";
  if (typeof loc === "string") return loc;
  const parts = [loc.barangay, loc.city, loc.province].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

function aggregateByLocation(messages: ApiMessage[]): LocationCard[] {
  const processed = messages.filter(m => m.status === "processed" && m.extractedData);
  const groups = new Map<string, ApiMessage[]>();

  for (const msg of processed) {
    const loc = formatLocation(msg.extractedData?.location ?? null);
    if (loc === "Unknown") {
      groups.set(`__unknown_${msg.id}`, [msg]);
    } else {
      const existing = groups.get(loc);
      if (existing) existing.push(msg);
      else groups.set(loc, [msg]);
    }
  }

  const cards: LocationCard[] = [];

  for (const [key, msgs] of groups) {
    const isUnknown = key.startsWith("__unknown_");
    const location = isUnknown ? "Unknown" : key;

    let highestUrgency = "low";
    let totalPersons = 0;
    let oldestTime = "";
    const messageIds: string[] = [];
    const contents: string[] = [];
    const channelCounts = new Map<string, number>();
    const itemMap = new Map<string, AggregatedItem>();

    for (const msg of msgs) {
      const ed = msg.extractedData!;
      messageIds.push(msg.id);
      if (msg.content) contents.push(msg.content);

      if ((URGENCY_WEIGHT[ed.urgency] ?? 0) > (URGENCY_WEIGHT[highestUrgency] ?? 0)) {
        highestUrgency = ed.urgency;
      }
      totalPersons += ed.persons ?? 0;

      if (!oldestTime || msg.time < oldestTime) {
        oldestTime = msg.time;
      }

      const ch = msg.type || "sms";
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);

      for (let i = 0; i < ed.items.length; i++) {
        const item = ed.items[i];
        const canonical = item.canonical || item.name.toLowerCase();
        const unit = item.unit || "";
        const mapKey = `${canonical}|${unit}`;
        const packedQty = msg.packingState?.[String(i)] ?? 0;

        const source: ItemSource = {
          msgId: msg.id,
          itemIndex: i,
          qty: item.qty,
          packedQty,
        };

        if (itemMap.has(mapKey)) {
          const agg = itemMap.get(mapKey)!;
          if (item.qty != null) {
            agg.totalQty = (agg.totalQty ?? 0) + item.qty;
          }
          agg.totalPacked += packedQty;
          agg.sources.push(source);
        } else {
          itemMap.set(mapKey, {
            key: mapKey,
            name: item.name,
            canonical: item.canonical ?? null,
            unit: item.unit ?? null,
            totalQty: item.qty,
            totalPacked: packedQty,
            sources: [source],
          });
        }
      }
    }

    let topChannel = "sms";
    let topCount = 0;
    for (const [ch, count] of channelCounts) {
      if (count > topCount) { topChannel = ch; topCount = count; }
    }
    if (channelCounts.size > 1) topChannel = "mixed";

    cards.push({
      locationKey: key,
      location,
      urgency: highestUrgency,
      totalPersons,
      receivedAt: oldestTime,
      items: Array.from(itemMap.values()),
      messageIds,
      contents,
      channel: topChannel,
      isUnknownLocation: isUnknown,
      isSplitRemainder: false,
    });
  }

  return cards;
}

function sortCards(cards: LocationCard[]): LocationCard[] {
  return [...cards].sort((a, b) => {
    const urgDiff = (URGENCY_WEIGHT[b.urgency] ?? 0) - (URGENCY_WEIGHT[a.urgency] ?? 0);
    if (urgDiff !== 0) return urgDiff;
    const aTime = a.receivedAt ? new Date(a.receivedAt).getTime() : Infinity;
    const bTime = b.receivedAt ? new Date(b.receivedAt).getTime() : Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return b.items.length - a.items.length;
  });
}

function distributePacked(sources: ItemSource[], newTotal: number): ItemSource[] {
  const sorted = [...sources].sort((a, b) => {
    const aMsgId = parseInt(a.msgId) || 0;
    const bMsgId = parseInt(b.msgId) || 0;
    return aMsgId - bMsgId;
  });

  let remaining = Math.max(0, newTotal);
  return sorted.map(src => {
    const cap = src.qty ?? Infinity;
    const give = Math.min(remaining, cap);
    remaining -= give;
    return { ...src, packedQty: give };
  });
}

export function Dashboard() {
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [splitRemainders, setSplitRemainders] = useState<LocationCard[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(true);
  const packingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const apiMessagesRef = useRef<ApiMessage[]>([]);

  const setMessages = (updater: ApiMessage[] | ((prev: ApiMessage[]) => ApiMessage[])) => {
    setApiMessages(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      apiMessagesRef.current = next;
      return next;
    });
  };

  const fetchMessages = () => {
    fetch("/api/messages?limit=1000")
      .then(r => r.json())
      .then((data: { messages: ApiMessage[] }) => setMessages(data.messages))
      .catch(console.error);
  };

  useEffect(() => {
    reconnectRef.current = true;
    fetchMessages();

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "packing_update") {
            setMessages(prev => prev.map(m =>
              m.id !== String(msg.msgId) ? m : {
                ...m,
                packingState: { ...m.packingState, [String(msg.itemIndex)]: msg.packedQty },
              }
            ));
          } else if (msg.type === "processing_done") {
            fetchMessages();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (reconnectRef.current) setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    const onFocus = () => fetchMessages();
    window.addEventListener("focus", onFocus);

    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      reconnectRef.current = false;
      wsRef.current?.close();
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);

  const locationCards = useMemo(() => {
    const fromApi = aggregateByLocation(apiMessages);
    const all = [...fromApi, ...splitRemainders];
    return sortCards(all);
  }, [apiMessages, splitRemainders]);

  const handleToggleItemPacked = (locationKey: string, itemKey: string) => {
    const card = locationCards.find(c => c.locationKey === locationKey);
    const item = card?.items.find(i => i.key === itemKey);
    if (!card || !item) return;

    const isPacked = item.totalQty != null
      ? item.totalPacked >= item.totalQty
      : item.totalPacked > 0;
    const newTotal = isPacked ? 0 : (item.totalQty ?? 1);
    applyPackingUpdate(card, item, newTotal);
  };

  const handleUpdateItemPackedQty = (locationKey: string, itemKey: string, qty: number) => {
    const card = locationCards.find(c => c.locationKey === locationKey);
    const item = card?.items.find(i => i.key === itemKey);
    if (!card || !item) return;

    const clamped = Math.max(0, item.totalQty != null ? Math.min(item.totalQty, qty) : qty);
    applyPackingUpdate(card, item, clamped);
  };

  const applyPackingUpdate = (card: LocationCard, item: AggregatedItem, newTotal: number) => {
    if (card.isSplitRemainder) {
      setSplitRemainders(prev => prev.map(c =>
        c.locationKey !== card.locationKey ? c : {
          ...c,
          items: c.items.map(i => i.key !== item.key ? i : { ...i, totalPacked: newTotal }),
        }
      ));
      return;
    }

    const distributed = distributePacked(item.sources, newTotal);

    setMessages(prev => {
      let updated = prev;
      for (const src of distributed) {
        const orig = item.sources.find(s => s.msgId === src.msgId && s.itemIndex === src.itemIndex);
        if (orig && orig.packedQty !== src.packedQty) {
          updated = updated.map(m =>
            m.id !== src.msgId ? m : {
              ...m,
              packingState: { ...m.packingState, [String(src.itemIndex)]: src.packedQty },
            }
          );
        }
      }
      return updated;
    });

    for (const src of distributed) {
      const orig = item.sources.find(s => s.msgId === src.msgId && s.itemIndex === src.itemIndex);
      if (orig && orig.packedQty !== src.packedQty) {
        const timerKey = `${src.msgId}-${src.itemIndex}`;
        const existing = packingTimers.current.get(timerKey);
        if (existing) clearTimeout(existing);
        packingTimers.current.set(timerKey, setTimeout(() => {
          fetch(`/api/messages/${src.msgId}/packing`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemIndex: src.itemIndex, packedQty: src.packedQty }),
          }).catch(console.error);
          packingTimers.current.delete(timerKey);
        }, 400));
      }
    }
  };

  const handleDispatch = async (locationKey: string) => {
    const card = locationCards.find(c => c.locationKey === locationKey);
    if (!card) return;

    const unpackedItems = card.items
      .filter(i => i.totalQty != null ? i.totalPacked < i.totalQty : i.totalPacked === 0)
      .map(i => ({
        ...i,
        totalQty: i.totalQty != null ? i.totalQty - i.totalPacked : i.totalQty,
        totalPacked: 0,
        sources: [],
      }));

    if (card.isSplitRemainder) {
      if (unpackedItems.length > 0) {
        setSplitRemainders(prev => prev.map(c =>
          c.locationKey !== card.locationKey ? c : { ...c, items: unpackedItems }
        ));
      } else {
        setSplitRemainders(prev => prev.filter(c => c.locationKey !== card.locationKey));
      }
      return;
    }

    for (const msgId of card.messageIds) {
      try {
        await fetch(`/api/messages/${msgId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "fulfilled" }),
        });
      } catch (e) {
        console.error(`Failed to mark message ${msgId} as fulfilled:`, e);
      }
    }

    setMessages(prev => prev.filter(m => !card.messageIds.includes(m.id)));

    if (unpackedItems.length > 0) {
      const remainder: LocationCard = {
        locationKey: `${card.locationKey}__remainder_${Date.now()}`,
        location: card.location,
        urgency: card.urgency,
        totalPersons: card.totalPersons,
        receivedAt: new Date().toISOString(),
        items: unpackedItems,
        messageIds: [],
        contents: [],
        channel: card.channel,
        isUnknownLocation: card.isUnknownLocation,
        isSplitRemainder: true,
      };
      setSplitRemainders(prev => [...prev, remainder]);
    }
  };

  const aggregatedNeeds = useMemo(() => {
    const acc: Record<string, { name: string; unit: string; remaining: number; hasUnknownQty: boolean }> = {};

    for (const card of locationCards) {
      for (const item of card.items) {
        const groupKey = item.canonical || item.name.toLowerCase();
        const unit = item.unit || "";
        const key = `${groupKey}|${unit}`;
        if (!acc[key]) {
          acc[key] = { name: item.name, unit, remaining: 0, hasUnknownQty: false };
        }
        if (item.totalQty == null) {
          acc[key].hasUnknownQty = true;
        } else {
          acc[key].remaining += item.totalQty - item.totalPacked;
        }
      }
    }

    return Object.values(acc)
      .filter(i => i.remaining > 0 || i.hasUnknownQty)
      .sort((a, b) => b.remaining - a.remaining);
  }, [locationCards]);

  return (
    <div className="h-screen bg-surface-container-low font-body text-on-surface flex flex-col overflow-hidden">
      <TopNav />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1
                className="font-display font-bold leading-tight"
                style={{ fontSize: 30, color: "var(--color-ink-soft)", letterSpacing: "-0.025em", margin: 0 }}
              >
                pulso
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
                real-time synced fulfillment view. needs matched against stocked supplies.
              </p>
            </div>
            {wsConnected ? (
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold shrink-0"
                style={{
                  background: "rgba(56,107,74,0.15)",
                  color: "var(--color-damay)",
                  border: "1px solid rgba(56,107,74,0.35)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--color-damay)", animation: "akbay-pulse 2s ease-in-out infinite" }}
                />
                live
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full shrink-0 ak-caps"
                style={{ background: "var(--color-tabang)", color: "var(--color-bone)" }}
              >
                OFFLINE
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
            {locationCards.map(card => (
              <LocationCardComponent
                key={card.locationKey}
                card={card}
                now={now}
                onToggleItemPacked={handleToggleItemPacked}
                onUpdateItemPackedQty={handleUpdateItemPackedQty}
                onDispatch={handleDispatch}
              />
            ))}
          </div>

          {locationCards.length === 0 && (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                style={{ background: "var(--color-damay-soft)", color: "var(--color-damay)" }}
              >
                <CheckCircle2 className="w-10 h-10" strokeWidth={1.75} />
              </div>
              <h2 className="font-display font-bold mb-2" style={{ fontSize: 26, color: "var(--color-ink-soft)", letterSpacing: "-0.02em" }}>
                all clear
              </h2>
              <p className="text-sm" style={{ color: "var(--color-ash)" }}>
                no pending dispatches. the queue is quiet.
              </p>
            </div>
          )}
        </main>

        <aside
          className="w-[340px] xl:w-[400px] flex flex-col shrink-0 hidden md:flex z-10"
          style={{ background: "var(--color-paper-warm)", borderLeft: "1px solid var(--color-paper-edge)" }}
        >
          <div className="p-6" style={{ borderBottom: "1px solid var(--color-paper-edge)" }}>
            <h2
              className="font-display font-bold inline-flex items-center gap-2"
              style={{ fontSize: 20, color: "var(--color-ink-soft)", letterSpacing: "-0.015em", lineHeight: 1.15 }}
            >
              <ClipboardList className="w-5 h-5" strokeWidth={1.75} style={{ color: "var(--color-ash)" }} />
              aggregated needs
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--color-ash)" }}>
              remaining unpacked items across all active dispatches.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {aggregatedNeeds.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: "var(--color-ash)" }}>
                no active dispatches.
              </p>
            ) : (
              <ul>
                {aggregatedNeeds.map((item, idx) => (
                  <li
                    key={`${item.name}-${item.unit}`}
                    className="flex justify-between items-baseline py-2.5"
                    style={idx === 0 ? {} : { borderTop: "1px solid var(--color-paper-edge)" }}
                  >
                    <div className="text-sm" style={{ color: "var(--color-ink)" }}>
                      {item.name}
                      {item.unit && (
                        <span className="ml-1 text-[11px]" style={{ color: "var(--color-ash)", fontFamily: "var(--font-mono)" }}>
                          ({item.unit})
                        </span>
                      )}
                    </div>
                    <div
                      className="font-display font-bold"
                      style={{ fontSize: 18, color: "var(--color-ink)", letterSpacing: "-0.01em" }}
                    >
                      {item.remaining}
                      {item.hasUnknownQty && (
                        <sub style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--color-ash)", verticalAlign: "baseline", marginLeft: 2 }}>
                          +?
                        </sub>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4" style={{ borderTop: "1px solid var(--color-paper-edge)" }}>
            <button
              className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{
                background: "var(--color-paper)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-paper-edge)",
              }}
            >
              <ClipboardList className="w-4 h-4" strokeWidth={1.75} />
              print fulfillment picklist
            </button>
          </div>
        </aside>
      </div>

      <MobileNav />

      <style>{`@keyframes akbay-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}
