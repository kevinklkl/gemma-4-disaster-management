import { useState, useEffect, useRef, useCallback } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { MoreVertical, MessageSquare, Mic, Smartphone, UserCircle, CheckCircle2, AlertCircle, Loader2, ArrowRight, X, RefreshCw, Timer } from "lucide-react";

type ExtractedItem = {
  name: string;
  qty: number | null;
  canonical?: string | null;
  raw_text?: string | null;
  unit?: string | null;
};

type ExtractedData = {
  location: string;
  urgency: string;
  persons: number;
  items: ExtractedItem[];
};

type Message = {
  id: string;
  type: string;
  source: string;
  time: string;
  content: string;
  status: "needs_processing" | "processing" | "processed" | "fulfilled";
  extractedData: ExtractedData | null;
  processingStartedAt?: string;
  processingDurationMs?: number;
};

function getElapsedS(startedAt?: string): string {
  if (!startedAt) return "0.0";
  return ((Date.now() - new Date(startedAt).getTime()) / 1000).toFixed(1);
}

function formatDuration(ms?: number): string | null {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setProcessingIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const processingRefs = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  // Re-render every 100ms to tick elapsed timers while any message is processing
  useEffect(() => {
    const hasProcessing = messages.some(m => m.status === "processing");
    if (!hasProcessing) return;
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [messages]);

  // WebSocket for live processing_started / processing_done events
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
              ? { ...m, status: "processed", processingDurationMs: msg.durationMs, extractedData: msg.extractedData }
              : m
          ));
          processingRefs.current.delete(msg.msgId);
          setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.msgId); return n; });
        }
      };

      ws.onclose = () => { if (!cancelled) setTimeout(connect, 3000); };
    };

    connect();
    return () => { cancelled = true; wsRef.current?.close(); };
  }, []);

  useEffect(() => {
    fetch("/api/messages")
      .then(r => r.json())
      .then((data: Message[]) => setMessages(data))
      .catch(console.error);
  }, []);

  const triggerProcess = useCallback((msg: Message) => {
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
      .then(({ extractedData, durationMs }: { extractedData: ExtractedData; durationMs: number }) => {
        setMessages(prev => prev.map(m =>
          m.id === msg.id
            ? { ...m, status: "processed", extractedData, processingDurationMs: durationMs }
            : m
        ));
      })
      .catch(err => {
        console.error("Failed to extract data:", err);
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, status: "needs_processing" } : m
        ));
      })
      .finally(() => {
        processingRefs.current.delete(msg.id);
        setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.id); return n; });
      });
  }, []);

  useEffect(() => {
    messages.forEach(msg => {
      if (msg.status === "needs_processing") triggerProcess(msg);
    });
  }, [messages, triggerProcess]);

  const handleUpdateField = (id: string, field: string, value: any) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData) {
        return { ...m, extractedData: { ...m.extractedData, [field]: value } };
      }
      return m;
    }));
  };

  const handleUpdateItem = (id: string, index: number, field: string, value: any) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData?.items) {
        const newItems = [...m.extractedData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return { ...m, extractedData: { ...m.extractedData, items: newItems } };
      }
      return m;
    }));
  };

  const handleRemoveItem = (id: string, index: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData?.items) {
        return { ...m, extractedData: { ...m.extractedData, items: m.extractedData.items.filter((_, i) => i !== index) } };
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
        return { ...m, extractedData: { ...m.extractedData, items: [...(m.extractedData.items || []), { name: "", qty: 1 }] } };
      }
      return m;
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "sms": return <Smartphone className="w-3.5 h-3.5" />;
      case "voice": return <Mic className="w-3.5 h-3.5" />;
      case "walkin": return <UserCircle className="w-3.5 h-3.5" />;
      case "viber": return <MessageSquare className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "sms": return "bg-secondary-container text-secondary";
      case "voice": return "bg-tertiary-container text-tertiary";
      case "walkin": return "bg-primary-container text-primary";
      case "viber": return "bg-secondary-container text-secondary";
      default: return "bg-surface-container text-on-surface-variant";
    }
  };

  return (
    <div className="h-screen bg-surface-container-low font-body text-on-surface flex flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Recent Messages</h2>
                <p className="text-sm text-on-surface-variant mt-1">All incoming raw communications waiting to be processed.</p>
              </div>
              <div className="flex gap-2 pb-2 overflow-x-auto">
                <button className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20 whitespace-nowrap">All Sources</button>
                <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">SMS</button>
                <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">Voice</button>
                <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">Manual</button>
              </div>
            </div>

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl custom-shadow flex flex-col lg:flex-row transition-all ${
                    message.status === "needs_processing" || message.status === "processing"
                      ? "bg-surface-bright border border-outline-variant/20 hover:border-primary/40"
                      : "bg-surface-container-lowest border border-outline-variant/10 opacity-80"
                  }`}
                >
                  <div className="p-6 flex-1 max-w-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full ${getIconColor(message.type)}`}>
                          {getIcon(message.type)}
                        </span>
                        <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">{message.source}</span>
                        <span className="text-on-surface-variant/50 text-xs">• {message.time}</span>
                      </div>
                      <MoreVertical className="text-on-surface-variant cursor-pointer hover:text-primary w-5 h-5" />
                    </div>

                    <div className={`mb-4 ${message.type === "voice" ? "bg-surface-container p-3 rounded-lg border border-outline-variant/20 text-on-surface-variant text-sm italic" : "text-lg font-headline text-on-surface"}`}>
                      {message.content}
                    </div>

                    {/* Status bar */}
                    {message.status === "needs_processing" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-error text-sm font-bold">
                          <AlertCircle className="w-4 h-4" />
                          Needs processing
                        </div>
                        <button
                          onClick={() => triggerProcess(message)}
                          className="px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-primary/20 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" /> Reprocess with AI
                        </button>
                      </div>
                    )}

                    {message.status === "processing" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-on-surface-variant text-sm font-bold">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span>Gemma is thinking…</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 border border-primary/20 rounded-lg">
                          <Timer className="w-3.5 h-3.5 text-primary" />
                          <span className="text-primary text-sm font-bold tabular-nums">
                            {getElapsedS(message.processingStartedAt)}s
                          </span>
                        </div>
                      </div>
                    )}

                    {message.status === "processed" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-primary text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Processed
                          {formatDuration(message.processingDurationMs) && (
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">
                              {formatDuration(message.processingDurationMs)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-on-surface-variant flex items-center gap-1 font-bold">
                          AI Extracted <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extracted data panel */}
                  {message.status === "processed" && message.extractedData && (
                    <div className="flex-1 bg-surface border-t lg:border-t-0 lg:border-l border-outline-variant/20 p-6 flex flex-col justify-center transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-on-surface-variant flex items-center gap-1">Extracted Info</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-1">Extracted Location</label>
                          <input
                            type="text"
                            value={message.extractedData.location || ""}
                            onChange={(e) => handleUpdateField(message.id, "location", e.target.value)}
                            className="w-full bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-1">Affected Families</label>
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
                        <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-2">Required Needs (Item / Qty)</label>
                        <div className="flex flex-col gap-2">
                          {message.extractedData.items?.map((item: any, i: number) => (
                            <div key={i} className="flex gap-2 items-center group">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(message.id, i, "name", e.target.value)}
                                className="flex-1 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                              />
                              <input
                                type="number"
                                value={item.qty ?? ""}
                                onChange={(e) => handleUpdateItem(message.id, i, "qty", e.target.value === "" ? null : Number(e.target.value))}
                                className="w-16 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-xs border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors text-center"
                              />
                              <button onClick={() => handleRemoveItem(message.id, i)} className="text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 p-1 rounded transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddItem(message.id)}
                            className="text-xs text-primary font-bold hover:bg-primary/5 px-2 py-1 rounded transition-colors self-start mt-1"
                          >
                            + Add Item
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70">Urgency:</label>
                          <select
                            value={message.extractedData.urgency || "low"}
                            onChange={(e) => handleUpdateField(message.id, "urgency", e.target.value)}
                            className={`bg-surface-container rounded-md px-2 py-0.5 text-xs font-bold border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none uppercase tracking-wider ${
                              message.extractedData.urgency === "critical" ? "text-error" :
                              message.extractedData.urgency === "high" ? "text-[#EA580C]" :
                              "text-[#D97706]"
                            }`}
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleFulfill(message.id)}
                          className="text-xs font-bold text-primary hover:underline hover:brightness-110 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Fulfilled
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <button className="py-3 px-6 border-2 border-dashed border-outline-variant/30 text-on-surface-variant font-bold text-sm rounded-xl hover:bg-surface-container transition-colors">
                Load older messages
              </button>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
