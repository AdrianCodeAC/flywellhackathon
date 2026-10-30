import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { ArrivalActionSheet } from "@/features/arrival/ArrivalActionSheet";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/features/arrival/AppHeader";
import { getCityCenter as geocodeCityCenter, getAirportByIata } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";

// Leaflet is browser-only, so the map module is loaded on demand.
// Each section is loaded on demand too.
const FoodList = lazy(() => import("@/features/arrival/FoodList").then((m) => ({ default: m.FoodList })));
const RouteMap = lazy(() => import("@/features/arrival/RouteMap").then((m) => ({ default: m.RouteMap })));

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
      { property: "og:description", content: "Just landed? Find food, rides and sights near your airport." },
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
  const [section, setSection] = useState<"food" | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);

  // Initial airport: URL param wins, then localStorage.
  useEffect(() => {
    let cancelled = false;
    const code = iata || (localStorage.getItem(STORAGE_KEY) ?? "");
    if (!code) return;
    getAirportByIata(code)
      .then((a) => {
        if (cancelled || !a) return;
        setAirport(a);
        if (iata) setSheetOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [iata]);

  const select = (a: Airport) => {
    setAirport(a);
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

  // Temporary check that the shared map + routing works end to end.
  const routeToCityCenter = async () => {
    if (!airport || finding) return;
    setFinding(true);
    setFindError(null);
    try {
      const hit = await geocodeCityCenter(airport.city, airport.countryCode);
      if (!hit) {
        setFindError("test.findError");
        return;
      }
      setTarget({ lat: hit.lat, lon: hit.lon, name: hit.name });
    } catch {
      setFindError("test.findError");
    } finally {
      setFinding(false);
    }
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

      {airport && (
        <div className="mt-6">
          <button
            type="button"
            onClick={routeToCityCenter}
            disabled={finding}
            className="min-h-11 rounded-md border px-4 text-sm active:bg-accent disabled:opacity-60"
          >
            {finding ? t("test.finding") : t("test.routeToCenter")}
          </button>
          {findError && <p className="mt-2 text-sm text-destructive">{t(findError)}</p>}
        </div>
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
