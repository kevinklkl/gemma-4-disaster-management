import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "responder";
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isInitializing: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

function decodeTokenPayload(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.sub || !payload.username || !payload.role) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return { id: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

const isHostDevice =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("akbay_token");
    const decoded = t ? decodeTokenPayload(t) : null;
    // Discard the old synthetic id=0 host token — the server now issues real IDs
    if (decoded?.id === "0") { localStorage.removeItem("akbay_token"); return null; }
    return decoded ? t : null;
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem("akbay_token");
    const decoded = t ? decodeTokenPayload(t) : null;
    if (decoded?.id === "0") return null;
    return decoded;
  });
  const [isLoading, setIsLoading] = useState(false);
  // True until the initial auth check (including any auto-login fetch) completes.
  // Guards protected pages from redirecting before we know if the user is logged in.
  const [isInitializing, setIsInitializing] = useState(() => {
    const t = localStorage.getItem("akbay_token");
    const decoded = t ? decodeTokenPayload(t) : null;
    // Old id=0 token or no token on a host device → need async fetch
    if (isHostDevice && (!decoded || decoded.id === "0")) return true;
    // Valid token already present — resolve synchronously
    return !decoded;
  });

  useEffect(() => {
    if (token) {
      const decoded = decodeTokenPayload(token);
      if (decoded) {
        setUser(decoded);
        setIsInitializing(false);
        return;
      }
      // Stale / expired token
      localStorage.removeItem("akbay_token");
      setToken(null);
      setUser(null);
    }

    if (isHostDevice) {
      fetch(`${API_BASE}/auth/host-token`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.token) {
            localStorage.setItem("akbay_token", data.token);
            setToken(data.token);
            setUser(decodeTokenPayload(data.token));
          }
        })
        .catch(() => {})
        .finally(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, []);

  async function login(username: string, password: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Invalid username or password");
      }
      const data = await res.json();
      localStorage.setItem("akbay_token", data.token);
      setToken(data.token);
      setUser({ id: "", username: data.username, role: data.role });
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    const t = localStorage.getItem("akbay_token");
    if (t) {
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
    localStorage.removeItem("akbay_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
