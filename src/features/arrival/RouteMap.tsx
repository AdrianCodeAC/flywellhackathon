import { ArrowLeft, Clock, MapPin, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import { LanguageSwitcher } from "./AppHeader";
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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [attempt, setAttempt] = useState(0);
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
          setError("map.error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from.lat, from.lon, to.lat, to.lon, profile, attempt]);

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

  const btn = "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium active:bg-accent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-base font-semibold active:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("map.back")}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {from.name} → {to.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {loading
              ? t("map.finding")
              : route
                ? `${formatDistance(route.distanceM, lang)} · ${formatDuration(route.durationSec, lang)}`
                : t("map.noRoute")}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      <div ref={hostRef} className="min-h-0 flex-1" />

      <div className="border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{t(error)}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={btn}>
              {t("map.retry")}
            </button>
          </div>
        )}

        <div className="mb-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1" aria-label={t("map.distance")}>
            <MapPin className="h-4 w-4" />
            {route ? formatDistance(route.distanceM, lang) : "—"}
          </span>
          <span className="flex items-center gap-1" aria-label={t("map.duration")}>
            <Clock className="h-4 w-4" />
            {route ? formatDuration(route.durationSec, lang) : "—"}
          </span>
          {showProfileToggle && (
            <div className="ml-auto inline-flex rounded-lg border p-0.5">
              {(["driving", "walking"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={profile === p}
                  onClick={() => setProfile(p)}
                  className={
                    "min-h-11 rounded-md px-3 text-sm " +
                    (profile === p ? "bg-primary text-primary-foreground" : "text-muted-foreground")
                  }
                >
                  {t(`map.${p}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={googleMapsUrl(to, from)} target="_blank" rel="noreferrer" className={btn}>
            <Navigation className="h-4 w-4" /> {t("map.google")}
          </a>
          <a href={appleMapsUrl(to, from)} target="_blank" rel="noreferrer" className={btn}>
            <Navigation className="h-4 w-4" /> {t("map.apple")}
          </a>
        </div>
      </div>
    </div>
  );
}
