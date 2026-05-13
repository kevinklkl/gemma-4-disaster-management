import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Phone, Send, Info, Loader2 } from "lucide-react";
import { MobileNav } from "../components/MobileNav";
import { TopNav } from "../components/TopNav";

export function MobileIntake() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message.trim(),
          source: source.trim() || "Walk-in",
          message_type: "walkin",
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      navigate("/inbox");
    } catch (err) {
      setError("Failed to submit report. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <TopNav hideNewReport />

      <main className="flex-grow container mx-auto px-4 pt-6 pb-32 max-w-lg">
        <div className="mb-8 px-2">
          <h2
            className="font-display font-bold"
            style={{ fontSize: 28, color: "var(--color-ink-soft)", letterSpacing: "-0.02em", lineHeight: 1.15 }}
          >
            add a report
          </h2>
          <p className="text-sm mt-2" style={{ color: "var(--color-ash)" }}>
            capture what came in. paste from a chat thread, type what the sender said, or transcribe a voice note. Bisaya, Tagalog, English — all fine.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-end px-1">
              <label className="font-headline font-semibold text-lg text-on-surface" htmlFor="message">Message *</label>
              <span className="text-xs text-on-surface-variant font-medium bg-surface-container-high px-2 py-1 rounded-md">Required</span>
            </div>
            <div className="relative group">
              <textarea
                className="w-full bg-surface-container-lowest border-2 border-outline-variant/30 rounded-xl p-4 text-on-surface placeholder:text-outline focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 text-base leading-relaxed outline-none"
                id="message"
                placeholder="Paste from Viber/Messenger or type what victim said. Bisaya / Tagalog / English OK"
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-2 mb-3">
                <Search className="text-primary w-4 h-4" />
                <label className="font-headline font-semibold text-on-surface" htmlFor="source">Source (Optional)</label>
              </div>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                id="source"
                placeholder="e.g. Maria, kagawad, Viber"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="text-primary w-4 h-4" />
                <label className="font-headline font-semibold text-on-surface" htmlFor="contact">Contact number (Optional)</label>
              </div>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                id="contact"
                placeholder="09XX-XXX-XXXX"
                type="tel"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-xl text-error text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-tertiary-container/10 rounded-xl border border-tertiary/20 mt-4">
            <Info className="text-tertiary w-5 h-5 flex-shrink-0" />
            <p className="text-xs text-on-tertiary-container leading-relaxed italic">
              Gemma AI will automatically extract location and urgency from your text. Please ensure numbers (count of families/babies) are accurate.
            </p>
          </div>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="px-4 pb-[84px] md:pb-4">
          <button
            type="submit"
            form="intake-form"
            disabled={loading || !message.trim()}
            onClick={handleSubmit}
            className="w-full py-5 bg-primary text-on-primary font-headline font-bold text-xl rounded-xl shadow-lg active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Submitting...</>
            ) : (
              <>SUBMIT <Send className="w-6 h-6" /></>
            )}
          </button>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
