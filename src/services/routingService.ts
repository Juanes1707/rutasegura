import { RiskZone, VehicleType, TimeMode, RouteData } from '../types';
import { calculateZoneRisk } from './riskEngine';

// Geocoding via Nominatim (free, no API key)
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const query = address.toLowerCase().includes('bogot') ? address : `${address}, Bogotá, Colombia`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=co`;
  
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (e) {
    console.error('Geocoding error:', e);
  }
  return null;
}

// Reverse geocode a coordinate to address name
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

interface OSRMRoute {
  geometry: { coordinates: [number, number][] };
  duration: number;
  distance: number;
  legs: { steps: { maneuver: { instruction?: string }; name: string }[] }[];
}

// Fetch routes from OSRM (free routing engine)
async function fetchOSRMRoutes(
  origin: [number, number],
  dest: [number, number],
  profile: string = 'driving'
): Promise<OSRMRoute[]> {
  const coords = `${origin[1]},${origin[0]};${dest[1]},${dest[0]}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?alternatives=true&steps=true&geometries=geojson&overview=full`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.code !== 'Ok' || !data.routes) {
    throw new Error('No se pudieron calcular rutas');
  }
  return data.routes;
}

// Calculate how risky a route is based on risk zones it crosses
function scoreRoute(
  coords: [number, number][],
  zones: RiskZone[],
  vehicleType: VehicleType,
  timeMode: TimeMode
): number {
  if (coords.length === 0) return 50;
  
  let totalRisk = 0;
  let riskPoints = 0;
  
  coords.forEach(([lat, lng]) => {
    zones.forEach(zone => {
      const [zLat, zLng] = zone.coords;
      const dist = Math.sqrt(Math.pow(lat - zLat, 2) + Math.pow(lng - zLng, 2)) * 111000; // approx meters
      
      if (dist < zone.radius) {
        const zoneRisk = calculateZoneRisk(zone, vehicleType, timeMode);
        const weight = 1 - (dist / zone.radius); // closer = more weight
        totalRisk += zoneRisk * weight;
        riskPoints += weight;
      }
    });
  });
  
  if (riskPoints === 0) return 30; // baseline risk if no zones crossed
  return Math.min(100, Math.round(totalRisk / riskPoints));
}

// Build a RouteData from OSRM result
function buildRouteData(
  osrm: OSRMRoute,
  zones: RiskZone[],
  vehicleType: VehicleType,
  timeMode: TimeMode,
  label: string
): RouteData & { riskScore: number; originCoords: [number,number]; destCoords: [number,number] } {
  const coords: [number, number][] = osrm.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const riskScore = scoreRoute(coords, zones, vehicleType, timeMode);
  
  // Extract turn-by-turn instructions
  const instructions: string[] = [];
  if (osrm.legs?.[0]?.steps) {
    osrm.legs[0].steps.slice(0, 5).forEach(step => {
      const streetName = step.name || 'vía sin nombre';
      instructions.push(`Continúa por ${streetName}`);
    });
  }
  if (instructions.length === 0) {
    instructions.push('Sigue la ruta indicada en el mapa');
  }

  return {
    name: label,
    time: Math.round(osrm.duration / 60),
    distance: parseFloat((osrm.distance / 1000).toFixed(1)),
    coords,
    instructions,
    riskScore,
    originCoords: coords[0],
    destCoords: coords[coords.length - 1],
  };
}

export interface ComputedRoutes {
  safe: RouteData & { riskScore: number };
  fast: RouteData & { riskScore: number };
  originCoords: [number, number];
  destCoords: [number, number];
  originLabel: string;
  destLabel: string;
}

// Main function: geocode addresses, fetch real routes, score them
export async function computeRealRoutes(
  originInput: string,
  destInput: string,
  zones: RiskZone[],
  vehicleType: VehicleType,
  timeMode: TimeMode,
  userPos?: [number, number]
): Promise<ComputedRoutes> {
  // Resolve origin
  let originCoords: [number, number];
  let originLabel = originInput;
  
  if (originInput.toLowerCase().includes('ubicación') || originInput.toLowerCase().includes('mi ubicaci') || originInput === '') {
    if (!userPos) throw new Error('No se pudo obtener tu ubicación');
    originCoords = userPos;
    originLabel = await reverseGeocode(userPos[0], userPos[1]);
  } else {
    const geo = await geocodeAddress(originInput);
    if (!geo) throw new Error(`No se encontró: "${originInput}"`);
    originCoords = geo;
  }
  
  // Resolve destination
  const destGeo = await geocodeAddress(destInput);
  if (!destGeo) throw new Error(`No se encontró: "${destInput}"`);
  const destCoords = destGeo;
  const destLabel = destInput;
  
  // Map vehicle type to OSRM profile
  const profile = vehicleType === 'carro' || vehicleType === 'moto' ? 'driving' 
    : vehicleType === 'bicicleta' ? 'cycling' 
    : 'foot';
  
  // Fetch routes
  const osrmRoutes = await fetchOSRMRoutes(originCoords, destCoords, profile);
  
  // Build scored routes
  const allRoutes = osrmRoutes.map((r, i) => 
    buildRouteData(r, zones, vehicleType, timeMode, i === 0 ? 'Ruta A' : `Ruta ${String.fromCharCode(65 + i)}`)
  );
  
  // Sort by risk: safest first
  allRoutes.sort((a, b) => a.riskScore - b.riskScore);
  
  const safeRoute = { ...allRoutes[0], name: 'Ruta segura' };
  // Fast route: sort by time among remaining
  const byTime = [...allRoutes].sort((a, b) => a.time - b.time);
  const fastRoute = { ...byTime[0], name: 'Ruta rápida' };
  
  return {
    safe: safeRoute,
    fast: fastRoute,
    originCoords,
    destCoords,
    originLabel,
    destLabel,
  };
}

// Generate Google Maps URL for the route
export function buildGoogleMapsURL(origin: string, destination: string, travelMode: VehicleType): string {
  const modeMap: Record<VehicleType, string> = {
    carro: 'driving',
    moto: 'driving',
    bicicleta: 'bicycling',
    peaton: 'walking',
  };
  const mode = modeMap[travelMode] || 'driving';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}
