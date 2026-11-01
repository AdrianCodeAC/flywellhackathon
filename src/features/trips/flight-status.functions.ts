import { createServerFn } from "@tanstack/react-start";
import { guard } from "@/lib/request-guard";
import { z } from "zod";
import { flightCodeSchema, parseFlightStatus, type FlightLookup } from "./flight";

const input = z.object({ flight: flightCodeSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Live status of one flight on one day. The free AviationStack plan allows few calls a
 * month, so every phone shares one saved answer per flight for ten minutes.
 */
export const getFlightStatus = createServerFn({ method: "POST" })
  .middleware([guard("flight-status", 6)])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<FlightLookup> => {
    const key = process.env["AVIATIONSTACK_KEY"];
    if (!key) return { kind: "unconfigured" };
    const { cachedText } = await import("@/features/arrival/content-cache.server");
    const { loggedFetch } = await import("@/features/arrival/external-http");
    try {
      const text = await cachedText(
        `flight-status:${data.flight}:${data.date}`,
        10 * 60_000,
        async () => {
          // The free plan only serves plain HTTP; the key never reaches the browser.
          const url = `http://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&flight_iata=${data.flight}`;
          const res = await loggedFetch(url, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) return undefined;
          const status = parseFlightStatus(await res.json(), data.date);
          return JSON.stringify(status ? { kind: "found", status } : { kind: "notFound" });
        },
      );
      return text ? (JSON.parse(text) as FlightLookup) : { kind: "error" };
    } catch {
      return { kind: "error" };
    }
  });
