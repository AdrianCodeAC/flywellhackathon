import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock, MapPin, Navigation, Phone, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "./map-links";
import { formatOpeningHours, isOpenNow } from "./opening-hours";
import {
  FOOD_RADIUS,
  fetchOverpassPlaces,
  foodOrigin,
  peekPlaces,
  type PlacesResult,
} from "./services";
import type { Airport, Place } from "./types";
import { DEFAULT_FOOD_AREA } from "./place-sources";
import { distanceMeters } from "./place-utils";
import type { StartPointState } from "./start-point";
import { StartNotice } from "./StartNotice";

type Area = "airport" | "center";
type Filter = "all" | "restaurant" | "fast_food" | "cafe";
const FILTERS: Filter[] = ["all", "restaurant", "fast_food", "cafe"];

interface FoodListProps {
  airport: Airport;
  start: StartPointState;
  onBack: () => void;
  onShowRoute: (place: Place) => void;
}

const chip = (on: boolean) =>
  `flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${
    on ? "border-primary bg-primary text-primary-foreground" : "active:bg-accent"
  }`;

export function FoodList({ airport, start, onBack, onShowRoute }: FoodListProps) {
  const { t, i18n } = useTranslation();
  const [area, setArea] = useState<Area>(DEFAULT_FOOD_AREA);
  const [filter, setFilter] = useState<Filter>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [result, setResult] = useState<PlacesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(false);
    setSlow(false);
    setLoading(true);
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), 3000);
    (async () => {
      const [lat, lon] = await foodOrigin(airport, area);
      const radius = FOOD_RADIUS[area];
      // Show any saved copy right away, even an old one, while fresh data loads.
      const saved = peekPlaces("food", lat, lon, radius);
      if (saved && !cancelled) setResult({ ...saved, stale: !saved.fresh });
      if (saved?.fresh) return;
      const fresh = await fetchOverpassPlaces("food", lat, lon, radius);
      if (!cancelled) {
        setResult(fresh);
        if (fresh.stale) setError(true);
      }
    })()
      .catch(() => !cancelled && setError(true))
      .finally(() => {
        clearTimeout(slowTimer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [airport, area, attempt]);

  const places = result?.places ?? null;
  const from = start.start;
  const shown = useMemo(() => {
    if (!places) return [];
    const now = new Date();
    const list = places
      .map((p): Place => {
        const openNow = isOpenNow(p.openingHours, now);
        // Measured from the same point "Show route" starts at, never from the search centre.
        const distance = from ? Math.round(distanceMeters([from.lat, from.lon], [p.lat, p.lon])) : p.distance;
        return openNow === undefined ? { ...p, distance } : { ...p, distance, openNow };
      })
      .filter((p) => (filter === "all" || p.kind === filter) && (!openOnly || p.openNow === true));
    // Live position: nearest to you first.
    if (from?.source === "you") list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    return list.slice(0, 30);
  }, [places, filter, openOnly, from?.lat, from?.lon, from?.source]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <section className="mt-6 pb-24">
      <h2 className="text-xl font-semibold">{t("food.title")}</h2>

      <div className="mt-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm" role="tablist">
        {(["airport", "center"] as const).map((a) => (
          <Button variant="outline"
            key={a}
            type="button"
            role="tab"
            aria-selected={area === a}
            onClick={() => setArea(a)}
             className={`h-auto min-h-11 whitespace-normal rounded-md border-0 px-2 py-2 font-medium leading-tight shadow-none transition-colors ${
               area === a ? "bg-background text-primary shadow-sm" : "bg-transparent text-muted-foreground"
            }`}
          >
            {a === "airport" ? t("food.nearAirport") : t("food.inCenter", { city: airport.city })}
          </Button>
        ))}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Button variant="outline"
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={chip(filter === f)}
          >
            {t(`food.${f}`)}
          </Button>
        ))}
        <Button variant="outline"
          type="button"
          aria-pressed={openOnly}
          onClick={() => setOpenOnly((v) => !v)}
          className={chip(openOnly)}
        >
          {t("food.openNow")}
        </Button>
      </div>

      <StartNotice state={start} />

      <div className="mt-4 flex flex-col gap-2.5">
        {error && (
          <div role="alert" className="rounded-lg border p-4 text-sm">
            {t("food.error")}{" "}
            <Button variant="outline"
              type="button"
              onClick={retry}
              className="min-h-11 font-medium text-primary underline"
            >
              {t("food.retry")}
            </Button>
          </div>
        )}
        {result?.stale && (
          <p className="text-xs text-muted-foreground">
            {t("food.savedEarlier", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(result.fetchedAt),
            })}
          </p>
        )}
        {!places ? (
          error ? null : (
            <>
              {slow && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("food.stillSearching")}
                </p>
              )}
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </>
          )
        ) : shown.length === 0 ? (
          loading ? null : (
            <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center text-sm text-muted-foreground">
              <UtensilsCrossed className="h-6 w-6" />
              {filter === "all" && !openOnly ? t("food.emptyAll") : t("food.emptyFilter")}
            </div>
          )
        ) : (
          shown.map((p) => <FoodCard key={p.id} place={p} onShowRoute={onShowRoute} />)
        )}
      </div>

      {/* Sticky one-handed action at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          <Button variant="outline"
            type="button"
            onClick={onBack}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border bg-card text-base font-medium active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            {t("food.back")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FoodCard({ place, onShowRoute }: { place: Place; onShowRoute: (p: Place) => void }) {
  const { t, i18n } = useTranslation();
  const action =
    "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium active:bg-accent";
  return (
    <article className="rounded-lg border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{place.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t(`category.${place.kind}`)}
            {place.cuisine ? ` · ${place.cuisine}` : ""}
          </p>
        </div>
        {place.openNow && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {t("food.openNow")}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {place.distance !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {formatDistance(place.distance, i18n.language)}
          </span>
        )}
        {place.openingHours && (
          <span className="flex min-w-0 items-center gap-1" aria-label={t("food.hours")}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="break-words">
              {formatOpeningHours(place.openingHours, i18n.language, {
                alwaysOpen: t("food.alwaysOpen"),
                closed: t("food.closed"),
              })}
            </span>
          </span>
        )}
      </div>
      <div className={`mt-3 grid gap-2 ${place.phone ? "grid-cols-2" : "grid-cols-1"}`}>
        <Button variant="outline" type="button" onClick={() => onShowRoute(place)} className={action}>
          <Navigation className="h-4 w-4" />
          {t("food.showRoute")}
        </Button>
        {place.phone && (
          <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className={action}>
            <Phone className="h-4 w-4" />
            {t("food.call")}
          </a>
        )}
      </div>
    </article>
  );
}
