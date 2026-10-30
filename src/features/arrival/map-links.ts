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

function unit(locale: string, u: string, value: number, digits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: u,
    unitDisplay: "short",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

/** Locale-aware distance: "820 m" / "8.1 km" (en), "8,1 km" (ro). */
export function formatDistance(meters: number, locale = "en"): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return unit(locale, "meter", Math.round(meters / 10) * 10);
  return unit(locale, "kilometer", meters / 1000, 1);
}

/** Locale-aware duration: "20 min", "1 hr 15 min" (en), "1 h 15 min" (ro). */
export function formatDuration(seconds: number, locale = "en"): string {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `<${unit(locale, "minute", 1)}`;
  if (minutes < 60) return unit(locale, "minute", minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${unit(locale, "hour", hours)} ${unit(locale, "minute", rest)}` : unit(locale, "hour", hours);
}
