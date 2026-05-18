import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Users, BarChart2, RefreshCw, Circle, CheckCircle2, Clock, Inbox } from "lucide-react";
import { useAuth, authHeaders } from "../context/AuthContext";
import { TopNav } from "../components/TopNav";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

type Node = {
  url: string;
  name: string;
  busy: boolean;
  jobs_done: number;
  android: boolean;
  max_batch: number;
};

type AdminStats = {
  totalMessages: number;
  processed: number;
  needsProcessing: number;
  fulfilled: number;
  failed: number;
  ticketsPendingApproval: number;
  ticketsQueued: number;
  ticketsApproved: number;
  nodes: Node[];
};

type User = {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  available: boolean;
  ticketsPending: number;
  ticketsApproved: number;
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-1"
      style={{ background: "var(--color-paper-warm)", borderColor: "var(--color-paper-edge)" }}
    >
      <p className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--color-ash)" }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: "var(--color-ink)" }}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs" style={{ color: "var(--color-ash)" }}>{sub}</p>}
    </div>
  );
}

export function Settings() {
  const { user, token, isInitializing } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isInitializing && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [isInitializing, user, navigate]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders(token) }),
        fetch(`${API_BASE}/auth/users`, { headers: authHeaders(token) }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  async function refresh() {
    setRefreshing(true);
    await fetchAll();
  }

  if (!user || user.role !== "admin") return null;

  const responders = users.filter(u => u.isActive);
  const nodes = stats?.nodes ?? [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-paper)" }}>
      <TopNav />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">

        {/* header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1
              className="font-display font-bold mb-1"
              style={{ fontSize: 24, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
            >
              settings
            </h1>
            <p className="text-sm" style={{ color: "var(--color-ash)" }}>
              nodes, responders, and system stats.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md py-2 px-3 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--color-paper-deep)", color: "var(--color-ink-soft)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />
            refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "var(--color-ash)" }} />
          </div>
        ) : (
          <div className="flex flex-col gap-10">

            {/* ── Stats ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4" strokeWidth={1.75} style={{ color: "var(--color-ash)" }} />
                <h2 className="font-semibold text-sm" style={{ color: "var(--color-ash)" }}>system stats</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <StatCard label="total messages" value={stats?.totalMessages ?? 0} />
                <StatCard label="processed" value={stats?.processed ?? 0} />
                <StatCard label="processing queue" value={stats?.needsProcessing ?? 0} />
                <StatCard label="fulfilled" value={stats?.fulfilled ?? 0} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="tickets pending" value={stats?.ticketsPendingApproval ?? 0} sub="assigned, waiting for approval" />
                <StatCard label="tickets queued" value={stats?.ticketsQueued ?? 0} sub="waiting for a responder" />
                <StatCard label="tickets approved" value={stats?.ticketsApproved ?? 0} sub="approved and archived" />
              </div>
            </section>

            {/* ── Nodes ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-4 h-4" strokeWidth={1.75} style={{ color: "var(--color-ash)" }} />
                <h2 className="font-semibold text-sm" style={{ color: "var(--color-ash)" }}>
                  inference nodes ({nodes.length})
                </h2>
              </div>
              {nodes.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ash)" }}>no nodes connected.</p>
              ) : (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: "var(--color-paper-edge)" }}
                >
                  {nodes.map((node, i) => (
                    <div
                      key={node.url}
                      className="flex items-center gap-4 px-5 py-4"
                      style={{
                        background: i % 2 === 0 ? "var(--color-paper-warm)" : "var(--color-paper)",
                        borderBottom: i < nodes.length - 1 ? "1px solid var(--color-paper-edge)" : undefined,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: node.busy ? "#ca8a04" : "#16a34a" }}
                        title={node.busy ? "busy" : "idle"}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
                          {node.name}
                          {node.android && (
                            <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-paper-deep)", color: "var(--color-ash)" }}>
                              android
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-xs mt-0.5 truncate" style={{ color: "var(--color-ash)" }}>{node.url}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>{node.jobs_done.toLocaleString()}</p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-ash)" }}>jobs done</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>{node.max_batch}</p>
                        <p className="font-mono text-xs" style={{ color: "var(--color-ash)" }}>max batch</p>
                      </div>
                      <span
                        className="shrink-0 font-mono text-xs px-2 py-1 rounded-full font-semibold"
                        style={{
                          background: node.busy ? "#fef9c3" : "#dcfce7",
                          color: node.busy ? "#92400e" : "#15803d",
                        }}
                      >
                        {node.busy ? "busy" : "idle"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Responders ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" strokeWidth={1.75} style={{ color: "var(--color-ash)" }} />
                <h2 className="font-semibold text-sm" style={{ color: "var(--color-ash)" }}>
                  responders ({responders.length})
                </h2>
              </div>
              {responders.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-ash)" }}>no responder accounts yet.</p>
              ) : (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: "var(--color-paper-edge)" }}
                >
                  <div
                    className="grid px-5 py-2.5 font-mono text-xs uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: "1fr 80px 90px 80px 80px",
                      color: "var(--color-ash)",
                      borderBottom: "1px solid var(--color-paper-edge)",
                      background: "var(--color-paper-deep)",
                    }}
                  >
                    <span>username</span>
                    <span className="text-center">role</span>
                    <span className="text-center">status</span>
                    <span className="text-center">pending</span>
                    <span className="text-center">approved</span>
                  </div>
                  {responders.map((u, i) => (
                    <div
                      key={u.id}
                      className="grid items-center px-5 py-3.5"
                      style={{
                        gridTemplateColumns: "1fr 80px 90px 80px 80px",
                        background: i % 2 === 0 ? "var(--color-paper-warm)" : "var(--color-paper)",
                        borderBottom: i < responders.length - 1 ? "1px solid var(--color-paper-edge)" : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
                          {u.username === "_host" ? "host" : u.username}
                        </span>
                        {u.username === "_host" && (
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-paper-deep)", color: "var(--color-ash)" }}>
                            admin
                          </span>
                        )}
                      </div>
                      <span className="text-center font-mono text-xs" style={{ color: "var(--color-ash)" }}>{u.role}</span>
                      <div className="flex justify-center">
                        <span
                          className="inline-flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-full font-semibold"
                          style={{
                            background: u.available ? "#dcfce7" : "#fee2e2",
                            color: u.available ? "#15803d" : "#dc2626",
                          }}
                        >
                          <Circle className="w-1.5 h-1.5 fill-current" strokeWidth={0} />
                          {u.available ? "active" : "paused"}
                        </span>
                      </div>
                      <div className="flex justify-center items-center gap-1">
                        <Inbox className="w-3 h-3" style={{ color: "var(--color-ash)" }} strokeWidth={1.75} />
                        <span className="font-semibold text-sm" style={{ color: u.ticketsPending > 0 ? "var(--color-ink)" : "var(--color-ash)" }}>
                          {u.ticketsPending}
                        </span>
                      </div>
                      <div className="flex justify-center items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" style={{ color: "var(--color-ash)" }} strokeWidth={1.75} />
                        <span className="font-semibold text-sm" style={{ color: "var(--color-ash)" }}>
                          {u.ticketsApproved}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
