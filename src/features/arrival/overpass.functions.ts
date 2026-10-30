import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { overpassKey } from "./place-utils";
import { sourceCacheKey } from "./place-sources";
import type { Place } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const input = z.object({
  category: z.enum(["food", "sights", "transport"]),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusM: z.number().int().min(300).max(10_000),
  lang: z.enum(["en", "ro"]).default("en"),
});

export interface OverpassResult {
  places: Place[];
  /** When this data was fetched from OpenStreetMap (ms). */
  fetchedAt: number;
  /** true when every mirror failed and this is an older saved copy. */
  stale: boolean;
}

/**
 * Public read-only proxy: shared 24h database cache in front of a race across
 * Overpass mirrors. Only whitelisted categories and bounded radii are accepted.
 */
export const getOverpassPlaces = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<OverpassResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { searchArrivalPlaces } = await import("./place-sources.server");
    const key = sourceCacheKey(data.category, data.lat, data.lon, data.radiusM, data.lang);

    const { data: row } = await supabaseAdmin
      .from("overpass_cache")
      .select("places, created_at")
      .eq("cache_key", key)
      .maybeSingle();
    const rowAt = row ? new Date(row.created_at).getTime() : 0;
    if (row && Date.now() - rowAt < DAY_MS) {
      return { places: row.places as unknown as Place[], fetchedAt: rowAt, stale: false };
    }

    try {
      const places = await searchArrivalPlaces(data.category, data.lat, data.lon, data.radiusM, data.lang);
      const now = new Date();
      await supabaseAdmin.from("overpass_cache").upsert({
        cache_key: key,
        places: places as unknown as never,
        radius_m: data.radiusM,
        created_at: now.toISOString(),
      });
      return { places, fetchedAt: now.getTime(), stale: false };
    } catch (e) {
      console.error("Arrival place sources failed", key, e);
      if (row) return { places: row.places as unknown as Place[], fetchedAt: rowAt, stale: true };
      throw new Error("Place data is unavailable right now");
    }
  });
