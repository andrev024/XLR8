export interface GeoPoint {
  lat: number;
  lng: number;
}

export const MAX_PLAUSIBLE_SPEED_KMH = 350;

const EARTH_RADIUS_METERS = 6_371_000;

/** Distancia en metros entre dos puntos geográficos (fórmula de Haversine). */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
