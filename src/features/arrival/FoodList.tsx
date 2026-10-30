import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, MapPin, Navigation, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "./map-links";
import { isOpenNow } from "./opening-hours";
import { FOOD_SELECTORS, fetchOverpassPlaces, getCityCenter } from "./services";
import type { Airport, Place } from "./types";

type Area = "airport" | "center";
type Filter = "all" | "restaurant" | "fast_food" | "cafe" | "open";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "restaurant", label: "Restaurants" },
  { id: "fast_food", label: "Fast food" },
  { id: "cafe", label: "Cafés" },
  { id: "open", label: "Open now" },
];

const KIND_LABEL: Record<string, string> = { restaurant: "Restaurant", fast_food: "Fast food", cafe: "Café" };

interface FoodListProps {
  airport: Airport;
  onBack: () => void;
  onShowRoute: (place: Place) => void;
}

export function FoodList({ airport, onBack, onShowRoute }: FoodListProps) {
  const [area, setArea] = useState<Area>("airport");
  const [filter, setFilter] = useState<Filter>("all");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPlaces(null);
    setError(false);
    (async () => {
      let lat = airport.lat;
      let lon = airport.lon;
      let radius = 3000;
      if (area === "center") {
        const c = await getCityCenter(airport.city, airport.countryCode);
        if (!c) throw new Error("No city center");
        lat = c.lat;
        lon = c.lon;
        radius = 2000;
      }
      return fetchOverpassPlaces(lat, lon, radius, FOOD_SELECTORS);
    })()
      .then((rows) => !cancelled && setPlaces(rows))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [airport, area, attempt]);

  const shown = useMemo(() => {
    if (!places) return [];
    const now = new Date();
    return places
      .map((p) => ({ ...p, openNow: isOpenNow(p.openingHours, now) }))
      .filter((p) => {
        if (filter === "all") return true;
        if (filter === "open") return p.openNow === true;
        return p.kind === filter;
      })
      .slice(0, 30);
  }, [places, filter]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-xl font-semibold">Hungry?</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm" role="tablist">
        {(["airport", "center"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={area === a}
            onClick={() => setArea(a)}
            className={`truncate rounded-md px-3 py-2 font-medium transition-colors ${
              area === a ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {a === "airport" ? "Near the airport" : `In ${airport.city} center`}
          </button>
        ))}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              filter === f.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {error ? (
          <div className="rounded-xl border p-4 text-sm">
            Couldn't load this right now —{" "}
            <button type="button" onClick={retry} className="font-medium text-primary underline">
              retry
            </button>
          </div>
        ) : !places ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border p-8 text-center text-sm text-muted-foreground">
            <UtensilsCrossed className="h-6 w-6" />
            {filter === "all"
              ? "No food spots found around here. Try the other area."
              : "Nothing matches this filter. Try another one."}
          </div>
        ) : (
          shown.map((p) => <FoodCard key={p.id} place={p} onShowRoute={onShowRoute} />)
        )}
      </div>
    </section>
  );
}

function FoodCard({ place, onShowRoute }: { place: Place; onShowRoute: (p: Place) => void }) {
  return (
    <article className="rounded-xl border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{place.name}</h3>
          <p className="text-sm text-muted-foreground">
            {KIND_LABEL[place.kind] ?? "Food"}
            {place.cuisine ? ` · ${place.cuisine}` : ""}
          </p>
        </div>
        {place.openNow && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Open now
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {place.distance !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {formatDistance(place.distance)}
          </span>
        )}
        {place.openingHours && (
          <span className="flex min-w-0 items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{place.openingHours}</span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onShowRoute(place)}
        className="mt-3 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        <Navigation className="h-3.5 w-3.5" />
        Show route
      </button>
    </article>
  );
}
