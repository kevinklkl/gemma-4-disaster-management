import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertCircle, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/Brand";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const isHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";

export function Login() {
  const { login, user, isLoading, isInitializing } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      navigate(user.role === "responder" ? "/tickets" : "/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (isHost) return; // host never needs this check
    fetch(`${API_BASE}/auth/setup-needed`)
      .then((r) => r.json())
      .then((d) => setHasAccounts(!d.setupNeeded))
      .catch(() => setHasAccounts(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  // Host device: show a spinner while the auto-login fetch is in progress
  if (isHost && isInitializing) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: "var(--color-paper)" }}
      >
        <Brand variant="on-light" size={48} showWordmark linkTo={null} />
        <div
          className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mt-4"
          style={{ color: "var(--color-ash)" }}
        />
        <p className="font-mono text-xs" style={{ color: "var(--color-ash)" }}>
          signing you in…
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Brand variant="on-light" size={48} showWordmark linkTo={null} />
          <p className="font-mono text-xs mt-1" style={{ color: "var(--color-ash)" }}>
            responder sign-in
          </p>
        </div>

        {/* No accounts exist yet — only show to non-host devices */}
        {hasAccounts === false && (
          <div
            className="mb-5 rounded-lg p-4 text-sm border flex items-start gap-2.5"
            style={{
              background: "var(--color-paper-warm)",
              borderColor: "var(--color-paper-edge)",
              color: "var(--color-ink-soft)",
            }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-ash)" }} />
            <span>
              No accounts have been set up yet. Ask whoever is running the akbay
              host device to create your account from their Settings page.
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl p-7 border"
          style={{
            background: "var(--color-paper-warm)",
            borderColor: "var(--color-paper-edge)",
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-ash)" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-paper)",
                borderColor: "var(--color-paper-edge)",
                color: "var(--color-ink)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-ash)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-paper)",
                borderColor: "var(--color-paper-edge)",
                color: "var(--color-ink)",
              }}
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm"
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
          >
            <LogIn className="w-4 h-4" strokeWidth={2} />
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
