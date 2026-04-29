/**
 * Utilidades de geolocalización para RutaSegura AI
 */

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateSpeedFromPositions(
  pos1: { lat: number; lng: number; time: number },
  pos2: { lat: number; lng: number; time: number }
): number {
  const distance = getDistanceInMeters(pos1.lat, pos1.lng, pos2.lat, pos2.lng);
  const timeSeconds = (pos2.time - pos1.time) / 1000;

  // Threshold: Si la distancia es menor a 3 metros, consideramos que el usuario está quieto
  // Esto evita el "jitter" del GPS que genera velocidades falsas estando estático.
  if (distance < 3 || timeSeconds <= 0) return 0;
  
  const speedKmh = (distance / timeSeconds) * 3.6;
  return speedKmh;
}
