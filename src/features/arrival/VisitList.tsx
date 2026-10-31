import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Landmark, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "./map-links";
import { distanceMeters } from "./place-utils";
import {
  SIGHTS_RADIUS,
  fetchOverpassPlaces,
  peekPlaces,
  sightsOrigin,
  type PlacesResult,
} from "./services";
import type { Airport, Place } from "./types";
import type { StartPointState } from "./start-point";
import { StartNotice } from "./StartNotice";

type Filter = "all" | "museums" | "churches" | "parks" | "monuments" | "other";
const FILTERS: Filter[] = ["all", "museums", "churches", "parks", "monuments", "other"];

const GROUPS: Record<Exclude<Filter, "all">, Place["kind"][]> = {
  museums: ["museum", "gallery"],
  churches: ["church"],
  parks: ["park"],
  monuments: ["monument", "castle"],
  other: ["other", "attraction", "viewpoint"],
};

interface VisitListProps {
  airport: Airport;
  start: StartPointState;
  onBack: () => void;
  onShowRoute: (place: Place) => void;
}

const chip = (on: boolean) =>
  `flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${
    on ? "border-primary bg-primary text-primary-foreground" : "active:bg-accent"
  }`;

/** What to visit? — sights around the city centre, Wikipedia first. */
export function VisitList({ airport, start, onBack, onShowRoute }: VisitListProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
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
      const [lat, lon] = await sightsOrigin(airport);
      const saved = peekPlaces("sights", lat, lon, SIGHTS_RADIUS, i18n.language);
      if (saved && !cancelled) setResult({ ...saved, stale: !saved.fresh });
      if (saved?.fresh) return;
      const fresh = await fetchOverpassPlaces("sights", lat, lon, SIGHTS_RADIUS, i18n.language);
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
  }, [airport, attempt, i18n.language]);

  const from = start.start ?? { lat: airport.lat, lon: airport.lon };
  const shown = useMemo(() => {
    const group = filter === "all" ? null : GROUPS[filter];
    return (result?.places ?? [])
      .map((p): Place => ({
        ...p,
        // Measured from the same point "Show route" starts at (you, or the airport).
        distance: Math.round(distanceMeters([from.lat, from.lon], [p.lat, p.lon])),
      }))
      .filter((p) => !group || group.includes(p.kind))
      .slice(0, 30);
  }, [result, filter, from.lat, from.lon]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <section className="mt-6 pb-24">
      <h2 className="text-xl font-semibold">{t("visit.title")}</h2>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Button
            variant="outline"
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={chip(filter === f)}
          >
            {t(`visit.${f}`)}
          </Button>
        ))}
      </div>

      <StartNotice state={start} />

      <div className="mt-4 flex flex-col gap-2.5">
        {error && (
          <div role="alert" className="rounded-lg border p-4 text-sm">
            {t("common.error")}{" "}
            <Button
              variant="outline"
              type="button"
              onClick={retry}
              className="min-h-11 font-medium text-primary underline"
            >
              {t("common.retry")}
            </Button>
          </div>
        )}
        {result?.stale && (
          <p className="text-xs text-muted-foreground">
            {t("common.savedEarlier", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(result.fetchedAt),
            })}
          </p>
        )}
        {!result ? (
          error ? null : (
            <>
              {slow && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("common.stillSearching")}
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
              <Landmark className="h-6 w-6" />
              {t("visit.empty")}
            </div>
          )
        ) : (
          shown.map((p) => <VisitCard key={p.id} place={p} onShowRoute={onShowRoute} />)
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          <Button
            variant="outline"
            type="button"
            onClick={onBack}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border bg-card text-base font-medium active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            {t("common.back")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function VisitCard({ place, onShowRoute }: { place: Place; onShowRoute: (p: Place) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <article className="rounded-lg border bg-card p-3.5">
      <div className="flex gap-3">
        {place.thumbnail ? (
          <img
            src={place.thumbnail}
            alt=""
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-md bg-muted object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Landmark />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{place.name}</h3>
          <p className="text-sm text-muted-foreground">{t(`category.${place.kind}`)}</p>
          {place.description && (
            <p className="mt-2 text-sm text-muted-foreground">{place.description}</p>
          )}
        </div>
      </div>
      {place.articleUrl && (
        <a
          href={place.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center text-xs text-primary underline"
        >
          {t("visit.source")}
        </a>
      )}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {place.distance !== undefined && formatDistance(place.distance, i18n.language)}
      </div>
      <Button
        variant="outline"
        type="button"
        onClick={() => onShowRoute(place)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium active:bg-accent"
      >
        <Navigation className="h-4 w-4" />
        {t("common.showRoute")}
      </Button>
    </article>
  );
}
