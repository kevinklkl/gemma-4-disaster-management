import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { Search, Bell, HelpCircle, Droplet, Utensils, Tent, Cross, MapPin } from "lucide-react";
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

  return (
    <div className="h-screen bg-surface-container-low font-body text-on-surface flex flex-col overflow-hidden">
      <TopNav />
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

          <div className="absolute top-6 right-6 z-[400] bg-surface/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-outline-variant/20 min-w-[160px]">
             <h3 className="font-headline font-bold text-sm text-on-surface mb-3 uppercase tracking-wider">Need Category</h3>
             <div className="space-y-2.5 text-xs font-medium text-on-surface">
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00A3FF]"></div> Drinking Water</div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#FDAB3D]"></div> Food Packs</div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#a25ddc]"></div> Shelter</div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#E2445C]"></div> Medical</div>
             </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
