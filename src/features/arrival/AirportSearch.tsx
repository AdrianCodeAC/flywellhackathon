import { useEffect, useId, useState } from "react";
import { Plane, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadAirports } from "./services";
import { formatAirport, searchAirports } from "./airport-search";
import type { Airport } from "./types";

interface AirportSearchProps {
  selected: Airport | null;
  onSelect: (airport: Airport) => void;
  onClear: () => void;
}

export function AirportSearch({ selected, onSelect, onClear }: AirportSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [airports, setAirports] = useState<Airport[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    loadAirports().then(setAirports).catch(() => setError(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const results = airports ? searchAirports(airports, debounced) : [];
  useEffect(() => setActive(0), [debounced]);

  const pick = (a: Airport) => {
    onSelect(a);
    setQuery("");
    setDebounced("");
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1.5 text-sm">
          <Plane className="h-4 w-4" />
          <span className="font-semibold">{selected.iata}</span>
          <span>{selected.city}</span>
          <button
            type="button"
            onClick={onClear}
            aria-label="Change airport"
            className="ml-1 rounded-full p-0.5 hover:bg-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="mb-2 block text-sm font-medium">
        Where did you land?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          autoComplete="off"
          placeholder="Airport code, name or city (e.g. LIS)"
          className="h-12 pl-9 text-base"
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
              pick(results[active]);
            }
          }}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive">Couldn't load airports right now — please refresh.</p>
      )}
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
              className={`cursor-pointer rounded-sm px-3 py-2.5 text-sm ${i === active ? "bg-accent text-accent-foreground" : ""}`}
            >
              {formatAirport(a)}
            </li>
          ))}
        </ul>
      )}
      {debounced.trim().length >= 2 && airports && results.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">No airports match "{debounced}".</p>
      )}
    </div>
  );
}
