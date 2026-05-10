import { useState, useEffect, useRef } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import {
  Users, CheckCircle2, Clock, MapPin, Send, Box, ClipboardList
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  qty: number;
  packedQty: number;
};

type Order = {
  id: string;
  msgId?: string;
  location: string;
  lastUpdated: string;
  urgency: string;
  persons: number;
  status: "packing" | "ready";
  items: Item[];
};

type ApiMessage = {
  id: string;
  type: string;
  source: string;
  time: string;
  content: string;
  status: string;
  packingState: Record<string, number>;
  extractedData: {
    location: string;
    urgency: string;
    persons: number;
    items: { name: string; qty: number }[];
  } | null;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function messageToOrder(msg: ApiMessage): Order {
  return {
    id: `ORD-${msg.id}`,
    msgId: msg.id,
    location: msg.extractedData?.location || "Unknown",
    lastUpdated: `Today, ${formatTime(msg.time)}`,
    urgency: msg.extractedData?.urgency || "medium",
    persons: msg.extractedData?.persons || 0,
    status: "packing",
    items: (msg.extractedData?.items || []).map((item, i) => ({
      id: `${msg.id}-${i}`,
      name: item.name,
      qty: item.qty,
      packedQty: msg.packingState?.[String(i)] ?? 0,
    })),
  };
}

export function Dashboard() {
  const [orders, setOrdersState] = useState<Order[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const ordersRef = useRef<Order[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(true);
  const packingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Mirrors state into a ref so event handlers always read the latest value
  const setOrders = (updater: Order[] | ((prev: Order[]) => Order[])) => {
    setOrdersState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      ordersRef.current = next;
      return next;
    });
  };

  const fetchOrders = () => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((msgs: ApiMessage[]) => {
        const processed = msgs
          .filter((m) => m.status === "processed" && m.extractedData)
          .map(messageToOrder);
        setOrders(processed);
      })
      .catch(console.error);
  };

  useEffect(() => {
    reconnectRef.current = true;
    fetchOrders();

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "packing_update") {
            const orderId = `ORD-${msg.msgId}`;
            const itemId = `${msg.msgId}-${msg.itemIndex}`;
            setOrders(prev =>
              prev.map(order =>
                order.id !== orderId ? order : {
                  ...order,
                  items: order.items.map(item =>
                    item.id === itemId ? { ...item, packedQty: msg.packedQty } : item
                  ),
                }
              )
            );
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

    const onFocus = () => fetchOrders();
    window.addEventListener("focus", onFocus);

    return () => {
      reconnectRef.current = false;
      wsRef.current?.close();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const toggleItemPacked = (orderId: string, itemId: string) => {
    const order = ordersRef.current.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (!order || !item) return;

    const newPackedQty = item.packedQty === item.qty ? 0 : item.qty;

    setOrders(prev =>
      prev.map(o =>
        o.id !== orderId ? o : {
          ...o,
          items: o.items.map(i =>
            i.id !== itemId ? i : { ...i, packedQty: newPackedQty }
          ),
        }
      )
    );

    if (order.msgId) {
      const msgId = order.msgId;
      const itemIndex = parseInt(itemId.slice(msgId.length + 1));
      fetch(`/api/messages/${msgId}/packing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIndex, packedQty: newPackedQty }),
      }).catch(console.error);
    }
  };

  const updateItemPackedQty = (orderId: string, itemId: string, qty: number) => {
    const order = ordersRef.current.find(o => o.id === orderId);
    const item = order?.items.find(i => i.id === itemId);
    if (!order || !item) return;

    const clamped = Math.max(0, Math.min(item.qty, qty));

    setOrders(prev =>
      prev.map(o =>
        o.id !== orderId ? o : {
          ...o,
          items: o.items.map(i =>
            i.id !== itemId ? i : { ...i, packedQty: clamped }
          ),
        }
      )
    );

    if (order.msgId) {
      const msgId = order.msgId;
      const itemIndex = parseInt(itemId.slice(msgId.length + 1));
      const existing = packingTimers.current.get(itemId);
      if (existing) clearTimeout(existing);
      packingTimers.current.set(itemId, setTimeout(() => {
        fetch(`/api/messages/${msgId}/packing`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIndex, packedQty: clamped }),
        }).catch(console.error);
        packingTimers.current.delete(itemId);
      }, 400));
    }
  };

  const markOrderReady = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);

    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === orderId);
      if (idx === -1) return prev;
      const ord = prev[idx];
      const packed = ord.items.filter((i) => i.packedQty > 0).map((i) => ({ ...i, qty: i.packedQty }));
      const unpacked = ord.items.filter((i) => i.packedQty < i.qty).map((i) => ({ ...i, qty: i.qty - i.packedQty, packedQty: 0 }));
      const next = [...prev];
      if (unpacked.length === 0) {
        next[idx] = { ...ord, items: packed, status: "ready" };
      } else if (packed.length > 0) {
        next[idx] = { ...ord, items: packed, status: "ready" };
        next.splice(idx + 1, 0, {
          ...ord,
          id: `${ord.id}-${Math.floor(1000 + Math.random() * 9000)}-SPLIT`,
          msgId: undefined,
          status: "packing",
          items: unpacked,
          lastUpdated: "Just now",
        });
      }
      return next;
    });

    if (order?.msgId) {
      await fetch(`/api/messages/${order.msgId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "fulfilled" }),
      }).catch(console.error);
    }
  };

  const aggregatedItems = Object.values(
    orders
      .filter((o) => o.status === "packing")
      .flatMap((o) => o.items)
      .reduce(
        (acc, item) => {
          const key = item.name.toLowerCase();
          if (!acc[key]) acc[key] = { name: item.name, remaining: 0 };
          acc[key].remaining += item.qty - item.packedQty;
          return acc;
        },
        {} as Record<string, { name: string; remaining: number }>
      )
  ).sort((a, b) => b.remaining - a.remaining);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical": return "bg-[#DC2626] text-white";
      case "high": return "bg-[#EA580C] text-white";
      default: return "bg-[#D97706] text-white";
    }
  };

  const getUrgencyBorder = (urgency: string) => {
    switch (urgency) {
      case "critical": return "border-t-[#DC2626]";
      case "high": return "border-t-[#EA580C]";
      default: return "border-t-[#D97706]";
    }
  };

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
            {orders.filter((o) => o.status === "packing").map((order) => {
              const allPacked = order.items.every((i) => i.packedQty === i.qty);
              const somePacked = order.items.some((i) => i.packedQty > 0);
              return (
                <div
                  key={order.id}
                  className={`bg-surface-bright rounded-xl custom-shadow border-t-[6px] flex flex-col overflow-hidden transition-all ${getUrgencyBorder(order.urgency)}`}
                >
                  <div className="p-5 border-b border-outline-variant/10 bg-gradient-to-b from-surface-container-lowest to-surface flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-headline font-black text-2xl text-on-surface tracking-tight mb-1">{order.id}</h3>
                        <p className="font-bold flex items-center gap-1.5 text-on-surface text-lg">
                          <MapPin className="w-4 h-4 text-primary" /> {order.location}
                        </p>
                      </div>
                      <div className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex flex-col items-end justify-center bg-surface-container text-on-surface-variant">
                        <span className="uppercase tracking-wider text-[10px] opacity-70 mb-0.5">Last Updated</span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {order.lastUpdated}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <p className="text-sm font-bold text-on-surface-variant flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full">
                        <Users className="w-4 h-4" /> {order.persons} Households
                      </p>
                      <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm ${getUrgencyColor(order.urgency)}`}>
                        {order.urgency} Priority
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <ul className="divide-y divide-outline-variant/10">
                      {order.items.map((item, idx) => {
                        const isFullyPacked = item.packedQty === item.qty;
                        return (
                          <li
                            key={item.id}
                            className={`p-4 flex items-start gap-4 transition-colors ${
                              isFullyPacked
                                ? "opacity-50 bg-surface-container-lowest grayscale"
                                : idx % 2 === 0
                                ? "bg-surface-bright"
                                : "bg-surface-container-lowest"
                            }`}
                          >
                            <button
                              onClick={() => toggleItemPacked(order.id, item.id)}
                              className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors hover:border-primary ${
                                isFullyPacked
                                  ? "border-primary bg-primary text-on-primary"
                                  : item.packedQty > 0
                                  ? "border-primary text-primary bg-primary/10"
                                  : "border-outline-variant text-transparent bg-surface-bright"
                              }`}
                            >
                              {isFullyPacked ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : item.packedQty > 0 ? (
                                <span className="text-sm font-black">-</span>
                              ) : null}
                            </button>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-3">
                                <p
                                  className={`font-bold text-[1.1rem] leading-snug flex-1 min-w-0 break-words ${
                                    isFullyPacked ? "line-through text-on-surface-variant" : "text-on-surface"
                                  }`}
                                >
                                  {item.name}
                                </p>
                                <div className="flex items-center gap-1.5 font-black text-xl sm:text-2xl leading-none bg-surface-container px-2 py-1.5 shrink-0 rounded-lg whitespace-nowrap overflow-hidden">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.qty}
                                    value={item.packedQty === 0 ? "" : item.packedQty}
                                    placeholder="0"
                                    onChange={(e) => updateItemPackedQty(order.id, item.id, parseInt(e.target.value) || 0)}
                                    className={`w-10 sm:w-16 bg-surface-container-low text-center focus:ring-2 focus:ring-primary outline-none border-none rounded ${
                                      item.packedQty > 0 ? "text-primary" : "text-on-surface-variant"
                                    }`}
                                  />
                                  <span className="text-on-surface-variant opacity-40 font-bold text-lg sm:text-xl">/</span>
                                  <span className={isFullyPacked ? "text-on-surface-variant" : "text-on-surface"}>{item.qty}</span>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10">
                    <button
                      disabled={!somePacked}
                      onClick={() => markOrderReady(order.id)}
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
                        <><Send className="w-5 h-5" /> Dispatch Partial & Split</>
                      ) : (
                        "Pack items to dispatch"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {orders.filter((o) => o.status === "packing").length === 0 && (
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
            <p className="text-sm text-on-surface-variant mt-1">Remaining unpacked items across all active dispatches.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {aggregatedItems.length === 0 ? (
              <p className="text-center text-on-surface-variant text-sm py-8">No active dispatches.</p>
            ) : (
              <ul className="space-y-3">
                {aggregatedItems.map((item) => (
                  <li
                    key={item.name}
                    className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10"
                  >
                    <div className="font-bold text-on-surface">{item.name}</div>
                    <div className="text-2xl font-black text-primary">{item.remaining}</div>
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
