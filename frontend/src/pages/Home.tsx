import { Link } from "react-router-dom";
import {
  Plus,
  Inbox as InboxIcon,
  Activity,
  Map as MapIcon,
  Reply,
  Clock,
  HeartHandshake,
  ArrowDown,
  Share2,
  Download,
  Mail,
  Github,
  Linkedin,
  User,
} from "lucide-react";
import { TopNav } from "../components/TopNav";
import { Brand } from "../components/Brand";

type Step = {
  n: number;
  to: string;
  label: string;
  icon: React.ReactNode;
  blurb: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    to: "/intake",
    label: "intake",
    icon: <Plus className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "log a report — typed, voice note, or photo of a handwritten list.",
  },
  {
    n: 2,
    to: "/inbox",
    label: "inbox",
    icon: <InboxIcon className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "watch reports get parsed: location, urgency, items extracted by Gemma.",
  },
  {
    n: 3,
    to: "/pulso",
    label: "pulso",
    icon: <Activity className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "the live dashboard — needs aggregated per location, urgent first.",
  },
  {
    n: 4,
    to: "/coverage",
    label: "coverage",
    icon: <MapIcon className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "map view of where help is needed and what's already reached.",
  },
  {
    n: 5,
    to: "/sagot",
    label: "sagot",
    icon: <Reply className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "AI-drafted replies to donor questions, ready to review and send.",
  },
  {
    n: 6,
    to: "/history",
    label: "history",
    icon: <Clock className="w-5 h-5" strokeWidth={1.75} />,
    blurb: "archive across today / this week / all-time, filterable by urgency.",
  },
];

type Dev = {
  name: string;
  role: string;
  email: string;
  github: string;
  linkedin: string;
};

const DEVS: Dev[] = [
  {
    name: "developer one",
    role: "role placeholder",
    email: "name@example.com",
    github: "github.com/handle",
    linkedin: "linkedin.com/in/handle",
  },
  {
    name: "developer two",
    role: "role placeholder",
    email: "name@example.com",
    github: "github.com/handle",
    linkedin: "linkedin.com/in/handle",
  },
];

export function Home() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-paper)" }}>
      <TopNav />

      <main className="flex-1 w-full">
        {/* hero */}
        <section className="max-w-3xl mx-auto px-6 pt-14 pb-12">
          <div className="mb-6">
            <Brand variant="on-light" size={64} showWordmark linkTo={null} />
          </div>
          <p
            className="font-mono text-sm mb-6"
            style={{ color: "var(--color-ash)", letterSpacing: "0.02em" }}
          >
            beside, not above.
          </p>
          <h1
            className="font-display font-bold mb-5"
            style={{
              fontSize: 36,
              color: "var(--color-ink-soft)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            offline-first disaster relief, organized by the people on the ground.
          </h1>
          <p
            className="text-base mb-8 leading-relaxed"
            style={{ color: "var(--color-ash)", maxWidth: "60ch" }}
          >
            akbay turns scattered SMS, voice notes, walk-ins, and handwritten lists into a
            live picture of what each barangay needs — so coordinators can match supply to
            demand without waiting for the network to come back.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex items-center gap-1.5 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98]"
              style={{ background: "var(--color-araw)", color: "var(--color-ink)" }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.2} />
              add a report
            </Link>
            <Link
              to="/pulso"
              className="inline-flex items-center gap-1.5 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98]"
              style={{
                background: "transparent",
                color: "var(--color-dagat)",
                border: "1px solid var(--color-dagat)",
              }}
            >
              <Activity className="w-4 h-4" strokeWidth={2.2} />
              see today's pulso
            </Link>
          </div>
        </section>

        {/* how it works — the pipeline */}
        <section className="max-w-2xl mx-auto px-6 pb-12">
          <h2
            className="font-display font-bold mb-2"
            style={{
              fontSize: 24,
              color: "var(--color-ink-soft)",
              letterSpacing: "-0.02em",
            }}
          >
            how it works
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--color-ash)" }}>
            a report comes in, gets parsed, lands on the dashboard, gets matched. six
            stages, one direction.
          </p>

          {/* vertical pipeline */}
          <ol className="flex flex-col gap-0">
            {STEPS.map((s, i) => (
              <li key={s.to} className="flex flex-col items-stretch">
                <Link
                  to={s.to}
                  className="flex items-start gap-4 p-5 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 transition-all active:scale-[0.98] duration-150"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 font-mono text-sm font-semibold"
                    style={{
                      background: "var(--color-paper-deep)",
                      color: "var(--color-ink-soft)",
                    }}
                  >
                    {s.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--color-dagat)" }}>{s.icon}</span>
                      <h3
                        className="font-display font-bold text-base"
                        style={{ color: "var(--color-ink)", letterSpacing: "-0.01em" }}
                      >
                        {s.label}
                      </h3>
                    </div>
                    <p
                      className="text-sm leading-snug"
                      style={{ color: "var(--color-ash)" }}
                    >
                      {s.blurb}
                    </p>
                  </div>
                </Link>

                {i < STEPS.length - 1 && (
                  <div
                    className="flex items-center justify-center py-1.5"
                    aria-hidden="true"
                  >
                    <ArrowDown
                      className="w-4 h-4"
                      strokeWidth={1.75}
                      style={{ color: "var(--color-ash)" }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* donor view — separated, emphasized */}
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <div
            className="rounded-2xl overflow-hidden border-2"
            style={{
              borderColor: "var(--color-araw)",
              background: "var(--color-paper-warm)",
            }}
          >
            <div
              className="px-6 py-3 flex items-center gap-2"
              style={{
                background: "var(--color-araw)",
                color: "var(--color-ink)",
              }}
            >
              <Share2 className="w-4 h-4" strokeWidth={2} />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                outward channel
              </span>
            </div>

            <div className="px-6 py-7">
              <div className="flex items-center gap-3 mb-3">
                <HeartHandshake
                  className="w-6 h-6"
                  strokeWidth={1.75}
                  style={{ color: "var(--color-dagat)" }}
                />
                <h3
                  className="font-display font-bold"
                  style={{
                    fontSize: 24,
                    color: "var(--color-ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  donor view
                </h3>
              </div>

              <p
                className="text-base leading-relaxed mb-4"
                style={{ color: "var(--color-ink-soft)", maxWidth: "60ch" }}
              >
                a clean, public-facing snapshot of what each area needs — built to be
                shared online so donors and partners know exactly what to bring.
              </p>

              <ul
                className="text-sm leading-relaxed mb-6 space-y-1.5"
                style={{ color: "var(--color-ash)" }}
              >
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-araw)" }}>•</span>
                  share it on Facebook, Viber, email, or as a printout when network
                  allows.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-araw)" }}>•</span>
                  it does <em>not</em> update live — every share is a snapshot stamped
                  with the date and time it was generated.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-araw)" }}>•</span>
                  exportable as a printable / PDF copy operators can attach and resend.
                </li>
              </ul>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/donor-view"
                  className="inline-flex items-center gap-1.5 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98]"
                  style={{
                    background: "var(--color-dagat)",
                    color: "var(--color-bone)",
                  }}
                >
                  <HeartHandshake className="w-4 h-4" strokeWidth={2.2} />
                  preview donor view
                </Link>
                <Link
                  to="/donor-view"
                  className="inline-flex items-center gap-1.5 rounded-md py-2.5 px-4 text-sm font-semibold transition-colors active:scale-[0.98]"
                  style={{
                    background: "transparent",
                    color: "var(--color-dagat)",
                    border: "1px solid var(--color-dagat)",
                  }}
                >
                  <Download className="w-4 h-4" strokeWidth={2.2} />
                  export & share
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* what akbay means */}
        <section
          className="w-full border-t"
          style={{
            background: "var(--color-paper-warm)",
            borderColor: "var(--color-paper-edge)",
          }}
        >
          <div className="max-w-3xl mx-auto px-6 py-14">
            <h2
              className="font-display font-bold mb-4"
              style={{
                fontSize: 32,
                color: "var(--color-dagat)",
                letterSpacing: "-0.03em",
              }}
            >
              akbay
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: "var(--color-ink-soft)", maxWidth: "60ch" }}
            >
              Filipino — to put your arm around someone's shoulder. a gesture of
              solidarity, not authority. the act of walking through something
              together, side-by-side.
            </p>
            <p
              className="font-mono text-sm"
              style={{ color: "var(--color-ash)", letterSpacing: "0.02em" }}
            >
              beside, not above.
            </p>
          </div>
        </section>

        {/* developers */}
        <section
          className="w-full border-t"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-paper-edge)",
          }}
        >
          <div className="max-w-3xl mx-auto px-6 py-14">
            <h2
              className="font-display font-bold mb-2"
              style={{
                fontSize: 20,
                color: "var(--color-ink-soft)",
                letterSpacing: "-0.02em",
              }}
            >
              built by
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--color-ash)" }}>
              get in touch — feedback, partnerships, deployments.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DEVS.map((d, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl border"
                  style={{
                    background: "var(--color-paper-warm)",
                    borderColor: "var(--color-paper-edge)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
                      style={{
                        background: "var(--color-paper-deep)",
                        color: "var(--color-ink-soft)",
                      }}
                    >
                      <User className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="font-display font-bold text-base truncate"
                        style={{ color: "var(--color-ink)" }}
                      >
                        {d.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-ash)" }}>
                        {d.role}
                      </div>
                    </div>
                  </div>

                  {/* swap placeholders below with real links */}
                  <ul className="flex flex-col gap-2 text-sm">
                    <li>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 hover:underline"
                        style={{ color: "var(--color-dagat)" }}
                      >
                        <Mail className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-mono text-xs">{d.email}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 hover:underline"
                        style={{ color: "var(--color-dagat)" }}
                      >
                        <Github className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-mono text-xs">{d.github}</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 hover:underline"
                        style={{ color: "var(--color-dagat)" }}
                      >
                        <Linkedin className="w-4 h-4" strokeWidth={1.75} />
                        <span className="font-mono text-xs">{d.linkedin}</span>
                      </a>
                    </li>
                  </ul>
                </div>
              ))}
            </div>

            <div
              className="mt-10 pt-6 border-t font-mono text-xs"
              style={{
                borderColor: "var(--color-paper-edge)",
                color: "var(--color-smoke)",
              }}
            >
              © akbay — beside, not above.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
