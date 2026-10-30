/**
 * Browser-safe helpers for the map view: external map deep links and
 * distance/duration formatting. Deliberately free of any Leaflet import so
 * route modules can use it without pulling browser-only code into SSR.
 */

export interface MapPoint {
  lat: number;
  lon: number;
}

/** Google Maps directions deep link (works in the app and in a browser tab). */
export function googleMapsUrl(destination: MapPoint, origin?: MapPoint): string {
  const parts = [`destination=${destination.lat},${destination.lon}`];
  if (origin) parts.push(`origin=${origin.lat},${origin.lon}`);
  return `https://www.google.com/maps/dir/?api=1&${parts.join("&")}&travelmode=driving`;
}

/** Apple Maps directions deep link. */
export function appleMapsUrl(destination: MapPoint, origin?: MapPoint): string {
  const parts = [`daddr=${destination.lat},${destination.lon}`];
  if (origin) parts.push(`saddr=${origin.lat},${origin.lon}`);
  return `https://maps.apple.com/?${parts.join("&")}&dirflg=d`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
