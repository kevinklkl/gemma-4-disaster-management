import { useState, useEffect, useRef, useMemo } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { LocationCard as LocationCardComponent } from "../components/LocationCard";
import { CheckCircle2, Box, ClipboardList } from "lucide-react";
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
    fetch("/api/messages")
      .then(r => r.json())
      .then((msgs: ApiMessage[]) => setMessages(msgs))
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

    const newTotal = (item.totalQty != null && item.totalPacked >= item.totalQty) ? 0 : (item.totalQty ?? 0);
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
      .filter(i => i.totalQty == null || i.totalPacked < i.totalQty)
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
              <h1 className="font-headline font-bold text-2xl text-primary leading-relaxed">
                Needs & Dispatch Display System (NDS)
              </h1>
              <p className="text-on-surface-variant text-sm font-medium">Real-time synced dispatch fulfillment view.</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 border transition-colors ${
              wsConnected
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-yellow-100 text-yellow-700 border-yellow-200"
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${wsConnected ? "bg-primary" : "bg-yellow-500"}`}></span>
              {wsConnected ? "Live" : "Reconnecting…"}
            </div>
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
              <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-headline font-black text-on-surface mb-3">All Clear!</h2>
              <p className="text-on-surface-variant text-lg">No pending dispatches at the moment. Great job!</p>
            </div>
          )}
        </main>

        <aside className="w-[340px] xl:w-[400px] border-l border-outline-variant/20 bg-surface flex flex-col shrink-0 hidden md:flex z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-outline-variant/10 bg-surface-bright">
            <h2 className="font-headline font-bold text-xl inline-flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              Aggregated Needs
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">Remaining unpacked items across all locations.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {aggregatedNeeds.length === 0 ? (
              <p className="text-center text-on-surface-variant text-sm py-8">No active dispatches.</p>
            ) : (
              <ul className="space-y-3">
                {aggregatedNeeds.map(item => (
                  <li
                    key={`${item.name}-${item.unit}`}
                    className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10"
                  >
                    <div className="font-bold text-on-surface">
                      {item.name}
                      {item.unit && <span className="ml-2 text-xs font-normal text-on-surface-variant">({item.unit})</span>}
                    </div>
                    <div className="text-2xl font-black text-primary">
                      {item.remaining}
                      {item.hasUnknownQty && <span className="ml-1 text-sm text-on-surface-variant">+?</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 bg-surface-container-low border-t border-outline-variant/10">
            <button className="w-full py-3 bg-surface text-on-surface font-bold rounded-lg border border-outline-variant shadow-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
              <ClipboardList className="w-4 h-4" /> Print Fulfillment Picklist
            </button>
          </div>
        </aside>
      </div>

      <MobileNav />
    </div>
  );
}
