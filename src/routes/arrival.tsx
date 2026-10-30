import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { ArrivalActionSheet } from "@/features/arrival/ArrivalActionSheet";
import { geocodeNominatim, getAirportByIata } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";

// Leaflet is browser-only, so the map module is loaded on demand.
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
  const [airport, setAirport] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      const hits = await geocodeNominatim(`${airport.city} center`);
      const hit = hits[0];
      if (!hit) {
        setFindError("Couldn't find the city center — try again.");
        return;
      }
      setTarget({ lat: hit.lat, lon: hit.lon, name: hit.name });
    } catch {
      setFindError("Couldn't find the city center — try again.");
    } finally {
      setFinding(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Arrival Assistant</h1>
      <p className="mt-2 text-muted-foreground">Just landed? Tell us where, and we'll help with the rest.</p>

      <div className="mt-8">
        <AirportSearch selected={airport} onSelect={select} onClear={clear} />
      </div>

      {airport && (
        <div className="mt-6">
          <button
            type="button"
            onClick={routeToCityCenter}
            disabled={finding}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
          >
            {finding ? "Finding the city center…" : "Route to city center"}
          </button>
          {findError && <p className="mt-2 text-sm text-destructive">{findError}</p>}
        </div>
      )}

      <ArrivalActionSheet open={sheetOpen && !!airport} city={airport?.city ?? ""} onOpenChange={setSheetOpen} />

      <ClientOnly>
        {() =>
          target && airport ? (
            <Suspense fallback={null}>
              <RouteMap
                from={{ lat: airport.lat, lon: airport.lon, name: `${airport.iata} ${airport.city}` }}
                to={target}
                onBack={() => setTarget(null)}
              />
            </Suspense>
          ) : null
        }
      </ClientOnly>
    </main>
  );
}
