import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/Brand";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

export function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
    fetch(`${API_BASE}/auth/setup-needed`)
      .then((r) => r.json())
      .then((d) => {
        setSetupNeeded(d.setupNeeded);
        if (!d.setupNeeded) navigate("/login", { replace: true });
      })
      .catch(() => setSetupNeeded(false));
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Setup failed");
      localStorage.setItem("akbay_token", data.token);
      navigate("/", { replace: true });
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (setupNeeded === null) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Brand variant="on-light" size={48} showWordmark linkTo={null} />
          <p className="font-mono text-xs mt-1" style={{ color: "var(--color-ash)" }}>
            first-time setup
          </p>
        </div>

        <div
          className="mb-5 rounded-lg p-4 text-sm"
          style={{ background: "var(--color-paper-warm)", color: "var(--color-ink-soft)" }}
        >
          <p className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
            Create the host admin account
          </p>
          <p>
            This account has full access. After setup, you can create responder accounts from
            the Settings page.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl p-7 border"
          style={{
            background: "var(--color-paper-warm)",
            borderColor: "var(--color-paper-edge)",
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-ash)" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--color-paper)", borderColor: "var(--color-paper-edge)", color: "var(--color-ink)" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-ash)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--color-paper)", borderColor: "var(--color-paper-edge)", color: "var(--color-ink)" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-ash)" }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--color-paper)", borderColor: "var(--color-paper-edge)", color: "var(--color-ink)" }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
          >
            <ShieldCheck className="w-4 h-4" strokeWidth={2} />
            {submitting ? "Creating account…" : "Create admin account"}
          </button>
        </form>
      </div>
    </div>
  );
}
