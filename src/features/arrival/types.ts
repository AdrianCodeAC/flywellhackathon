export interface Airport {
  iata: string;
  name: string;
  city: string;
  /** Full country name (e.g. "Portugal"). */
  country: string;
  /** ISO 3166-1 alpha-2 code (e.g. "PT"). */
  countryCode: string;
  lat: number;
  lon: number;
}

export type PlaceKind =
  | "restaurant"
  | "fast_food"
  | "cafe"
  | "museum"
  | "attraction"
  | "monument"
  | "castle"
  | "viewpoint"
  | "gallery"
  | "station"
  | "bus_stop"
  | "ai"
  | "other";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
  /** Distance in meters from the reference point (airport or city center). */
  distance?: number;
  cuisine?: string;
  openingHours?: string;
  openNow?: boolean;
  description?: string;
  wikipedia?: string;
  wikidata?: string;
  tags?: Record<string, string>;
}

export type TransportKind = "uber" | "bolt" | "taxi" | "public";

export interface TransportOption {
  kind: TransportKind;
  name: string;
  /** Estimated duration in seconds. */
  durationSec?: number;
  /** Estimated distance in meters. */
  distanceM?: number;
  /** Human-readable cost estimate, e.g. "€25–35". */
  costEstimate?: string;
  deepLink?: string;
}

export type RouteProfile = "driving" | "walking";

export interface Route {
  profile: RouteProfile;
  distanceM: number;
  durationSec: number;
  /** Polyline as [lat, lon] pairs. */
  coordinates: [number, number][];
}
