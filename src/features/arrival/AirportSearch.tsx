import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { LocateFixed, Loader2, Plane, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadAirports } from "./services";
import { formatAirport, nearestAirport, searchAirports } from "./airport-search";
import type { Airport } from "./types";

interface AirportSearchProps {
  selected: Airport | null;
  onSelect: (airport: Airport) => void;
  onClear: () => void;
  label?: string;
}

export function AirportSearch({ selected, onSelect, onClear, label }: AirportSearchProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const listId = useId();

  useEffect(() => {
    loadAirports().then(setAirports).catch(() => setError(true));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  const results = airports ? searchAirports(airports, debounced) : [];
  useEffect(() => setActive(0), [debounced]);

  const pick = (a: Airport) => {
    onSelect(a);
    setQuery("");
    setDebounced("");
    setGeoMessage(null);
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoMessage("search.locationUnsupported");
      return;
    }
    setLocating(true);
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = airports ?? (await loadAirports());
          const hit = nearestAirport(list, pos.coords.latitude, pos.coords.longitude);
          if (hit) pick(hit.airport);
          else setGeoMessage("search.locationUnavailable");
        } catch {
          setGeoMessage("search.locationUnavailable");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setGeoMessage(err.code === err.PERMISSION_DENIED ? "search.locationDenied" : "search.locationUnavailable");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  };

  if (selected) {
    return (
      <div className="flex min-h-14 w-full max-w-full items-center gap-3 rounded-lg border border-primary/20 bg-secondary pl-4 text-sm text-secondary-foreground">
        <Plane className="h-4 w-4 shrink-0" />
        <span className="font-semibold">{selected.iata}</span>
        <span className="min-w-0 truncate">{selected.city}</span>
        <Button variant="outline"
          type="button"
          onClick={onClear}
          aria-label={t("search.change")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-background"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="mb-2 block text-sm font-medium">
        {label ?? t("search.label")}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t("search.placeholder")}
            className="h-14 rounded-lg pl-10 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (!results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const chosen = results[active];
                if (chosen) pick(chosen);
              }
            }}
          />
        </div>
        <Button variant="outline"
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          aria-label={t("search.useLocation")}
          title={t("search.useLocation")}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border active:bg-accent disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
        </Button>
      </div>
      {locating && <p className="mt-2 text-sm text-muted-foreground">{t("search.locating")}</p>}
      {geoMessage && <p className="mt-2 text-sm text-muted-foreground">{t(geoMessage)}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{t("search.loadError")}</p>}
      {results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.map((a, i) => (
            <li
              key={a.iata}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center rounded-sm px-3 py-2 text-sm ${i === active ? "bg-accent text-accent-foreground" : ""}`}
            >
              {formatAirport(a, i18n.language)}
            </li>
          ))}
        </ul>
      )}
      {debounced.trim().length >= 2 && airports && results.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">{t("search.noMatch", { query: debounced })}</p>
      )}
    </div>
  );
}
