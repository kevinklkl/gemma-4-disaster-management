import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { AlertTriangle, MapPin as MapPinIcon, CheckCircle2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix generic Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function Coverage() {
  const position: [number, number] = [10.3157, 123.8854]; // Cebu City

  const opsCenters = [
    { name: "Cebu Relief HQ", position: [10.3157, 123.8854] as [number, number], status: "active", radius: 15000 },
  ];

  const needs = [
    { id: "REQ-001", type: "Water", location: [10.3357, 123.8954], desc: "walay tubig 5 ka pamilya, naa baby", color: "#00A3FF" },
    { id: "REQ-002", type: "Shelter", location: [10.3757, 123.8554], desc: "12 households roof blew off", color: "#a25ddc" },
    { id: "REQ-003", type: "Food", location: [10.2957, 123.9054], desc: "need food packs about 30 family", color: "#FDAB3D" },
    { id: "REQ-004", type: "Medical", location: [10.3157, 123.9554], desc: "Medical assistance for elderly", color: "#E2445C" },
    { id: "REQ-005", type: "Water", location: [10.3420, 123.9050], desc: "Need drinking water for evacuation center", color: "#00A3FF" },
    { id: "REQ-006", type: "Food", location: [10.3100, 123.8600], desc: "Running out of food supplies", color: "#FDAB3D" },
    { id: "REQ-007", type: "Shelter", location: [10.3000, 123.9100], desc: "Temporary tents needed", color: "#a25ddc" },
    { id: "REQ-008", type: "Medical", location: [10.2850, 123.8700], desc: "First aid supplies low", color: "#E2445C" },
  ];

  const totals = needs.reduce(
    (acc, n) => {
      if (n.type === "Medical") acc.critical += 1;
      else if (n.type === "Shelter" || n.type === "Water") acc.high += 1;
      else if (n.type === "Food") acc.medium += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, covered: opsCenters.length }
  );

  return (
    <div className="h-screen font-body flex flex-col overflow-hidden" style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}>
      <TopNav />
      <div className="px-6 md:px-8 pt-5 pb-4" style={{ background: "var(--color-paper)" }}>
        <h1
          className="font-display font-bold leading-tight mb-1"
          style={{ fontSize: 30, color: "var(--color-ink-soft)", letterSpacing: "-0.025em", margin: 0 }}
        >
          coverage
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-ash)" }}>
          live map of barangays with active or resolved requests.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[
            { n: totals.critical, label: "critical",     bg: "rgba(168,48,46,0.12)",      fg: "var(--color-tabang)", icon: <AlertTriangle className="w-4 h-4" strokeWidth={2.2} /> },
            { n: totals.high,     label: "high",         bg: "var(--color-signal-soft)",  fg: "var(--color-signal)", icon: <MapPinIcon className="w-4 h-4" strokeWidth={2} /> },
            { n: totals.medium,   label: "medium",       bg: "var(--color-araw-soft)",    fg: "var(--color-ember)",  icon: <MapPinIcon className="w-4 h-4" strokeWidth={2} /> },
            { n: totals.covered,  label: "covered",      bg: "var(--color-damay-soft)",   fg: "var(--color-damay)",  icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} /> },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl px-5 py-4 inline-flex items-center gap-4"
              style={{ background: "var(--color-paper-warm)", border: "1px solid var(--color-paper-edge)" }}
            >
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 36, height: 36, background: s.bg, color: s.fg, flexShrink: 0 }}
              >
                {s.icon}
              </span>
              <div>
                <div
                  className="font-display font-bold"
                  style={{ fontSize: 30, color: "var(--color-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}
                >
                  {s.n}
                </div>
                <div className="ak-caps mt-1" style={{ color: "var(--color-ash)" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 w-full relative z-0">
           <MapContainer center={position} zoom={12} scrollWheelZoom={true} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {opsCenters.map((center, idx) => (
              <Marker key={idx} position={center.position}>
                <Popup>
                  <div className="font-bold text-sm">{center.name}</div>
                  <div className="text-xs text-green-600 uppercase font-medium mt-1">Status: {center.status}</div>
                </Popup>
              </Marker>
            ))}

            {opsCenters.map((center, idx) => (
              <Circle 
                key={`circle-${idx}`} 
                center={center.position} 
                radius={center.radius}
                pathOptions={{
                  fillColor: '#00A3FF',
                  fillOpacity: 0.1,
                  color: '#00A3FF',
                  weight: 1
                }} 
              />
            ))}

            {needs.map((need, idx) => (
              <CircleMarker
                key={`need-${idx}`}
                center={need.location as [number, number]}
                pathOptions={{ color: need.color, fillColor: need.color, fillOpacity: 0.8, weight: 2 }}
                radius={8}
              >
                <Popup>
                  <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: need.color }}>
                     {need.id} - {need.type}
                  </div>
                  <div className="text-xs text-on-surface mt-1">{need.desc}</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          <div
            className="absolute top-4 right-4 z-[400] p-4 rounded-xl min-w-[160px]"
            style={{
              background: "rgba(244,236,216,0.95)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--color-paper-edge)",
              boxShadow: "var(--shadow-2)",
            }}
          >
             <h3 className="ak-caps mb-3" style={{ color: "var(--color-ash)" }}>need category</h3>
             <div className="space-y-2 text-xs" style={{ color: "var(--color-ink)" }}>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "#00A3FF" }}></div> drinking water</div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FDAB3D" }}></div> food packs</div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "#a25ddc" }}></div> shelter</div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E2445C" }}></div> medical</div>
             </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
