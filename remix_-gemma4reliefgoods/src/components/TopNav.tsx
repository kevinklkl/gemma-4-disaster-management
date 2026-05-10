import { Link, useLocation } from "react-router-dom";
import { Plus, Box, ClipboardList, Activity, Inbox as InboxIcon, Map as MapIcon } from "lucide-react";

export function TopNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <header className="flex justify-between items-center w-full px-6 py-3 bg-surface border-b border-outline-variant/20 sticky top-0 z-40 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 pr-6 border-r border-outline-variant/30">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <Box className="w-5 h-5" />
          </div>
          <h2 className="font-headline font-black text-primary text-lg leading-tight hidden sm:block">Relief HQ</h2>
        </div>

        <nav className="hidden md:flex gap-2">
          <Link 
            to="/inbox" 
            className={`px-3 py-2 text-sm font-label rounded-md flex items-center gap-2 ${path === '/inbox' ? 'font-bold text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            <InboxIcon className="w-4 h-4" /> Inbox
          </Link>
          <Link 
            to="/" 
            className={`px-3 py-2 text-sm font-label rounded-md flex items-center gap-2 ${path === '/' ? 'font-bold text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            <Activity className="w-4 h-4" /> NDS (Dispatch)
          </Link>
          <Link 
            to="/coverage" 
            className={`px-3 py-2 text-sm font-label rounded-md flex items-center gap-2 ${path === '/coverage' ? 'font-bold text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            <MapIcon className="w-4 h-4" /> Coverage
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <Link to="/intake" className="hidden sm:flex bg-primary text-on-primary rounded-lg py-2 px-4 items-center justify-center gap-2 font-bold hover:brightness-110 active:scale-95 transition-all text-sm">
          <Plus className="w-4 h-4" /> New Report
        </Link>
      </div>
    </header>
  );
}
