import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BOGOTA_CENTER } from '../constants';
import { RiskZone, RouteData, TimeMode, VehicleType, IncidentReport } from '../types';
import { calculateZoneRisk } from '../services/riskEngine';

// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const originIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background:#00ff9d;border:3px solid white;width:16px;height:16px;border-radius:50%;box-shadow:0 0 12px #00ff9d;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const destIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background:#ff1744;border:3px solid white;width:20px;height:20px;border-radius:50%;box-shadow:0 0 14px #ff174480;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;">★</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const userIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background:#00c2ff;border:3px solid white;width:14px;height:14px;border-radius:50%;box-shadow:0 0 10px #00c2ff;animation:pulse 1.5s infinite;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface MapProps {
  zones: RiskZone[];
  reports: IncidentReport[];
  vehicleType: VehicleType;
  timeMode: TimeMode;
  activeRoute?: RouteData & { riskScore?: number };
  userLocation: [number, number];
  originCoords?: [number, number] | null;
  destCoords?: [number, number] | null;
}

function MapFitter({ coords, userLocation }: { coords?: [number,number][] | null; userLocation: [number,number] }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 1) {
      const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else {
      map.flyTo(userLocation, 15);
    }
  }, [coords, userLocation]);
  return null;
}

export const SafetyMap: React.FC<MapProps> = ({
  zones, reports, vehicleType, timeMode, activeRoute, userLocation, originCoords, destCoords
}) => {
  const routeCoords = activeRoute?.coords ?? null;

  return (
    <MapContainer center={BOGOTA_CENTER} zoom={14} className="w-full h-full" zoomControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <MapFitter coords={routeCoords} userLocation={userLocation} />

      {zones.map(zone => {
        const currentRisk = calculateZoneRisk(zone, vehicleType, timeMode);
        const color = currentRisk >= 70 ? '#ff1744' : currentRisk >= 45 ? '#ffc107' : '#00e676';
        return (
          <Circle key={zone.id} center={zone.coords} radius={zone.radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}>
            <Popup className="custom-popup">
              <div className="text-slate-900 font-sans p-1">
                <strong className="block text-sm border-b border-slate-100 pb-1 mb-1">{zone.name}</strong>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Riesgo IA</span>
                  <span className={'px-2 py-0.5 rounded text-[10px] font-bold text-white ' + (currentRisk >= 70 ? 'bg-red-500' : currentRisk >= 45 ? 'bg-amber-500' : 'bg-emerald-500')}>
                    {currentRisk}%
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-slate-600 italic">"{zone.description}"</p>
                <div className="mt-2 text-[10px] text-slate-400 flex gap-2">
                  <span>👍 {zone.reportsSafe}</span>
                  <span>👎 {zone.reportsUnsafe}</span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {reports.map(report => (
        <Marker key={report.id} position={report.coords}
          icon={L.divIcon({
            className: 'bg-transparent',
            html: `<div class="p-1 rounded-full shadow-lg border-2 ${report.type === 'Seguro' ? 'bg-emerald-500 border-white' : 'bg-red-500 border-white'} text-white flex items-center justify-center animate-bounce">${report.type === 'Seguro' ? '✓' : '!'}</div>`,
            iconSize: [24, 24], iconAnchor: [12, 12]
          })}>
          <Popup>
            <div className="text-slate-900 font-sans p-1">
              <strong className="block text-sm text-red-500 mb-1 uppercase tracking-tight">Reporte: {report.type}</strong>
              <p className="text-[11px] text-slate-600 mb-1">{report.description || 'Sin descripción adicional.'}</p>
              <span className="text-[9px] text-slate-400 block border-t pt-1">Hace pocos segundos</span>
            </div>
          </Popup>
        </Marker>
      ))}

      {activeRoute && (
        <Polyline
          positions={activeRoute.coords}
          pathOptions={{
            color: activeRoute.name?.includes('segura') ? '#00ff9d' : '#ff6b35',
            weight: 7, opacity: 0.85, lineJoin: 'round',
          }}
        />
      )}

      {/* Origin marker */}
      {originCoords && (
        <Marker position={originCoords} icon={originIcon}>
          <Popup><strong className="text-[11px]">📍 Origen</strong></Popup>
        </Marker>
      )}

      {/* Destination marker */}
      {destCoords && (
        <Marker position={destCoords} icon={destIcon}>
          <Popup><strong className="text-[11px]">🏁 Destino</strong></Popup>
        </Marker>
      )}

      {/* User location */}
      <Marker position={userLocation} icon={userIcon}>
        <Popup>📍 Tu ubicación actual</Popup>
      </Marker>
    </MapContainer>
  );
};
