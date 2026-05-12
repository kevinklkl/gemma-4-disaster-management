import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, Keyboard, Mic, Camera, Mail, FlaskConical, Loader2, CheckCircle2 } from "lucide-react";
import { MobileNav } from "../components/MobileNav";
import { Brand } from "../components/Brand";

export function IntakeChannelSelector() {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState<number | null>(null);

  const handleSeedInbox = async () => {
    setSeeding(true);
    setSeeded(null);
    try {
      const res = await fetch("/api/seed-inbox", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSeeded(data.queued);
    } catch {
      setSeeded(-1);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50"
        style={{ background: "var(--color-dagat)", color: "var(--color-bone)", borderBottom: "1px solid var(--color-dagat-deep)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-full active:scale-95 duration-150"
            style={{ color: "var(--color-bone)" }}
            aria-label="back"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
          </Link>
          <Brand variant="on-dark" size={26} linkTo={null} />
        </div>
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5" strokeWidth={1.75} style={{ color: "rgba(251,246,232,0.7)" }} />
        </div>
      </header>

      <main className="flex-1 px-6 pt-8 pb-32 max-w-lg mx-auto w-full">
        <section className="mb-10">
          <h2
            className="font-display font-bold mb-2"
            style={{ fontSize: 28, color: "var(--color-ink-soft)", letterSpacing: "-0.02em", lineHeight: 1.15 }}
          >
            add a report
          </h2>
          <p className="text-sm" style={{ color: "var(--color-ash)" }}>
            pick a channel to log what came in. SMS, voice note, or a photo of a handwritten list.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6">
          <Link to="/intake/type" className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-container/20 text-primary">
              <Keyboard className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">type message</h3>
              <p className="text-sm text-on-surface-variant">walk-in, Viber, or Messenger relay</p>
            </div>
          </Link>

          <button className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-tertiary-container/20 text-tertiary">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">voice note</h3>
              <p className="text-sm text-on-surface-variant">record or upload a clip</p>
            </div>
          </button>

          <button className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary-container/60 text-secondary">
              <Camera className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">photo of note</h3>
              <p className="text-sm text-on-surface-variant">handwritten list or a document</p>
            </div>
          </button>
        </div>

        <button
          onClick={handleSeedInbox}
          disabled={seeding}
          className="mt-8 w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary/10 text-secondary shrink-0">
            {seeding ? <Loader2 className="w-5 h-5 animate-spin" /> : seeded !== null && seeded >= 0 ? <CheckCircle2 className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
          </div>
          <div className="text-left">
            <p className="font-bold text-on-surface text-sm">load synthetic messages</p>
            <p className="text-xs text-on-surface-variant">
              {seeding ? "sending to inbox…" : seeded !== null && seeded >= 0 ? `${seeded} messages queued for processing` : seeded === -1 ? "failed — check the server" : "send test dataset to inbox"}
            </p>
          </div>
        </button>

        <section className="mt-6 p-6 rounded-xl bg-surface-container-highest/40 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Mail className="text-primary w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm flex items-center gap-2">
                SMS auto-intake
                <span className="ak-caps px-2 py-0.5 rounded-full" style={{ background: "var(--color-damay-soft)", color: "var(--color-damay)", fontSize: 10, letterSpacing: "0.06em" }}>active</span>
              </p>
              <p className="text-on-surface-variant text-xs">waiting for incoming messages</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary leading-none">47</p>
            <p className="ak-caps mt-0.5" style={{ color: "var(--color-ash)" }}>today</p>
          </div>
        </section>
      </main>

      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[200px] h-[200px] rounded-full bg-tertiary/5 blur-3xl"></div>
      </div>

      <MobileNav />
    </div>
  );
}
