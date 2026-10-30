/**
 * Browser-safe deep links for the "Need a ride?" cards. Pure string building so
 * it can be tested without a browser and imported anywhere.
 */
import type { MapPoint } from "./map-links";

/**
 * Uber universal link: opens the app when installed, otherwise a browser tab,
 * with both addresses already filled in.
 */
export function uberDeepLink(pickup: MapPoint, dropoff: MapPoint): string {
  const params = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(pickup.lat),
    "pickup[longitude]": String(pickup.lon),
    "dropoff[latitude]": String(dropoff.lat),
    "dropoff[longitude]": String(dropoff.lon),
  });
  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Bolt has no public link that carries an address, so this only opens Bolt —
 * the traveller types the destination there.
 */
export const BOLT_URL = "https://m.bolt.eu/";
