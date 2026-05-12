import { Link } from "react-router-dom";
import { Bell, HelpCircle, Menu, Home, Users, Map, Droplet, ShoppingBag, Tent, Hand as CleanHands, Shirt, Zap, Baby, ArrowUpRight, Copy } from "lucide-react";
import { MobileNav } from "../components/MobileNav";
import { Brand } from "../components/Brand";

export function DonorView() {
  return (
    <div className="bg-background text-on-surface min-h-screen">
      <header
        className="flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50"
        style={{ background: "var(--color-dagat)", color: "var(--color-bone)", borderBottom: "1px solid var(--color-dagat-deep)" }}
      >
        <Brand variant="on-dark" size={28} linkTo="/" />

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-1">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{ color: "rgba(251,246,232,0.7)" }}
            >
              pulso
            </Link>
            <Link
              to="/donor-view"
              className="px-3 py-1.5 rounded-md text-sm font-semibold"
              style={{ background: "rgba(224,138,30,0.18)", color: "var(--color-bone)" }}
            >
              donor view
            </Link>
          </nav>

          <div className="flex items-center gap-2" style={{ color: "rgba(251,246,232,0.7)" }}>
            <button className="p-2 rounded-full" aria-label="notifications">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button className="p-2 rounded-full" aria-label="help">
              <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <button
          className="md:hidden p-2 rounded-full"
          style={{ color: "var(--color-bone)" }}
          aria-label="menu"
        >
          <Menu className="w-6 h-6" strokeWidth={1.75} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12 mb-20 md:mb-8">
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error-container text-on-error-container text-sm font-bold mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
            </span>
            LIVE RELIEF OPS
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-black text-on-surface tracking-tight mb-2">
            Brgy. San Roque, Cebu City - Typhoon Relief Operations
          </h1>
          <p className="text-on-surface-variant font-medium flex items-center justify-center md:justify-start gap-2">
            Last updated: 2 minutes ago
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <Home className="text-primary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">127</div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">Households Affected</div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <Users className="text-primary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">~540</div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">People Affected</div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 shadow-sm flex flex-col items-center justify-center text-center">
            <Map className="text-tertiary w-10 h-10 mb-3" />
            <div className="text-5xl font-headline font-black text-on-surface mb-1">4/5</div>
            <div className="text-on-surface-variant font-bold uppercase tracking-wider text-xs">Sitios Reporting</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-error-container text-error rounded-lg">
                  <Home className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Critical Needs</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container-low p-6 rounded-lg border-l-4 border-error">
                  <Droplet className="text-on-surface-variant mb-4 w-6 h-6" />
                  <h3 className="font-bold text-on-surface mb-1">Drinking water</h3>
                  <p className="text-3xl font-headline font-black text-error">47 <span className="text-sm font-sans font-bold text-on-surface-variant uppercase">hh</span></p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-lg border-l-4 border-error">
                  <ShoppingBag className="text-on-surface-variant mb-4 w-6 h-6" />
                  <h3 className="font-bold text-on-surface mb-1">Family food packs</h3>
                  <p className="text-3xl font-headline font-black text-error">62 <span className="text-sm font-sans font-bold text-on-surface-variant uppercase">hh</span></p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-lg border-l-4 border-error">
                  <Tent className="text-on-surface-variant mb-4 w-6 h-6" />
                  <h3 className="font-bold text-on-surface mb-1">Tarpaulins/shelter</h3>
                  <p className="text-3xl font-headline font-black text-error">18 <span className="text-sm font-sans font-bold text-on-surface-variant uppercase">hh</span></p>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-primary-fixed text-primary rounded-lg">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Other Material Needs</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                  <div className="flex items-center gap-4">
                    <CleanHands className="text-on-surface-variant w-5 h-5" />
                    <span className="font-bold text-on-surface">Hygiene kits</span>
                  </div>
                  <span className="bg-surface-container-highest px-4 py-1 rounded-full font-bold text-on-surface-variant text-sm">7 households</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                  <div className="flex items-center gap-4">
                    <Shirt className="text-on-surface-variant w-5 h-5" />
                    <span className="font-bold text-on-surface">Clothing</span>
                  </div>
                  <span className="bg-surface-container-highest px-4 py-1 rounded-full font-bold text-on-surface-variant text-sm">6 households</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                  <div className="flex items-center gap-4">
                    <Zap className="text-on-surface-variant w-5 h-5" />
                    <span className="font-bold text-on-surface">Light/power</span>
                  </div>
                  <span className="bg-surface-container-highest px-4 py-1 rounded-full font-bold text-on-surface-variant text-sm">12 households</span>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <section className="bg-surface-container-high p-8 rounded-xl border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-tertiary-fixed text-tertiary rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-headline font-bold text-on-surface">Vulnerable Populations</h2>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 flex-shrink-0 bg-white rounded-full flex items-center justify-center text-tertiary shadow-sm">
                    <Baby className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-headline font-black text-on-surface">11 hh</div>
                    <div className="text-sm font-bold text-on-surface-variant">with infants</div>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 flex-shrink-0 bg-white rounded-full flex items-center justify-center text-tertiary shadow-sm">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-headline font-black text-on-surface">23 hh</div>
                    <div className="text-sm font-bold text-on-surface-variant">with elderly members</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-primary text-on-primary p-8 rounded-xl shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl font-headline font-bold mb-4">Coordination Info</h2>
                <div className="space-y-4 mb-8">
                  <div className="flex gap-3">
                    <div>
                      <div className="text-xs uppercase font-bold opacity-70 tracking-widest">Brgy. Captain</div>
                      <div className="font-bold">+63 917 XXX XXXX</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <div className="text-xs uppercase font-bold opacity-70 tracking-widest">Location</div>
                      <div className="font-bold">Brgy. Hall, San Roque, Cebu City</div>
                    </div>
                  </div>
                </div>
                <button className="w-full bg-on-primary text-primary font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-surface transition-all active:scale-95">
                  <Copy className="w-5 h-5" />
                  Copy summary for sharing
                </button>
              </div>
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl"></div>
            </section>
            
            <div className="text-center md:text-left px-4 py-2 border-t border-outline-variant/30 mt-4">
              <p className="text-xs font-label text-on-surface-variant">
                <span className="font-bold text-primary">Powered by local Gemma 4.</span> Data stays in barangay.
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="max-w-7xl mx-auto px-4 mb-20 md:mb-12">
        <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/30">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-headline font-bold text-on-surface">Impact Coverage Area</h3>
            <span className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline">
              <ArrowUpRight className="w-4 h-4" />
              View Full Map
            </span>
          </div>
          <div className="w-full h-48 rounded-lg overflow-hidden bg-surface-dim relative group cursor-crosshair">
            <img alt="Topographic map of Cebu City" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuASpvAIAw0UiejznitJlUauNFmhTfhgRIE14baNVXM76E5sDlTSxOU6n1F2Yu0rs_doXfG4x8TPUovmR7AomknU7JldygomPmDv-vkhxOy0bYajPW1-6qNqsIDpsv0CgV7bupNcn0avEfEmUipHejeQwZuKgZqniA3F8rb8SPj9aVr-7lwg7kLze1eKoPC74aEUYvcXAXPZh9dhx5_5CIjutTLPjmJve1hLNeTh88P7oCSm9UgRDgkAtvYXe3ykrYu4ByQ6VAWP8z3U" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-surface/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-primary/20">
                <span className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Map className="text-primary w-5 h-5" />
                  4 Active Monitoring Sitios
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <MobileNav />
    </div>
  );
}
