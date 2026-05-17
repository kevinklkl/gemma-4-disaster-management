import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/Brand";

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

export function Signup() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === "responder" ? "/tickets" : "/", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), username: username.trim(), password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Signup failed");
      }
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setIsSubmitting(false);
    }
  }

  const inputStyle = {
    background: "var(--color-paper)",
    borderColor: "var(--color-paper-edge)",
    color: "var(--color-ink)",
  };

  const labelStyle = {
    color: "var(--color-ash)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Brand variant="on-light" size={48} showWordmark linkTo={null} />
          <p className="font-mono text-xs mt-1" style={{ color: "var(--color-ash)" }}>
            responder sign-up
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
            <label
              htmlFor="fullName"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={labelStyle}
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={labelStyle}
            >
              Username / Email
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={labelStyle}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="font-mono text-xs font-semibold uppercase tracking-wider"
              style={labelStyle}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="rounded-md border px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
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
            disabled={isSubmitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
          >
            <UserPlus className="w-4 h-4" strokeWidth={2} />
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: "var(--color-ash)" }}>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-dagat)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
