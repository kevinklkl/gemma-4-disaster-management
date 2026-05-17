import { useState, useEffect } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { ArrowRight, CheckCircle2, Loader2, Smartphone, AlertCircle } from "lucide-react";

type DeviceType = "android" | "iphone" | "windows" | "mac";
type ProbeStatus = "loading" | "connected" | "host" | "disconnected";

function detectDevice(): DeviceType {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Windows/i.test(ua)) return "windows";
  return "mac";
}

// ─── Connected state ──────────────────────────────────────────────────────────

function ConnectedView({
  isHost,
  nodeName,
  jobsDone,
  onLeave,
}: {
  isHost: boolean;
  nodeName: string;
  jobsDone: number;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "#dcfce7" }}
      >
        <CheckCircle2 className="w-8 h-8" style={{ color: "#16a34a" }} strokeWidth={2} />
      </div>

      <div>
        <h2
          className="font-display font-bold"
          style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
        >
          all working fine
        </h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--color-ash)" }}>
          {isHost
            ? "this machine is the host — already part of the pool."
            : `this computer is sharing processing power with the network.`}
        </p>
      </div>

      <div
        className="w-full max-w-xs rounded-xl px-5 py-4 flex items-center gap-4"
        style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: "#16a34a" }}
        />
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-ink)" }}>
            {nodeName || "this computer"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-ash)" }}>
            {jobsDone} jobs processed
          </p>
        </div>
      </div>

      {!isHost && (
        <button
          onClick={onLeave}
          className="text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
        >
          leave pool
        </button>
      )}
    </div>
  );
}

// ─── Android guide ────────────────────────────────────────────────────────────

function AndroidGuide() {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
      >
        <Smartphone className="w-8 h-8" style={{ color: "var(--color-dagat)" }} strokeWidth={1.5} />
      </div>

      <div>
        <h2
          className="font-display font-bold"
          style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
        >
          download our app
        </h2>
        <p className="text-sm mt-1.5 max-w-xs" style={{ color: "var(--color-ash)" }}>
          to contribute your Android device to the node pool, download the Bayanihan Node app.
        </p>
      </div>

      <a
        href="https://play.google.com/store"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all"
        style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
      >
        <Smartphone className="w-4 h-4" strokeWidth={2} />
        get it on Google Play
        <ArrowRight className="w-4 h-4" />
      </a>

      <p className="text-xs max-w-xs" style={{ color: "var(--color-smoke)" }}>
        the app runs Gemma locally on your device and connects it to the network automatically.
      </p>
    </div>
  );
}

// ─── iPhone guide ─────────────────────────────────────────────────────────────

function IphoneGuide() {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-10">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
      >
        <AlertCircle className="w-8 h-8" style={{ color: "var(--color-smoke)" }} strokeWidth={1.5} />
      </div>

      <div>
        <h2
          className="font-display font-bold"
          style={{ fontSize: 22, color: "var(--color-ink)", letterSpacing: "-0.02em" }}
        >
          not available on iPhone
        </h2>
        <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: "var(--color-ash)" }}>
          unfortunately iOS restrictions prevent apps from running AI models locally in the background.
          to contribute to the network, use an Android phone or a computer.
        </p>
      </div>

      <div
        className="rounded-xl px-5 py-4 max-w-xs w-full text-left"
        style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-ash)" }}>you can still help by</p>
        <ul className="space-y-1.5">
          {["submitting reports via this app", "sharing the link with someone who has Android or a laptop"].map(item => (
            <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-dagat)" }} strokeWidth={2} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Desktop setup guide ──────────────────────────────────────────────────────

function DesktopGuide({
  device,
  onConnected,
}: {
  device: "windows" | "mac";
  onConnected: (name: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [cmdCopied, setCmdCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const scriptPath = name.trim()
    ? `/api/nodes/join-script?name=${encodeURIComponent(name.trim())}`
    : "/api/nodes/join-script";
  const curlCommand = `curl -fsSL "${window.location.origin}${scriptPath}" | bash`;

  function copyCmd() {
    navigator.clipboard.writeText(curlCommand).then(() => {
      setCmdCopied(true);
      setTimeout(() => setCmdCopied(false), 2000);
    });
  }

  function confirm() {
    setJoining(true);
    setError("");
    fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (!data.ok) {
          setError(
            data.status === "no_model"
              ? "The AI model isn't installed on this machine. Did the script finish?"
              : "Couldn't connect — did you run the script and leave the terminal open?"
          );
          setJoining(false);
          return;
        }
        onConnected(name.trim());
      })
      .catch(() => {
        setError("Something went wrong. Try again.");
        setJoining(false);
      });
  }

  // Auto-detect after script runs
  useEffect(() => {
    if (step !== 2) return;
    const id = setInterval(() => {
      fetch("/api/nodes/me")
        .then(r => r.json())
        .then(data => {
          if (data.registered && !data.isHost) {
            onConnected(name.trim());
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [step]);

  return (
    <div className="flex flex-col gap-8 max-w-sm mx-auto py-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={
                s < step
                  ? { background: "#16a34a", color: "#fff" }
                  : s === step
                  ? { background: "var(--color-dagat)", color: "var(--color-bone)" }
                  : { background: "var(--color-paper-edge)", color: "var(--color-ash)" }
              }
            >
              {s < step ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : s}
            </div>
            {s < 2 && <div className="flex-1 h-px w-8" style={{ background: "var(--color-paper-edge)" }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — name + run */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-display font-bold" style={{ fontSize: 20, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
              {device === "windows" ? "set up on this PC" : "set up on this Mac"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
              give this computer a name so you can identify it in the pool.
            </p>
          </div>

          <div>
            <label className="ak-caps text-xs block mb-1.5" style={{ color: "var(--color-ash)" }}>computer name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={device === "mac" ? "e.g. Jacob's Mac" : "e.g. Jacob's PC"}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: "var(--color-paper-warm)",
                border: "1px solid var(--color-paper-edge)",
                color: "var(--color-ink)",
              }}
            />
          </div>

          {device === "windows" ? (
            <div className="flex flex-col gap-3">
              <a
                href={scriptPath}
                download
                onClick={() => setTimeout(() => setStep(2), 600)}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
              >
                download setup file <ArrowRight className="w-4 h-4" />
              </a>
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
              >
                <span className="text-xl shrink-0">📄</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>join-node.bat</p>
                  <p className="text-xs" style={{ color: "var(--color-ash)" }}>double-click to run after download</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--color-ash)" }}>
                  open Terminal (<kbd className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: "var(--color-paper-deep)" }}>⌘ Space</kbd> → type Terminal) and paste:
                </p>
                <div
                  className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: "var(--color-paper-deep)", border: "1px solid var(--color-paper-edge)" }}
                >
                  <code className="text-xs font-mono flex-1 break-all leading-relaxed" style={{ color: "var(--color-ink)" }}>
                    {curlCommand}
                  </code>
                  <button
                    onClick={copyCmd}
                    className="shrink-0 px-2 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
                  >
                    {cmdCopied ? "copied!" : "copy"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                style={{ background: "var(--color-dagat)", color: "var(--color-bone)" }}
              >
                I've run it <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — waiting / confirm */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-display font-bold" style={{ fontSize: 20, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
              connecting…
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
              watching for this computer to appear on the network.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--color-dagat)" }} />
            <p className="text-sm" style={{ color: "var(--color-ash)" }}>this usually takes a few seconds</p>
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.15)" }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: "var(--color-paper-warm)", color: "var(--color-ink-soft)", border: "1px solid var(--color-paper-edge)" }}
            >
              ← back
            </button>
            <button
              onClick={confirm}
              disabled={joining}
              className="flex-[2] py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--color-paper-deep)", color: "var(--color-ink-soft)", border: "1px solid var(--color-paper-edge)" }}
            >
              {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> connecting…</> : "connect manually"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Network() {
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("loading");
  const [myNode, setMyNode] = useState<{ name: string; jobs_done: number } | null>(null);
  const device = detectDevice();

  useEffect(() => {
    fetch("/api/nodes/probe")
      .then(r => r.json())
      .then(data => {
        if (data.isHost) {
          setProbeStatus("host");
          setMyNode({ name: "host machine", jobs_done: 0 });
        } else if (data.joined) {
          setProbeStatus("connected");
          const me = (data.nodes ?? []).find((n: { url: string; name: string; jobs_done: number }) =>
            n.url === window.location.origin || n.url?.includes("localhost") || n.url?.includes("127.0.0.1")
          );
          setMyNode({ name: me?.name ?? "this computer", jobs_done: me?.jobs_done ?? 0 });
        } else {
          setProbeStatus("disconnected");
        }
      })
      .catch(() => setProbeStatus("disconnected"));
  }, []);

  function handleLeave() {
    fetch("/api/nodes/me", { method: "DELETE" })
      .then(() => {
        setProbeStatus("disconnected");
        setMyNode(null);
      })
      .catch(() => {});
  }

  function handleConnected(name: string) {
    setProbeStatus("connected");
    setMyNode({ name: name || "this computer", jobs_done: 0 });
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--color-paper)" }}>
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="p-6 md:p-8 max-w-lg mx-auto">
            <div className="mb-8">
              <h1
                className="font-display font-bold leading-tight"
                style={{ fontSize: 28, color: "var(--color-ink-soft)", letterSpacing: "-0.025em" }}
              >
                network
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-ash)" }}>
                contribute your device to help process incoming messages with Gemma AI.
              </p>
            </div>

            {probeStatus === "loading" && (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--color-ash)" }} />
              </div>
            )}

            {(probeStatus === "connected" || probeStatus === "host") && myNode && (
              <ConnectedView
                isHost={probeStatus === "host"}
                nodeName={myNode.name}
                jobsDone={myNode.jobs_done}
                onLeave={handleLeave}
              />
            )}

            {probeStatus === "disconnected" && device === "android" && <AndroidGuide />}
            {probeStatus === "disconnected" && device === "iphone" && <IphoneGuide />}
            {probeStatus === "disconnected" && (device === "windows" || device === "mac") && (
              <DesktopGuide device={device} onConnected={handleConnected} />
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
