import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useHydrated } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowDown, Compass, MapPin, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AirportSearch } from "./AirportSearch";
import { ArrivalActionSheet, type ArrivalSection } from "./ArrivalActionSheet";
import type { ArrivalMessage } from "./AskAI";
import { ArrivalOptions } from "./ArrivalOptions";
import { WeatherCard } from "./WeatherCard";
import { getAirportByIata, prefetchFood, prefetchSights } from "./services";
import type { Airport } from "./types";
import cityImage from "@/assets/arrival-craiova.jpg";

// Leaflet is browser-only and each section is heavy, so they load on demand.
const FoodList = lazy(() => import("./FoodList").then((m) => ({ default: m.FoodList })));
const RouteMap = lazy(() => import("./RouteMap").then((m) => ({ default: m.RouteMap })));
const VisitList = lazy(() => import("./VisitList").then((m) => ({ default: m.VisitList })));
const RideOptions = lazy(() => import("./RideOptions").then((m) => ({ default: m.RideOptions })));
const AskAI = lazy(() => import("./AskAI").then((m) => ({ default: m.AskAI })));

const STORAGE_KEY = "arrival-assistant:airport";

interface Target { lat: number; lon: number; name: string }

/**
 * The Arrival Assistant. Standalone (/arrival) it has its own banner and airport search;
 * embedded in a trip it is fixed to the trip's destination airport.
 */
export function ArrivalAssistant({ iata, embedded = false, onIataChange }: { iata: string; embedded?: boolean; onIataChange?: (iata: string) => void }) {
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const [airport, setAirport] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [section, setSection] = useState<ArrivalSection | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [messages, setMessages] = useState<ArrivalMessage[]>([]);
  const current = useRef("");

  // Initial airport: the given code wins, then (standalone only) the last one used.
  useEffect(() => {
    let cancelled = false;
    const code = iata || (embedded ? "" : localStorage.getItem(STORAGE_KEY) ?? "");
    if (!code) return;
    getAirportByIata(code)
      .then((a) => {
        if (cancelled || !a) return;
        // A different airport starts a fresh chat and closes any open section.
        if (current.current && current.current !== a.iata) { setMessages([]); setSection(null); }
        current.current = a.iata;
        setAirport(a);
        prefetchFood(a);
        prefetchSights(a);
        if (iata && !embedded) setSheetOpen(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [iata, embedded]);

  const select = (a: Airport) => {
    if (airport?.iata !== a.iata) setMessages([]);
    current.current = a.iata;
    setAirport(a);
    prefetchFood(a);
    prefetchSights(a);
    localStorage.setItem(STORAGE_KEY, a.iata);
    setSheetOpen(true);
    onIataChange?.(a.iata);
  };

  const clear = () => {
    setAirport(null);
    setSection(null);
    setSheetOpen(false);
    localStorage.removeItem(STORAGE_KEY);
    onIataChange?.("");
  };

  const back = () => { setSection(null); if (!embedded) setSheetOpen(true); };
  const showHero = !embedded && !section;

  return (
    <>
      {showHero && (
        <section className="arrival-hero">
          <img src={cityImage} alt="" width={1920} height={1088} fetchPriority="high" className="arrival-hero-image" />
          <div className="arrival-hero-shade" />
          <div className="arrival-hero-content">
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase"><Plane className="h-4 w-4" />{t("design.eyebrow")}</p>
            <h1 className="font-display text-5xl font-normal leading-[1.05] sm:text-7xl">{t("app.title")}</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-hero-foreground/90">{t("app.tagline")}</p>
            <a href="#airport-search" className="mt-7 inline-flex min-h-11 items-center gap-3 text-sm font-medium">{t("design.begin")}<ArrowDown className="h-4 w-4" /></a>
          </div>
          <span className="arrival-photo-caption"><MapPin className="h-3.5 w-3.5" />{t("design.photoLocation")}</span>
        </section>
      )}
      <div className={embedded ? "arrival-main" : `arrival-main mx-auto w-full px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 ${section ? "max-w-3xl pt-7" : "max-w-6xl pt-9 sm:pt-12"}`}>
        {section && !embedded && <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Compass className="h-4 w-4" />{t("design.companion")}</p>}
        {!embedded && (
          <div id="airport-search" className={`scroll-mt-28 ${!section ? "airport-search-band" : ""}`}>
            {!section && <div className="search-band-title"><span className="section-index" aria-hidden>01 /</span><h2 className="font-display text-3xl sm:text-4xl">{t("design.destination")}</h2></div>}
            <div className={!section ? "w-full max-w-xl" : "w-full"}>
              <AirportSearch selected={airport} onSelect={select} onClear={clear} />
            </div>
          </div>
        )}
        {hydrated && airport && !section && (
          <div className={embedded ? "" : "mt-6 max-w-xl"}>
            <WeatherCard lat={airport.lat} lon={airport.lon} city={airport.city} />
          </div>
        )}
        {!section && (
          <section className={embedded ? "mt-7" : "mt-9 border-t pt-7 sm:mt-11 sm:pt-8"}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {!embedded && <span className="section-index" aria-hidden>02 /</span>}
                <h2 className="font-display text-3xl">{embedded && airport ? t("trips.arrivalIn", { city: airport.city }) : t("sheet.openOptions")}</h2>
              </div>
              {airport && !embedded && <Button variant="ghost" onClick={() => setSheetOpen(true)} className="min-h-11 text-primary"><Compass />{airport.city}</Button>}
            </div>
            <ArrivalOptions city={airport?.city ?? ""} disabled={!airport} onPick={(s) => { setSection(s); setSheetOpen(false); }} />
          </section>
        )}

        {hydrated && airport && (
          <Suspense fallback={null}>
            {section === "food" && <FoodList airport={airport} onBack={back} onShowRoute={(p) => setTarget({ lat: p.lat, lon: p.lon, name: p.name })} />}
            {section === "visit" && <VisitList airport={airport} onBack={back} onShowRoute={setTarget} />}
            {section === "ride" && <RideOptions airport={airport} onBack={back} onShowRoute={setTarget} />}
            {section === "ask" && <AskAI airport={airport} messages={messages} onMessages={setMessages} onBack={back} onShowRoute={setTarget} />}
          </Suspense>
        )}

        {!embedded && (
          <ArrivalActionSheet
            open={sheetOpen && !!airport}
            city={airport?.city ?? ""}
            onOpenChange={setSheetOpen}
            onPick={(s) => { setSection(s); setSheetOpen(false); }}
          />
        )}

        {hydrated && target && airport && (
          <Suspense fallback={null}>
            <RouteMap
              from={{ lat: airport.lat, lon: airport.lon, name: `${airport.iata} ${airport.city}` }}
              to={target}
              onBack={() => setTarget(null)}
            />
          </Suspense>
        )}
      </div>
      {showHero && <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8"><span className="font-semibold">{t("design.brand")}.</span><span>{t("design.footer")}</span><a href="https://commons.wikimedia.org/wiki/File:Nicolae_Romanescu_Park_in_Craiova,_Romania.jpg" target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-4 hover:text-foreground">{t("design.photoCredit")}</a><Plane className="h-4 w-4 text-primary" /></footer>}
    </>
  );
}
