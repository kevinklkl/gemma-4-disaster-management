import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, Keyboard, Mic, Camera, Mail } from "lucide-react";
import { MobileNav } from "../components/MobileNav";

export function IntakeChannelSelector() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50 bg-surface dark:bg-inverse-surface shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors active:scale-95 duration-150">
            <ArrowLeft className="text-primary dark:text-primary-fixed-dim w-6 h-6" />
          </Link>
          <h1 className="font-headline font-bold text-xl text-primary dark:text-primary-fixed-dim leading-relaxed">
            Brgy San Roque Intake
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpCircle className="text-on-surface-variant dark:text-outline-variant w-6 h-6" />
        </div>
      </header>

      <main className="flex-1 px-6 pt-8 pb-32 max-w-lg mx-auto w-full">
        <section className="mb-10">
          <h2 className="text-3xl font-bold mb-2 text-on-surface font-headline">How did this come in?</h2>
          <p className="text-on-surface-variant font-medium">Select a channel to begin logging relief needs.</p>
        </section>

        <div className="grid grid-cols-1 gap-6">
          <Link to="/intake/type" className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-container/20 text-primary">
              <Keyboard className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">Type message</h3>
              <p className="text-sm text-on-surface-variant">Walk-in / Viber / Messenger relay</p>
            </div>
          </Link>

          <button className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-tertiary-container/20 text-tertiary">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">Voice note</h3>
              <p className="text-sm text-on-surface-variant">Record or upload clip</p>
            </div>
          </button>

          <button className="btn-tap-target w-full flex items-center gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-left transition-all active:scale-[0.98] duration-150 group">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary-container/60 text-secondary">
              <Camera className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-on-surface mb-1 font-headline">Photo of note</h3>
              <p className="text-sm text-on-surface-variant">Handwritten list or document</p>
            </div>
          </button>
        </div>

        <section className="mt-12 p-6 rounded-xl bg-surface-container-highest/40 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Mail className="text-primary w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm flex items-center gap-2">
                SMS auto-intake
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">✓ Active</span>
              </p>
              <p className="text-on-surface-variant text-xs">Waiting for incoming messages</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary leading-none">47</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Today</p>
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
