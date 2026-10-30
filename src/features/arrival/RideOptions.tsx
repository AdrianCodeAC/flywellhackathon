import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Car, Navigation, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOsrmRoute,
  geocodeNominatim,
  getCityCenter,
  nearbyStations,
  transportGuide,
  peekPlaces,
  STATION_RADIUS,
  type PlacesResult,
} from "./services";
import { formatDistance, formatDuration } from "./map-links";
import { uberDeepLink, BOLT_URL } from "./ride-links";
import { estimateTaxiFare, formatFare } from "./taxi";
import type { TransportGuide } from "./guides.functions";
import type { Airport, Place, Route } from "./types";

export function RideOptions({
  airport,
  onBack,
  onShowRoute,
}: {
  airport: Airport;
  onBack: () => void;
  onShowRoute: (p: Place) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<Place>();
  const [hits, setHits] = useState<Place[]>([]);
  const [route, setRoute] = useState<Route>();
  const [stations, setStations] = useState<PlacesResult>();
  const [guide, setGuide] = useState<TransportGuide>();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [attempts, setAttempts] = useState({ destination: 0, route: 0, guide: 0, stations: 0 });
  const [searching, setSearching] = useState(false);
  const [slow, setSlow] = useState(false);
  const fail = (source: string, value: boolean) => setErrors((e) => ({ ...e, [source]: value }));
  const retry = (source: keyof typeof attempts) =>
    setAttempts((a) => ({ ...a, [source]: a[source] + 1 }));

  useEffect(() => {
    let cancelled = false;
    fail("destination", false);
    getCityCenter(airport.city, airport.countryCode)
      .then((p) => {
        if (cancelled) return;
        if (p) setDestination(p);
        else fail("destination", true);
      })
      .catch(() => !cancelled && fail("destination", true));
    return () => {
      cancelled = true;
    };
  }, [airport, attempts.destination]);

  useEffect(() => {
    let cancelled = false;
    setHits([]);
    if (query.trim().length < 3) return;
    const timer = setTimeout(() => {
      setSearching(true);
      fail("search", false);
      geocodeNominatim(query.trim(), airport.countryCode)
        .then((p) => !cancelled && setHits(p))
        .catch(() => !cancelled && fail("search", true))
        .finally(() => !cancelled && setSearching(false));
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, airport.countryCode]);

  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    setRoute(undefined);
    fail("route", false);
    fetchOsrmRoute([airport.lat, airport.lon], [destination.lat, destination.lon])
      .then((r) => !cancelled && setRoute(r))
      .catch(() => !cancelled && fail("route", true));
    return () => {
      cancelled = true;
    };
  }, [airport.lat, airport.lon, destination, attempts.route]);

  useEffect(() => {
    let cancelled = false;
    setGuide(undefined);
    fail("guide", false);
    transportGuide(airport.city, i18n.language)
      .then((g) => !cancelled && setGuide(g))
      .catch(() => !cancelled && fail("guide", true));
    return () => {
      cancelled = true;
    };
  }, [airport.city, i18n.language, attempts.guide]);

  useEffect(() => {
    let cancelled = false;
    const saved = peekPlaces("transport", airport.lat, airport.lon, STATION_RADIUS);
    setStations(saved ? { ...saved, stale: !saved.fresh } : undefined);
    fail("stations", false);
    setSlow(false);
    const timer = setTimeout(() => !cancelled && setSlow(true), 3000);
    nearbyStations(airport)
      .then((s) => {
        if (!cancelled) {
          setStations(s);
          fail("stations", s.stale);
        }
      })
      .catch(() => !cancelled && fail("stations", true))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [airport, attempts.stations]);

  const sourceError = (source: keyof typeof attempts) =>
    errors[source] && (
      <div role="alert" className="my-2 text-sm text-destructive">
        {t("common.error")}{" "}
        <Button variant="link" className="min-h-11 px-1" onClick={() => retry(source)}>
          {t("common.retry")}
        </Button>
      </div>
    );
  const showRoute = (place = destination) => place && onShowRoute(place);
  const routeButton = (
    <Button
      variant="outline"
      disabled={!destination}
      onClick={() => showRoute()}
      className="mt-3 min-h-11 w-full whitespace-normal"
    >
      <Navigation />
      {t("common.showRoute")}
    </Button>
  );

  return (
    <section className="mt-6 pb-24">
      <h2 className="text-xl font-semibold">{t("ride.title")}</h2>
      <label htmlFor="ride-destination" className="mt-4 block text-sm font-medium">
        {t("ride.destination")}
      </label>
      <Input
        id="ride-destination"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={destination?.name ?? t("ride.center", { city: airport.city })}
        className="mt-2 min-h-12 text-base"
        autoComplete="off"
      />
      {sourceError("destination")}
      {searching && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {t("ride.searching")}
        </p>
      )}
      {errors["search"] && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("ride.searchError")}
        </p>
      )}
      {hits.length > 0 && (
        <ul className="mt-2 divide-y rounded-lg border bg-card">
          {hits.map((p) => (
            <li key={p.id}>
              <Button
                variant="ghost"
                className="h-auto min-h-12 w-full justify-start whitespace-normal px-3 py-3 text-left"
                onClick={() => {
                  setDestination(p);
                  setQuery("");
                  setHits([]);
                }}
              >
                {p.tags?.["display_name"] ?? p.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {destination && (
        <p className="mt-2 break-words text-sm text-muted-foreground">
          {t("ride.to", { name: destination.name })}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <article className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Car />
            {t("ride.uber")}
          </h3>
          <Button asChild className="mt-3 min-h-11 w-full" disabled={!destination}>
            {destination ? (
              <a
                href={uberDeepLink(airport, destination)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ride.openUber")}
              </a>
            ) : (
              <span>{t("ride.openUber")}</span>
            )}
          </Button>
          {routeButton}
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">{t("ride.bolt")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("ride.boltNote")}</p>
          <Button asChild className="mt-3 min-h-11 w-full">
            <a href={BOLT_URL} target="_blank" rel="noopener noreferrer">
              {t("ride.openBolt")}
            </a>
          </Button>
          {routeButton}
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">{t("ride.taxi")}</h3>
          {sourceError("route")}
          {route ? (
            <>
              <p className="mt-2 text-lg font-semibold">
                {t("ride.estimate")}:{" "}
                {formatFare(
                  estimateTaxiFare(route.distanceM, route.durationSec, airport.countryCode),
                  i18n.language,
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistance(route.distanceM, i18n.language)} ·{" "}
                {formatDuration(route.durationSec, i18n.language)}
              </p>
            </>
          ) : (
            !errors["route"] && <Skeleton className="mt-3 h-12" />
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("ride.estimateNote")}</p>
          {routeButton}
        </article>
        <article className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrainFront />
            {t("ride.public")}
          </h3>
          {sourceError("guide")}
          {guide ? (
            <>
              <p className="mt-3 whitespace-pre-line break-words text-sm">
                {guide.text ?? t("ride.noGuide")}
              </p>
              {guide.text && (
                <a
                  className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline"
                  href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(airport.city)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("ride.guideSource")}
                </a>
              )}
            </>
          ) : (
            !errors["guide"] && <Skeleton className="mt-3 h-20" />
          )}
          {routeButton}
        </article>
      </div>
      <h3 className="mt-6 font-semibold">{t("ride.stations")}</h3>
      {sourceError("stations")}
      {stations?.stale && (
        <p className="text-xs text-muted-foreground">
          {t("common.savedEarlier", {
            date: new Intl.DateTimeFormat(i18n.language).format(stations.fetchedAt),
          })}
        </p>
      )}
      {!stations && !errors["stations"] && (
        <>
          {slow && (
            <p role="status" className="mt-2 text-sm">
              {t("common.stillSearching")}
            </p>
          )}
          <Skeleton className="mt-3 h-24" />
        </>
      )}
      {stations?.places.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">{t("ride.noStations")}</p>
      )}
      {stations?.places.map((p) => (
        <article key={p.id} className="mt-3 rounded-lg border p-3">
          <h4 className="font-medium">{p.name}</h4>
          <p className="text-sm text-muted-foreground">
            {t(`category.${p.kind}`)} · {formatDistance(p.distance ?? 0, i18n.language)}
          </p>
          <Button variant="outline" className="mt-2 min-h-11 w-full" onClick={() => showRoute(p)}>
            <Navigation />
            {t("common.showRoute")}
          </Button>
        </article>
      ))}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button
          variant="outline"
          onClick={onBack}
          className="mx-auto flex min-h-12 w-full max-w-xl"
        >
          <ArrowLeft />
          {t("common.back")}
        </Button>
      </div>
    </section>
  );
}
