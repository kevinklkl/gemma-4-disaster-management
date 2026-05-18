import { createContext, useContext, useState, useEffect, ReactNode } from "react";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("akbay_device_id");
  if (!id) {
    id = crypto.randomUUID?.() ??
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    localStorage.setItem("akbay_device_id", id);
  }
  return id;
}

type DeviceState = {
  deviceId: string;
  receiving: boolean;
  setReceiving: (val: boolean) => Promise<void>;
};

const DeviceContext = createContext<DeviceState | null>(null);

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [deviceId] = useState(getOrCreateDeviceId);
  const [receiving, setReceivingState] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deviceId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.receiving !== undefined) setReceivingState(Boolean(d.receiving)); })
      .catch(() => {});
  }, [deviceId]);

  async function setReceiving(val: boolean) {
    await fetch(`${API_BASE}/devices/${deviceId}/receiving`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Device-ID": deviceId },
      body: JSON.stringify({ receiving: val }),
    });
    setReceivingState(val);
  }

  return (
    <DeviceContext.Provider value={{ deviceId, receiving, setReceiving }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function deviceHeaders(deviceId: string): Record<string, string> {
  return { "X-Device-ID": deviceId };
}

export function authHeaders(_token: string | null): Record<string, string> {
  return {};
}
