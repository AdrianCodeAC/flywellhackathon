/** Airport layouts saved on the phone so the map still opens in airplane mode. */
import { LAYOUT_VERSION, type AirportLayout } from "./layout";
import { getAirportLayout } from "./layout.functions";

const KEY = (iata: string) => `flywell:airport-layout:v${LAYOUT_VERSION}:${iata}`;
const MAX_AGE = 30 * 24 * 3600 * 1000;

export function savedLayout(iata: string): AirportLayout | undefined {
  try {
    const raw = localStorage.getItem(KEY(iata));
    if (!raw) return undefined;
    const layout = JSON.parse(raw) as AirportLayout;
    return layout.version === LAYOUT_VERSION ? layout : undefined;
  } catch {
    return undefined;
  }
}

const inflight = new Map<string, Promise<AirportLayout | undefined>>();

/** Saved copy when fresh, else download and save. Falls back to an old copy offline. */
export function loadLayout(iata: string): Promise<AirportLayout | undefined> {
  const saved = savedLayout(iata);
  if (saved && Date.now() - Date.parse(saved.fetchedAt) < MAX_AGE) return Promise.resolve(saved);
  const running = inflight.get(iata);
  if (running) return running;
  const next = getAirportLayout({ data: { iata } })
    .then((layout) => {
      if (!layout) return saved;
      try {
        localStorage.setItem(KEY(iata), JSON.stringify(layout));
      } catch {
        /* storage full: still show it now */
      }
      return layout;
    })
    .catch(() => saved)
    .finally(() => inflight.delete(iata));
  inflight.set(iata, next);
  return next;
}
