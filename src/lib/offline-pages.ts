/**
 * Saves pages into the service worker's "pages" cache while the phone is online,
 * so they open later in airplane mode. Only works where the app's service worker
 * runs (the published, installed app) — never in preview.
 */
const PAGES_CACHE = "pages";

export type OfflineState = "ready" | "unavailable";

export async function keepPagesOffline(paths: string[]): Promise<OfflineState> {
  if (typeof window === "undefined" || !("caches" in window) || !navigator.serviceWorker?.controller)
    return "unavailable";
  try {
    const cache = await caches.open(PAGES_CACHE);
    if (navigator.onLine) {
      await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(path, { credentials: "same-origin" });
          if (res.ok) await cache.put(path, res);
        }),
      );
    }
    const hits = await Promise.all(paths.map((p) => cache.match(p, { ignoreSearch: true })));
    return hits.every(Boolean) ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  }
}
