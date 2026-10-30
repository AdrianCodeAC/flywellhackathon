import type { Airport } from "./types";

/** Rank airports for a query: exact IATA > IATA prefix > city prefix > name/city contains. */
export function searchAirports(airports: Airport[], query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { a: Airport; s: number }[] = [];
  for (const a of airports) {
    const iata = a.iata.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    let s = 0;
    if (iata === q) s = 100;
    else if (iata.startsWith(q)) s = 80;
    else if (city.startsWith(q)) s = 60;
    else if (name.startsWith(q)) s = 50;
    else if (city.includes(q)) s = 40;
    else if (name.includes(q)) s = 30;
    if (s) scored.push({ a, s });
  }
  scored.sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city));
  return scored.slice(0, limit).map((x) => x.a);
}

export function formatAirport(a: Airport): string {
  return `${a.iata} · ${a.name}, ${[a.city, a.country].filter(Boolean).join(", ")}`;
}
