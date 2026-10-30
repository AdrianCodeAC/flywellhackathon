import { ArrowLeft, Clock, MapPin, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { fetchOsrmRoute } from "./services";
import { appleMapsUrl, formatDistance, formatDuration, googleMapsUrl } from "./map-links";
import type { Route, RouteProfile } from "./types";

export interface MapEndpoint {
  lat: number;
  lon: number;
  name: string;
}

interface RouteMapProps {
  from: MapEndpoint;
  to: MapEndpoint;
  onBack: () => void;
}

function pin(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid var(--background);box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Shared full-screen map + route view. Loaded lazily — imports Leaflet. */
export function RouteMap({ from, to, onBack }: RouteMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const artRef = useRef<L.LayerGroup | null>(null);

  const [route, setRoute] = useState<Route | null>(null);
  const [profile, setProfile] = useState<RouteProfile>("driving");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create the map once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    const map = L.map(host, { zoomControl: true }).setView([from.lat, from.lon], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    artRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      artRef.current = null;
    };
  }, [from.lat, from.lon]);

  // Fetch the route whenever the profile changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOsrmRoute([from.lat, from.lon], [to.lat, to.lon], profile)
      .then((r) => {
        if (!cancelled) setRoute(r);
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(null);
          setError("Couldn't load this right now — retry");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from.lat, from.lon, to.lat, to.lon, profile]);

  // Draw markers + polyline.
  useEffect(() => {
    const map = mapRef.current;
    const art = artRef.current;
    if (!map || !art) return;
    art.clearLayers();
    L.marker([from.lat, from.lon], { icon: pin("var(--primary)") })
      .addTo(art)
      .bindTooltip(from.name, { direction: "top" });
    L.marker([to.lat, to.lon], { icon: pin("var(--destructive)") })
      .addTo(art)
      .bindTooltip(to.name, { direction: "top" });
    if (route) {
      L.polyline(route.coordinates, { color: "var(--primary)", weight: 4, opacity: 0.85 }).addTo(art);
      map.fitBounds(L.latLngBounds(route.coordinates).pad(0.2));
    } else {
      map.fitBounds(L.latLngBounds([[from.lat, from.lon], [to.lat, to.lon]]).pad(0.2));
    }
  }, [route, from.lat, from.lon, to.lat, to.lon, from.name, to.name]);

  const showProfileToggle = !!route && route.distanceM < 3000;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {from.name} → {to.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {loading ? "Finding the route…" : route ? `${formatDistance(route.distanceM)} · ${formatDuration(route.durationSec)}` : "No route found"}
          </p>
        </div>
      </div>

      <div ref={hostRef} className="min-h-0 flex-1" />

      {error && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => setProfile((p) => p)}
              className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="border-t px-4 py-3">
        {showProfileToggle && (
          <div className="mb-3 inline-flex rounded-md border p-0.5">
            {(["driving", "walking"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProfile(p)}
                className={
                  "rounded px-3 py-1 text-sm capitalize " +
                  (profile === p ? "bg-primary text-primary-foreground" : "text-muted-foreground")
                }
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {route ? formatDistance(route.distanceM) : "—"}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {route ? formatDuration(route.durationSec) : "—"}
          </span>
          <div className="ml-auto flex gap-2">
            <a
              href={googleMapsUrl(to, from)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Navigation className="h-4 w-4" /> Google Maps
            </a>
            <a
              href={appleMapsUrl(to, from)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Navigation className="h-4 w-4" /> Apple Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
