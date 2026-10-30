import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { getAirportByIata } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";

const STORAGE_KEY = "arrival-assistant:airport";

const searchSchema = z.object({
  iata: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/arrival")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Arrival Assistant — Just landed? Start here" },
      { name: "description", content: "Pick the airport you landed at and find food, rides and sights nearby." },
      { property: "og:title", content: "Arrival Assistant" },
      { property: "og:description", content: "Just landed? Find food, rides and sights near your airport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArrivalPage,
});

function ArrivalPage() {
  const { iata } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [airport, setAirport] = useState<Airport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Arrival Assistant</h1>
      <p className="mt-2 text-muted-foreground">Just landed? Tell us where, and we'll help with the rest.</p>
      <div className="mt-8">
        <AirportSearch selected={airport} onSelect={select} onClear={clear} />
      </div>
      {/* Action sheet (section 2) comes next; sheetOpen is already tracked. */}
      {sheetOpen && airport && <span hidden data-sheet-pending={airport.iata} />}
    </main>
  );
}
