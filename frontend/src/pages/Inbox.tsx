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
  estimated?: boolean;
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
  status: "needs_processing" | "processing" | "processed" | "fulfilled" | "failed";
  extractedData: ExtractedData | null;
  processingStartedAt?: string;
  processingDurationMs?: number;
  processingNode?: string;
};

type NodeInfo = {
  url: string;
  name: string;
  busy: boolean;
  jobs_done: number;
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
  const [joinDismissed, setJoinDismissed] = useState(false);
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "joined" | "host" | "error">("idle");
  const [joinError, setJoinError] = useState("");
  const [joinStep, setJoinStep] = useState<0 | 1 | 2 | 3>(0);
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [nodes, setNodes] = useState<NodeInfo[]>([]);

  const ua = navigator.userAgent;
  const os: "windows" | "mac" = ua.includes("Windows") ? "windows" : "mac";
  const ollamaCommand = os === "windows"
    ? "set OLLAMA_HOST=0.0.0.0 && ollama serve"
    : "OLLAMA_HOST=0.0.0.0 ollama serve";
  const pasteKey = os === "windows" ? "Ctrl + V" : "⌘ + V";

  const handleCopy = () => {
    navigator.clipboard.writeText(ollamaCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = () => {
    setJoinStatus("joining");
    setJoinError("");
    fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: joinName.trim() }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (!data.ok) {
          setJoinStatus("error");
          setJoinError(
            data.status === "no_model"
              ? "This device doesn't have the required AI model installed."
              : "Couldn't reach Ollama — did you run the command and leave the terminal open?"
          );
          return;
        }
        setNodes(data.nodes ?? []);
        setJoinStatus(data.status === "loopback" ? "host" : "joined");
        setJoinStep(0);
      })
      .catch(() => {
        setJoinStatus("error");
        setJoinError("Something went wrong. Try again.");
      });
  };

  // Auto-detect host: if you're browsing via localhost/127.0.0.1 you're the host machine
  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") setJoinStatus("host");
  }, []);

  // Restore join status across page reloads / tab switches
  useEffect(() => {
    fetch("/api/nodes/me")
      .then(r => r.json())
      .then(data => {
        if (data.registered && !data.isHost) setJoinStatus("joined");
      })
      .catch(() => {});
  }, []);

  // Poll node pool status always
  useEffect(() => {
    const poll = () => {
      fetch("/api/nodes")
        .then(r => r.json())
        .then(data => setNodes(data.nodes ?? []))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

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
              ? { ...m, status: "processed", processingDurationMs: msg.durationMs, extractedData: msg.extractedData, processingNode: msg.nodeName }
              : m
          ));
          processingRefs.current.delete(msg.msgId);
          setProcessingIds(prev => { const n = new Set(prev); n.delete(msg.msgId); return n; });
        } else if (msg.type === "processing_failed") {
          setMessages(prev => prev.map(m =>
            m.id === msg.msgId ? { ...m, status: "failed" } : m
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

  const handleRetry = (msg: Message) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "needs_processing" } : m));
  };

  const handleRetryAll = () => {
    setMessages(prev => prev.map(m => m.status === "failed" ? { ...m, status: "processing" } : m));
    fetch("/api/retry-failed", { method: "POST" }).catch(console.error);
  };

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

  const stats = {
    processed: messages.filter(m => m.status === "processed").length,
    inQueue: messages.filter(m => m.status === "needs_processing" || m.status === "processing").length,
    failed: messages.filter(m => m.status === "failed").length,
  };

  return (
    <div className="h-screen bg-surface-container-low font-body text-on-surface flex flex-col overflow-hidden">

      {/* Step-by-step join wizard */}
      {joinStep > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-6 p-6">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Add your computer</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {[1, 2, 3].map(s => (
                    <span key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === joinStep ? "w-8 bg-primary" : s < joinStep ? "w-4 bg-primary/40" : "w-4 bg-outline-variant"}`} />
                  ))}
                  <span className="text-xs text-on-surface-variant ml-1">{joinStep} / 3</span>
                </div>
              </div>
              <button onClick={() => setJoinStep(0)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1 — Open terminal */}
            {joinStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-headline font-bold text-on-surface">Open a terminal</h2>
                  <p className="text-sm text-on-surface-variant mt-1">A terminal lets you type commands to your computer.</p>
                </div>
                {os === "windows" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <kbd className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm font-bold text-on-surface shadow-sm">⊞ Win</kbd>
                      <span className="text-on-surface-variant font-bold">+</span>
                      <kbd className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm font-bold text-on-surface shadow-sm">R</kbd>
                    </div>
                    <p className="text-sm text-on-surface">A small box will appear at the bottom of your screen.</p>
                    <div className="bg-surface-container rounded-xl p-3 flex items-center gap-3">
                      <span className="text-sm text-on-surface-variant">Type</span>
                      <code className="bg-surface-container-high rounded px-2 py-1 text-sm font-mono font-bold text-on-surface">cmd</code>
                      <span className="text-sm text-on-surface-variant">then press Enter</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">A black window opens — that's your terminal. ✓</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <kbd className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm font-bold text-on-surface shadow-sm">⌘</kbd>
                      <span className="text-on-surface-variant font-bold">+</span>
                      <kbd className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm font-bold text-on-surface shadow-sm">Space</kbd>
                    </div>
                    <p className="text-sm text-on-surface">Spotlight search opens at the top of your screen.</p>
                    <div className="bg-surface-container rounded-xl p-3 flex items-center gap-3">
                      <span className="text-sm text-on-surface-variant">Type</span>
                      <code className="bg-surface-container-high rounded px-2 py-1 text-sm font-mono font-bold text-on-surface">Terminal</code>
                      <span className="text-sm text-on-surface-variant">then press Enter</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">A white window opens — that's your terminal. ✓</p>
                  </div>
                )}
                <button onClick={() => setJoinStep(2)}
                  className="w-full py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  I've opened it <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2 — Run command */}
            {joinStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-headline font-bold text-on-surface">Run this command</h2>
                  <p className="text-sm text-on-surface-variant mt-1">This tells Ollama to accept connections from the network.</p>
                </div>
                <div className="space-y-3">
                  <div className="bg-surface-container-high rounded-xl p-3 flex items-center gap-2">
                    <code className="text-xs font-mono text-on-surface flex-1 break-all leading-relaxed">{ollamaCommand}</code>
                    <button onClick={handleCopy}
                      className="shrink-0 flex items-center gap-1 px-2 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all">
                      {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : "Copy"}
                    </button>
                  </div>
                  <ol className="space-y-1.5 text-sm text-on-surface list-none">
                    <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">1.</span> Click <span className="font-bold">Copy</span> above</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">2.</span> Click inside the terminal window</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span> Press <kbd className="bg-surface-container-high rounded px-1.5 py-0.5 text-xs font-mono">{pasteKey}</kbd> to paste</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">4.</span> Press Enter</li>
                  </ol>
                  <div className="bg-secondary/10 border border-secondary/20 rounded-xl px-3 py-2 text-xs text-on-surface-variant">
                    Leave the terminal window open — don't close it!
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setJoinStep(1)}
                    className="flex-1 py-3 bg-surface-container text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-high transition-all">
                    ← Back
                  </button>
                  <button onClick={() => setJoinStep(3)}
                    className="flex-[2] py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2">
                    It's running <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Join */}
            {joinStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-headline font-bold text-on-surface">You're almost in!</h2>
                  <p className="text-sm text-on-surface-variant mt-1">Click the button below to add this computer to the processing pool.</p>
                </div>
                <div className="bg-surface-container rounded-xl p-4 text-sm text-on-surface-variant space-y-1">
                  <p>✓ Terminal open</p>
                  <p>✓ Command running</p>
                  <p className="text-primary font-bold">→ Click Join to connect</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                    Name this computer <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                    placeholder={os === "mac" ? "Jacob's Mac" : "Jacob's PC"}
                    className="w-full bg-surface-container-high rounded-xl px-3 py-2.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface"
                  />
                </div>
                {joinStatus === "error" && joinError && (
                  <div className="bg-error/10 border border-error/20 rounded-xl px-3 py-2 text-xs text-error">
                    {joinError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setJoinStep(2)}
                    className="flex-1 py-3 bg-surface-container text-on-surface rounded-xl text-sm font-bold hover:bg-surface-container-high transition-all">
                    ← Back
                  </button>
                  {joinStatus === "joining" ? (
                    <div className="flex-[2] py-3 bg-primary text-on-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Joining…
                    </div>
                  ) : (
                    <button onClick={handleJoin}
                      className="flex-[2] py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2">
                      Join as node <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">

            <div>
              <h1
                className="font-display font-bold leading-tight"
                style={{ fontSize: 30, color: "var(--color-ink-soft)", letterSpacing: "-0.025em", margin: 0 }}
              >
                inbox
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
                real-time intake feed. raw messages parsed by Gemma on the local node pool.
              </p>
            </div>

            {!joinDismissed && (
              <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="ak-caps" style={{ color: "var(--color-ash)" }}>node pool</p>
                  <button onClick={() => setJoinDismissed(true)}
                    className="text-on-surface-variant hover:text-on-surface p-1 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {nodes.map(node => (
                    <span
                      key={node.url}
                      className="inline-flex items-center gap-2 whitespace-nowrap"
                      style={{
                        background: "var(--color-paper)",
                        border: "1px solid var(--color-paper-edge)",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 13,
                      }}
                    >
                      <span
                        className={node.busy ? "animate-pulse" : ""}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: node.busy ? "var(--color-damay)" : "var(--color-smoke)",
                          flexShrink: 0,
                        }}
                      />
                      <b style={{ fontWeight: 600, color: "var(--color-ink)" }}>{node.name}</b>
                      <span style={{ color: "var(--color-ash)", fontSize: 12 }}>
                        {node.busy ? "processing…" : `${node.jobs_done} done`}
                      </span>
                    </span>
                  ))}
                </div>
                {joinStatus === "host" && (
                  <p className="text-xs text-on-surface-variant pt-2 mt-2 border-t border-outline-variant/20">
                    you're the host — already in pool
                  </p>
                )}
                {joinStatus !== "joined" && joinStatus !== "host" && (
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-outline-variant/20">
                    <p className="text-xs text-on-surface-variant">want to contribute your computer?</p>
                    <button onClick={() => setJoinStep(1)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all">
                      add your machine <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-black text-on-surface leading-none">{stats.processed}</p>
                  <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>processed</p>
                </div>
              </div>
              <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
                <Loader2 className={`w-5 h-5 text-secondary shrink-0 ${stats.inQueue > 0 ? "animate-spin" : ""}`} />
                <div>
                  <p className="text-2xl font-black text-on-surface leading-none">{stats.inQueue}</p>
                  <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>in queue</p>
                </div>
              </div>
              <div className="rounded-xl bg-surface-container border border-outline-variant/20 px-4 py-3 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-error shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-on-surface leading-none">{stats.failed}</p>
                  <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>failed</p>
                </div>
                {stats.failed > 0 && (
                  <button
                    onClick={handleRetryAll}
                    className="shrink-0 flex items-center gap-1 px-2 py-1.5 bg-error/10 text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> retry all
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <div>
                <h2
                  className="font-display font-bold"
                  style={{ fontSize: 22, color: "var(--color-ink-soft)", letterSpacing: "-0.015em", lineHeight: 1.2 }}
                >
                  recent messages
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
                  all incoming raw communications waiting to be processed.
                </p>
              </div>
              <div
                className="inline-flex p-[3px] rounded-full"
                style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
              >
                {["all sources", "sms", "voice", "manual"].map((label, i) => (
                  <button
                    key={label}
                    className="px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-colors"
                    style={
                      i === 0
                        ? { background: "var(--color-paper)", color: "var(--color-ink)", boxShadow: "var(--shadow-1)" }
                        : { background: "transparent", color: "var(--color-ash)" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-xl flex flex-col lg:flex-row transition-all"
                  style={{
                    background: "var(--color-paper-warm)",
                    border: "1px solid var(--color-paper-edge)",
                    opacity: message.status === "fulfilled" ? 0.7 : 1,
                  }}
                >
                  <div className="p-5 flex-1 max-w-2xl">
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                          style={{
                            background: "var(--color-paper)",
                            border: "1px solid var(--color-paper-edge)",
                            color: "var(--color-ash)",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            lineHeight: 1,
                          }}
                        >
                          {getIcon(message.type)}
                          {message.source}
                        </span>
                        <span style={{ color: "var(--color-ash)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                          · {message.time}
                        </span>
                      </div>
                      <button
                        className="rounded p-1"
                        style={{ color: "var(--color-ash)", background: "transparent", border: "none", cursor: "pointer" }}
                        aria-label="more"
                      >
                        <MoreVertical className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>

                    <div
                      className="mb-4"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "var(--color-ink-soft)",
                      }}
                    >
                      {message.content}
                    </div>

                    {/* Status bar */}
                    {message.status === "needs_processing" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-error text-sm font-bold">
                          <AlertCircle className="w-4 h-4" />
                          needs processing
                        </div>
                        <button
                          onClick={() => triggerProcess(message)}
                          className="px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-primary/20 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" /> reprocess with Gemma
                        </button>
                      </div>
                    )}

                    {message.status === "processing" && (
                      <div
                        className="flex items-center justify-between mt-3 pt-3"
                        style={{ borderTop: "1px solid var(--color-paper-edge)" }}
                      >
                        <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--color-ash)" }}>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-damay)" }} />
                          <span>Gemma is thinking…</span>
                        </div>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
                          style={{ background: "var(--color-damay-soft)", color: "var(--color-damay)" }}
                        >
                          <Timer className="w-3 h-3" strokeWidth={2} />
                          {getElapsedS(message.processingStartedAt)}s
                        </span>
                      </div>
                    )}

                    {message.status === "failed" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-error text-sm font-bold">
                          <AlertCircle className="w-4 h-4" />
                          extraction failed
                        </div>
                        <button
                          onClick={() => handleRetry(message)}
                          className="px-4 py-2 bg-error/10 text-error border border-error/30 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-error/20 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" /> retry
                        </button>
                      </div>
                    )}

                    {message.status === "processed" && (
                      <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-2 text-primary text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          processed
                          {formatDuration(message.processingDurationMs) && (
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">
                              {formatDuration(message.processingDurationMs)}
                            </span>
                          )}
                          {message.processingNode && (
                            <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs rounded-full font-bold">
                              {message.processingNode}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-on-surface-variant flex items-center gap-1 font-bold">
                          parsed <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extracted data panel */}
                  {message.status === "processed" && message.extractedData && (
                    <div className="flex-1 bg-surface border-t lg:border-t-0 lg:border-l border-outline-variant/20 p-6 flex flex-col justify-center transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="ak-caps" style={{ color: "var(--color-ash)" }}>extracted info</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block ak-caps mb-1.5" style={{ color: "var(--color-ash)" }}>location</label>
                          <input
                            type="text"
                            value={message.extractedData.location || ""}
                            onChange={(e) => handleUpdateField(message.id, "location", e.target.value)}
                            className="w-full bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block ak-caps mb-1.5" style={{ color: "var(--color-ash)" }}>persons</label>
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
                        <label className="block ak-caps mb-2" style={{ color: "var(--color-ash)" }}>required needs · item / qty</label>
                        <div className="flex flex-col gap-2">
                          {message.extractedData.items?.map((item: any, i: number) => (
                            <div key={i} className="flex gap-2 items-center group">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(message.id, i, "name", e.target.value)}
                                className="flex-1 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                              />
                              {item.unit === "triage" ? (
                                <span className="px-2 py-1 bg-error/10 text-error text-[10px] font-bold rounded whitespace-nowrap">
                                  triage req.
                                </span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={item.qty ?? ""}
                                    onChange={(e) => handleUpdateItem(message.id, i, "qty", e.target.value === "" ? null : Number(e.target.value))}
                                    className={`w-14 rounded-md px-2 py-1.5 text-xs border-none ring-1 outline-none font-bold transition-colors text-center ${
                                      item.estimated
                                        ? "bg-primary/8 ring-primary/30 text-primary focus:ring-primary"
                                        : "bg-surface-container hover:bg-surface-container-high ring-outline-variant/30 focus:ring-primary text-on-surface"
                                    }`}
                                  />
                                  {item.unit && (
                                    <span className="text-[10px] text-on-surface-variant font-bold whitespace-nowrap min-w-[24px]">
                                      {item.unit}
                                    </span>
                                  )}
                                </div>
                              )}
                              <button onClick={() => handleRemoveItem(message.id, i)} className="text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 p-1 rounded transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddItem(message.id)}
                            className="text-xs text-primary font-bold hover:bg-primary/5 px-2 py-1 rounded transition-colors self-start mt-1"
                          >
                            + add item
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4">
                        <div className="flex items-center gap-2">
                          <label className="ak-caps" style={{ color: "var(--color-ash)" }}>urgency</label>
                          <select
                            value={message.extractedData.urgency || "low"}
                            onChange={(e) => handleUpdateField(message.id, "urgency", e.target.value)}
                            className="bg-surface-container rounded-md px-2 py-0.5 text-xs font-bold border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none"
                            style={{
                              color:
                                message.extractedData.urgency === "critical" ? "var(--color-tabang)" :
                                message.extractedData.urgency === "high"     ? "var(--color-signal)" :
                                message.extractedData.urgency === "medium"   ? "var(--color-araw)"   :
                                                                               "var(--color-ash)",
                            }}
                          >
                            <option value="critical">CRITICAL</option>
                            <option value="high">URGENT</option>
                            <option value="medium">medium</option>
                            <option value="low">low</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleFulfill(message.id)}
                          className="text-xs font-bold text-primary hover:underline hover:brightness-110 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> mark fulfilled
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <button className="py-3 px-6 border-2 border-dashed border-outline-variant/30 text-on-surface-variant font-bold text-sm rounded-xl hover:bg-surface-container transition-colors">
                load older messages
              </button>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
