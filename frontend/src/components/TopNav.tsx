import { Link, useLocation } from "react-router-dom";
import { Plus, Home as HomeIcon, Activity, Inbox as InboxIcon, Map as MapIcon, Reply, Clock, HeartHandshake } from "lucide-react";
import { Brand } from "./Brand";

type Tab = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  { to: "/",         label: "home",     icon: <HomeIcon className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/pulso",    label: "pulso",    icon: <Activity className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/inbox",    label: "inbox",    icon: <InboxIcon className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/coverage", label: "coverage", icon: <MapIcon className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/sagot",    label: "sagot",    icon: <Reply className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/history",  label: "history",  icon: <Clock className="w-4 h-4" strokeWidth={1.75} /> },
  { to: "/donor-view", label: "donor view", icon: <HeartHandshake className="w-4 h-4" strokeWidth={1.75} /> },
];

export function TopNav({ hideNewReport = false }: { hideNewReport?: boolean } = {}) {
  const { pathname } = useLocation();

  return (
    <header
      className="flex items-center gap-2 w-full px-7 py-3 sticky top-0 z-40 shrink-0"
      style={{ background: "var(--color-dagat)", color: "var(--color-bone)", borderBottom: "1px solid var(--color-dagat-deep)" }}
    >
      <div
        className="flex items-center gap-3 pr-5 mr-3"
        style={{ borderRight: "1px solid var(--color-dagat-line)" }}
      >
        <Brand variant="on-dark" size={28} linkTo="/" />
      </div>

      <nav className="hidden md:flex gap-0.5 flex-1">
        {TABS.map(t => {
          const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm whitespace-nowrap transition-colors"
              style={{
                background: active ? "rgba(224,138,30,0.18)" : "transparent",
                color: active ? "var(--color-bone)" : "rgba(251,246,232,0.7)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 ml-auto">
        {!hideNewReport && (
          <Link
            to="/intake"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md py-2 px-3.5 text-sm font-semibold transition-colors"
            style={{ background: "var(--color-araw)", color: "var(--color-ink)" }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            new report
          </Link>
        )}
      </div>
    </header>
  );
}
