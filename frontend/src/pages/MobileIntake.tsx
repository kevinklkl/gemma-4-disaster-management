import { Link } from "react-router-dom";
import { ArrowLeft, Bell, MapPin, Search, Phone, Send, Info } from "lucide-react";
import { MobileNav } from "../components/MobileNav";

export function MobileIntake() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <nav className="bg-surface-container-low dark:bg-surface-dim flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/intake" className="active:scale-95 duration-150 p-2 hover:bg-surface-container-high rounded-full">
            <ArrowLeft className="text-primary w-6 h-6" />
          </Link>
          <h1 className="font-headline font-bold text-xl leading-relaxed text-primary">Type message</h1>
        </div>
        <div className="flex items-center gap-4">
          <Bell className="text-on-surface-variant w-5 h-5" />
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden border border-outline-variant">
            <img alt="Operator Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4c4s0z6ZNK-mehU1mdZv08xdz8UjTl-QALmcEgobiRuoyQoeWt92afMYtuBX3kzvT_5m9Elkjhc4rHHpDiNf6wogszmS9Mx4lC0EsMEl5l8b_JJBG47jTyz98Y3PWcAO2ZyTcH8yNlpYBPFj7KaRficsGs8CRFBGw5iA1o72UB81ZJErA5bMTXTFHYajGnvTax4Tg7bu7Ejr1MiJgOyhk5XCSsK73VIMigK9tO-mfr_qz6iQYqzWNL-maMHsooY28hpMyVPueNui2" />
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 pt-6 pb-32 max-w-lg">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="text-tertiary w-4 h-4" />
            <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant font-bold">Brgy. San Roque</span>
          </div>
          <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight">Intake Report</h2>
          <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">Please capture the victim's request accurately. The system will automatically triage needs and location.</p>
        </div>

        <form className="space-y-6">
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
              />
            </div>
          </div>

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
          <button className="w-full py-5 bg-primary text-on-primary font-headline font-bold text-xl rounded-xl shadow-lg active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-3">
            SUBMIT
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <MobileNav />
    </div>
  );
}
