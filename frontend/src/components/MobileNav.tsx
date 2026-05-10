import { Link, useLocation } from "react-router-dom";
import { PlusCircle, LayoutDashboard, User, Inbox as InboxIcon } from "lucide-react";

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container-highest dark:bg-inverse-surface rounded-t-xl shadow-lg">
      <Link 
        to="/" 
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 transition-transform duration-100 ${location.pathname === '/' ? 'bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary' : 'text-on-surface-variant dark:text-outline-variant hover:bg-primary-fixed dark:hover:bg-primary-fixed-dim'}`}
      >
        <LayoutDashboard className="w-6 h-6" fill={location.pathname === '/' ? "currentColor" : "none"} />
        <span className="font-label text-[10px] uppercase tracking-wider mt-1">Updates</span>
      </Link>

      <Link 
        to="/inbox" 
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 transition-transform duration-100 ${location.pathname === '/inbox' ? 'bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary' : 'text-on-surface-variant dark:text-outline-variant hover:bg-primary-fixed dark:hover:bg-primary-fixed-dim'}`}
      >
        <InboxIcon className="w-6 h-6" fill={location.pathname === '/inbox' ? "currentColor" : "none"} />
        <span className="font-label text-[10px] uppercase tracking-wider mt-1">Inbox</span>
      </Link>
      
      <Link 
        to="/intake" 
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 transition-transform duration-100 ${location.pathname.startsWith('/intake') ? 'bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary' : 'text-on-surface-variant dark:text-outline-variant hover:bg-primary-fixed dark:hover:bg-primary-fixed-dim'}`}
      >
        <PlusCircle className="w-6 h-6" fill={location.pathname.startsWith('/intake') ? "currentColor" : "none"} />
        <span className="font-label text-[10px] uppercase tracking-wider mt-1">Intake</span>
      </Link>

      <Link 
        to="/profile" 
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 transition-transform duration-100 ${location.pathname === '/profile' ? 'bg-primary-container dark:bg-primary text-on-primary-container dark:text-on-primary' : 'text-on-surface-variant dark:text-outline-variant hover:bg-primary-fixed dark:hover:bg-primary-fixed-dim'}`}
      >
        <User className="w-6 h-6" fill={location.pathname === '/profile' ? "currentColor" : "none"} />
        <span className="font-label text-[10px] uppercase tracking-wider mt-1">Profile</span>
      </Link>
    </nav>
  );
}
