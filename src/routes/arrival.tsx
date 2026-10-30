import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { ArrivalActionSheet } from "@/features/arrival/ArrivalActionSheet";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/features/arrival/AppHeader";
import { prefetchFood, prefetchSights, getAirportByIata } from "@/features/arrival/services";
import { Button } from "@/components/ui/button";
import type { ArrivalSection } from "@/features/arrival/ArrivalActionSheet";
import type { ArrivalMessage } from "@/features/arrival/AskAI";
import type { Airport } from "@/features/arrival/types";
import { ArrowDown, MapPin, Plane, Compass } from "lucide-react";
import { ArrivalOptions } from "@/features/arrival/ArrivalOptions";
import cityImage from "@/assets/arrival-city.jpg";

// Leaflet is browser-only, so the map module is loaded on demand.
// Each section is loaded on demand too.
const FoodList = lazy(() =>
  import("@/features/arrival/FoodList").then((m) => ({ default: m.FoodList })),
);
const RouteMap = lazy(() =>
  import("@/features/arrival/RouteMap").then((m) => ({ default: m.RouteMap })),
);

const VisitList = lazy(() =>
  import("@/features/arrival/VisitList").then((m) => ({ default: m.VisitList })),
);
const RideOptions = lazy(() =>
  import("@/features/arrival/RideOptions").then((m) => ({ default: m.RideOptions })),
);
const AskAI = lazy(() => import("@/features/arrival/AskAI").then((m) => ({ default: m.AskAI })));

const STORAGE_KEY = "arrival-assistant:airport";

const searchSchema = z.object({
  iata: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/arrival")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Arrival Assistant — Just landed? Start here" },
      {
        name: "description",
        content: "Pick the airport you landed at and find food, rides and sights nearby.",
      },
      { property: "og:title", content: "Arrival Assistant" },
      {
        property: "og:description",
        content: "Just landed? Find food, rides and sights near your airport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArrivalPage,
});

interface Target {
  lat: number;
  lon: number;
  name: string;
}

function ArrivalPage() {
  const { iata } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hydrated = useHydrated();
  const { t } = useTranslation();
  const [airport, setAirport] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [section, setSection] = useState<ArrivalSection | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [messages, setMessages] = useState<ArrivalMessage[]>([]);

  // Initial airport: URL param wins, then localStorage.
  useEffect(() => {
    let cancelled = false;
    const code = iata || (localStorage.getItem(STORAGE_KEY) ?? "");
    if (!code) return;
    getAirportByIata(code)
      .then((a) => {
        if (cancelled || !a) return;
        setAirport(a);
        prefetchFood(a);
        prefetchSights(a);
        if (iata) setSheetOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [iata]);

  const select = (a: Airport) => {
    if (airport?.iata !== a.iata) setMessages([]);
    setAirport(a);
    prefetchFood(a);
    prefetchSights(a);
    localStorage.setItem(STORAGE_KEY, a.iata);
    setSheetOpen(true);
    navigate({ search: { iata: a.iata }, replace: true });
  };

  const clear = () => {
    setAirport(null);
    setSection(null);
    setSheetOpen(false);
    localStorage.removeItem(STORAGE_KEY);
    navigate({ search: { iata: "" }, replace: true });
  };

  return (
    <>
      <AppHeader />
      {!section && (
        <section className="arrival-hero">
          <img src={cityImage} alt="" width={1600} height={912} fetchPriority="high" className="arrival-hero-image" />
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
      <main className={`arrival-main mx-auto w-full px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 ${section ? "max-w-3xl pt-7" : "max-w-6xl pt-9 sm:pt-12"}`}>
        {section && <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Compass className="h-4 w-4" />{t("design.companion")}</p>}
        <div id="airport-search" className={`scroll-mt-28 ${!section ? "airport-search-band" : ""}`}>
          {!section && <div className="search-band-title"><span className="section-index" aria-hidden>01 /</span><h2 className="font-display text-3xl sm:text-4xl">{t("design.destination")}</h2></div>}
          <div className={!section ? "w-full max-w-xl" : "w-full"}>
          <AirportSearch selected={airport} onSelect={select} onClear={clear} />
          </div>
        </div>
        {!section && <section className="mt-9 border-t pt-7 sm:mt-11 sm:pt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="section-index" aria-hidden>02 /</span><h2 className="font-display text-3xl">{t("sheet.openOptions")}</h2></div>{airport && <Button variant="ghost" onClick={() => setSheetOpen(true)} className="min-h-11 text-primary"><Compass />{airport.city}</Button>}</div>
          <ArrivalOptions city={airport?.city ?? ""} disabled={!airport} onPick={(s) => { setSection(s); setSheetOpen(false); }} />
        </section>}

        {hydrated && airport && section === "food" && (
          <Suspense fallback={null}>
            <FoodList
              airport={airport}
              onBack={() => {
                setSection(null);
                setSheetOpen(true);
              }}
              onShowRoute={(p) => setTarget({ lat: p.lat, lon: p.lon, name: p.name })}
            />
          </Suspense>
        )}

        {hydrated && airport && (
          <Suspense fallback={null}>
            {section === "visit" && (
              <VisitList
                airport={airport}
                onBack={() => {
                  setSection(null);
                  setSheetOpen(true);
                }}
                onShowRoute={setTarget}
              />
            )}
            {section === "ride" && (
              <RideOptions
                airport={airport}
                onBack={() => {
                  setSection(null);
                  setSheetOpen(true);
                }}
                onShowRoute={setTarget}
              />
            )}
            {section === "ask" && (
              <AskAI
                airport={airport}
                messages={messages}
                onMessages={setMessages}
                onBack={() => {
                  setSection(null);
                  setSheetOpen(true);
                }}
                onShowRoute={setTarget}
              />
            )}
          </Suspense>
        )}

        <ArrivalActionSheet
          open={sheetOpen && !!airport}
          city={airport?.city ?? ""}
          onOpenChange={setSheetOpen}
          onPick={(s) => {
            setSection(s);
            setSheetOpen(false);
          }}
        />

        {hydrated && target && airport && (
          <Suspense fallback={null}>
            <RouteMap
              from={{ lat: airport.lat, lon: airport.lon, name: `${airport.iata} ${airport.city}` }}
              to={target}
              onBack={() => setTarget(null)}
            />
          </Suspense>
        )}
      </main>
      {!section && <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8"><span className="font-semibold">{t("design.brand")}.</span><span>{t("design.footer")}</span><Plane className="h-4 w-4 text-primary" /></footer>}
    </>
  );
}
