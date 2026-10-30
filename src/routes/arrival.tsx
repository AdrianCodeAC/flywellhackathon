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
      <main className="mx-auto min-h-dvh w-full max-w-xl px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-12">
        <h1 className="text-3xl font-bold tracking-tight">{t("app.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("app.tagline")}</p>

        <div className="mt-8">
          <AirportSearch selected={airport} onSelect={select} onClear={clear} />
        </div>

        {airport && !section && (
          <Button
            variant="outline"
            onClick={() => setSheetOpen(true)}
            className="mt-6 min-h-12 w-full"
          >
            {t("sheet.openOptions")}
          </Button>
        )}

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
    </>
  );
}
