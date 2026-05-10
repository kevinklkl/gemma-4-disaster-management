import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import {
  Search, Bell, HelpCircle, MoreVertical, TrendingUp, AlertTriangle, MessageSquare, Baby, Users, Home,
  Mic, Utensils, Droplet, Tent, Cross, CheckCircle2, Clock, MapPin, Package, Send, Box, Plus, Settings, ClipboardList, Activity, Inbox as InboxIcon, Map as MapIcon, ChevronRight
} from "lucide-react";

export function Dashboard() {
  const [orders, setOrders] = useState([
    {
      id: "ORD-001",
      location: "Sitio Riverside",
      lastUpdated: "Today, 14:30",
      urgency: "critical",
      families: 5,
      status: "packing",
      items: [
        { id: "i1", name: "Infant Formula (0-6 mos)", qty: 2, packedQty: 0 },
        { id: "i2", name: "Drinking Water (5 Gal)", qty: 5, packedQty: 5 },
        { id: "i3", name: "Instant Meals (No heat)", qty: 15, packedQty: 0 },
        { id: "i4", name: "Diapers (Newborn)", qty: 1, packedQty: 0 },
      ]
    },
    {
      id: "ORD-002",
      location: "Sitio Bukid",
      lastUpdated: "Today, 14:15",
      urgency: "high",
      families: 12,
      status: "packing",
      items: [
        { id: "i5", name: "Cooked Hot Meals (Rice/Ulam)", qty: 36, packedQty: 0 },
        { id: "i6", name: "Drinking Water (1L bottles)", qty: 24, packedQty: 0 },
        { id: "i7", name: "Tarpaulins / Blankets", qty: 12, packedQty: 0 },
        { id: "i8", name: "First Aid Kits", qty: 2, packedQty: 0 },
      ]
    },
    {
      id: "ORD-003",
      location: "Purok Mahogany",
      lastUpdated: "Today, 13:50",
      urgency: "medium",
      families: 30,
      status: "packing",
      items: [
        { id: "i9", name: "Instant Noodles & Canned Goods", qty: 90, packedQty: 0 },
        { id: "i10", name: "Drinking Water (5 Gal)", qty: 15, packedQty: 0 },
        { id: "i11", name: "Hygiene Kits (Soap, Napkins)", qty: 30, packedQty: 0 },
      ]
    },
    {
      id: "ORD-004",
      location: "Sitio Lapu",
      lastUpdated: "Today, 13:10",
      urgency: "critical",
      families: 8,
      status: "packing",
      items: [
        { id: "i12", name: "Cooked Hot Meals", qty: 24, packedQty: 0 },
        { id: "i13", name: "Baby Food (6-12 mos)", qty: 4, packedQty: 0 },
        { id: "i14", name: "Drinking Water (1L bottles)", qty: 16, packedQty: 0 },
        { id: "i15", name: "Medical Kit (Wound Care)", qty: 1, packedQty: 0 },
      ]
    }
  ]);

  const toggleItemPacked = (orderId: string, itemId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        items: order.items.map(item => {
          if (item.id !== itemId) return item;
          const isPacked = item.packedQty === item.qty;
          return { ...item, packedQty: isPacked ? 0 : item.qty };
        })
      };
    }));
  };

  const updateItemPackedQty = (orderId: string, itemId: string, qty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      return {
        ...order,
        items: order.items.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, packedQty: Math.max(0, Math.min(item.qty, qty)) };
        })
      };
    }));
  };

  const markOrderReady = (orderId: string) => {
    setOrders(prev => {
      const orderIndex = prev.findIndex(o => o.id === orderId);
      if (orderIndex === -1) return prev;
      
      const order = prev[orderIndex];
      const packedItems = order.items.filter(i => i.packedQty > 0).map(i => ({...i, qty: i.packedQty}));
      const unpackedItems = order.items.filter(i => i.packedQty < i.qty).map(i => ({...i, qty: i.qty - i.packedQty, packedQty: 0}));

      let nextOrders = [...prev];

      if (unpackedItems.length === 0) {
        nextOrders[orderIndex] = { ...order, items: packedItems, status: "ready" };
      } else if (packedItems.length > 0) {
        nextOrders[orderIndex] = { ...order, items: packedItems, status: "ready" };
        nextOrders.splice(orderIndex + 1, 0, {
          ...order,
          id: `${order.id.split('-')[0]}-${Math.floor(1000 + Math.random() * 9000)}-SPLIT`,
          status: "packing",
          items: unpackedItems,
          lastUpdated: "Just now",
        });
      }

      return nextOrders;
    });
  };

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
      {/* TOP NAVIGATION BAR */}
      <TopNav />

      <div className="flex flex-1 overflow-hidden">
        {/* MAIN NDS CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="font-headline font-bold text-2xl text-primary leading-relaxed">Needs & Dispatch Display System (NDS)</h1>
              <p className="text-on-surface-variant text-sm font-medium">Real-time synced dispatch fulfillment view.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider shrink-0 border border-primary/20">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              Live Routing
            </div>
          </div>

          {/* NDS Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
            {orders.filter(o => o.status === "packing").map(order => {
              const allPacked = order.items.every(i => i.packedQty === i.qty);
              const somePacked = order.items.some(i => i.packedQty > 0);

              return (
                <div key={order.id} className={`bg-surface-bright rounded-xl custom-shadow border-t-[6px] flex flex-col overflow-hidden transition-all ${getUrgencyBorder(order.urgency)}`}>
                  {/* Ticket Header */}
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
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{order.lastUpdated}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <p className="text-sm font-bold text-on-surface-variant flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full">
                        <Users className="w-4 h-4" /> {order.families} Households
                      </p>
                      <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm ${getUrgencyColor(order.urgency)}`}>
                        {order.urgency} Priority
                      </div>
                    </div>
                  </div>

                  {/* Ticket Items List */}
                  <div className="flex-1 overflow-y-auto">
                    <ul className="divide-y divide-outline-variant/10">
                      {order.items.map((item, idx) => {
                        const isFullyPacked = item.packedQty === item.qty;
                        return (
                        <li
                          key={item.id}
                          className={`p-4 flex items-start gap-4 transition-colors ${isFullyPacked ? 'opacity-50 bg-surface-container-lowest grayscale' : idx % 2 === 0 ? 'bg-surface-bright' : 'bg-surface-container-lowest'}`}
                        >
                          <button
                            onClick={() => toggleItemPacked(order.id, item.id)}
                            className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors hover:border-primary ${isFullyPacked ? 'border-primary bg-primary text-on-primary' : item.packedQty > 0 ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-transparent bg-surface-bright'}`}
                          >
                             {isFullyPacked ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : item.packedQty > 0 ? (
                                <span className="text-sm font-black">-</span>
                              ) : null}
                          </button>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-3">
                              <p className={`font-bold text-[1.1rem] leading-snug flex-1 min-w-0 break-words ${isFullyPacked ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
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
                                  className={`w-10 sm:w-16 bg-surface-container-low text-center focus:ring-2 focus:ring-primary outline-none border-none rounded ${item.packedQty > 0 ? 'text-primary' : 'text-on-surface-variant'}`}
                                />
                                <span className="text-on-surface-variant opacity-40 font-bold text-lg sm:text-xl">/</span>
                                <span className={isFullyPacked ? 'text-on-surface-variant' : 'text-on-surface'}>
                                  {item.qty}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Ticket Footer Action */}
                  <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10">
                    <button
                      disabled={!somePacked}
                      onClick={() => markOrderReady(order.id)}
                      className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                        allPacked 
                          ? 'bg-primary text-on-primary shadow-lg hover:brightness-110 active:scale-95' 
                          : somePacked
                          ? 'bg-tertiary text-on-tertiary shadow-lg hover:brightness-110 active:scale-95'
                          : 'bg-surface-container text-on-surface-variant opacity-70 cursor-not-allowed'
                      }`}
                    >
                      {allPacked ? (
                        <>
                          <Send className="w-5 h-5" />
                          Ready for Dispatch
                        </>
                      ) : somePacked ? (
                        <>
                          <Send className="w-5 h-5" />
                          Dispatch Partial & Split
                        </>
                      ) : (
                        "Pack items to dispatch"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State if all cleared */}
          {orders.filter(o => o.status === "packing").length === 0 && (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-headline font-black text-on-surface mb-3">All Clear!</h2>
              <p className="text-on-surface-variant text-lg">No pending dispatches at the moment. Great job!</p>
            </div>
          )}
        </main>

        {/* RIGHT SIDE PANEL: Comprehensive Goods Summary */}
        <aside className="w-[340px] xl:w-[400px] border-l border-outline-variant/20 bg-surface flex flex-col shrink-0 hidden md:flex z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-6 border-b border-outline-variant/10 bg-surface-bright">
            <h2 className="font-headline font-bold text-xl inline-flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              Aggregated Needs
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">Pending items broken down by exact specification based on active dispatches.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Category: Meals */}
            <div>
              <h3 className="font-label font-black uppercase text-xs tracking-widest text-on-surface-variant mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <Utensils className="w-4 h-4" /> Meals & Food
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Cooked Hot Meals <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Rice & Ulam</span></div>
                  <div className="text-2xl font-black text-primary">60</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Instant Meals <span className="block text-xs font-medium text-on-surface-variant mt-0.5">No heating required</span></div>
                  <div className="text-2xl font-black text-primary">15</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Instant Noodles & Canned <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Requires boiling water</span></div>
                  <div className="text-2xl font-black text-primary">90</div>
                </li>
              </ul>
            </div>

            {/* Category: Water */}
            <div>
              <h3 className="font-label font-black uppercase text-xs tracking-widest text-on-surface-variant mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <Droplet className="w-4 h-4" /> Hydration
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Drinking Water <span className="block text-xs font-medium text-on-surface-variant mt-0.5">5 Gallon Jugs</span></div>
                  <div className="text-2xl font-black text-primary">20</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Drinking Water <span className="block text-xs font-medium text-on-surface-variant mt-0.5">1L Bottles</span></div>
                  <div className="text-2xl font-black text-primary">40</div>
                </li>
              </ul>
            </div>

            {/* Category: Infant Needs */}
            <div>
              <h3 className="font-label font-black uppercase text-xs tracking-widest text-on-surface-variant mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <Baby className="w-4 h-4" /> Infant & Toddler
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10 border-l-4 border-l-[#D97706]">
                  <div className="font-bold text-on-surface">Infant Formula <span className="block text-xs font-medium text-on-surface-variant mt-0.5">0-6 months</span></div>
                  <div className="text-2xl font-black text-[#D97706]">2</div>
                </li>
                 <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10 border-l-4 border-l-[#D97706]">
                  <div className="font-bold text-on-surface">Baby Food <span className="block text-xs font-medium text-on-surface-variant mt-0.5">6-12 months (puree/jars)</span></div>
                  <div className="text-2xl font-black text-[#D97706]">4</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Diapers <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Newborn</span></div>
                  <div className="text-2xl font-black text-primary">1</div>
                </li>
              </ul>
            </div>

             {/* Category: Non-Food Relief */}
            <div>
              <h3 className="font-label font-black uppercase text-xs tracking-widest text-on-surface-variant mb-4 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <Tent className="w-4 h-4" /> Non-Food Items (NFI)
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Hygiene Kits <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Soap, Sanitary Napkins, Toothbrush</span></div>
                  <div className="text-2xl font-black text-primary">30</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10 border-l-4 border-l-[#EA580C]">
                  <div className="font-bold text-on-surface">Medical / First Aid <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Wound Care, Basic Meds</span></div>
                  <div className="text-2xl font-black text-[#EA580C]">3</div>
                </li>
                <li className="flex justify-between items-center bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="font-bold text-on-surface">Tarpaulins <span className="block text-xs font-medium text-on-surface-variant mt-0.5">Including heavy blankets</span></div>
                  <div className="text-2xl font-black text-primary">12</div>
                </li>
              </ul>
            </div>
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


