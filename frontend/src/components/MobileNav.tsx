import { Link, useLocation } from "react-router-dom";
import { PlusCircle, Activity, MessageSquare, Network as NetworkIcon } from "lucide-react";

type Tab = {
  to: string;
  label: string;
  isActive: (path: string) => boolean;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  { to: "/pulso",   label: "pulso",   isActive: p => p === "/pulso",           icon: <Activity className="w-6 h-6" strokeWidth={1.75} /> },
  { to: "/network", label: "network", isActive: p => p === "/network",         icon: <NetworkIcon className="w-6 h-6" strokeWidth={1.75} /> },
  { to: "/intake",  label: "intake",  isActive: p => p.startsWith("/intake"),  icon: <PlusCircle className="w-6 h-6" strokeWidth={1.75} /> },
  { to: "/tickets", label: "tickets", isActive: p => p === "/tickets",         icon: <MessageSquare className="w-6 h-6" strokeWidth={1.75} /> },
];

export function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 rounded-t-xl shadow-lg"
      style={{ background: "var(--color-dagat)" }}
    >
      {TABS.map(t => {
        const active = t.isActive(pathname);
        return (
          <Link
            key={t.to}
            to={t.to}
            className="flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-95 transition-transform duration-100"
            style={{
              background: active ? "rgba(224,138,30,0.18)" : "transparent",
              color: active ? "var(--color-bone)" : "rgba(251,246,232,0.7)",
            }}
          >
            {t.icon}
            <span className="text-[10px] mt-1" style={{ letterSpacing: 0 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
