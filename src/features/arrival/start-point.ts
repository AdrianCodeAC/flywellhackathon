import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMeters } from "./place-utils";
import type { Airport } from "./types";

/** Farther than this from the airport, the phone is not "here" yet (still at home, in the air). */
export const NEARBY_M = 50_000;

export type StartSource = "you" | "airport";
export type LocateStatus = "idle" | "locating" | "denied" | "unavailable";

export interface StartPoint {
  lat: number;
  lon: number;
  source: StartSource;
  /** The phone has a fix, but it is too far from this airport to measure from. */
  far: boolean;
}

/**
 * One start point for both the distances on the cards and the "Show route" map,
 * so they always agree: the phone's live position when it is near this airport,
 * otherwise the airport where the traveller lands.
 */
export function pickStart(airport: Pick<Airport, "lat" | "lon">, here: [number, number] | null): StartPoint {
  if (here && distanceMeters([airport.lat, airport.lon], here) <= NEARBY_M) {
    return { lat: here[0], lon: here[1], source: "you", far: false };
  }
  return { lat: airport.lat, lon: airport.lon, source: "airport", far: !!here };
}

/**
 * Follows the phone's position while `active`. It only starts by itself when location
 * is already allowed; otherwise `locate()` (a tap) asks for it.
 */
export function useStartPoint(airport: Airport | null, active: boolean) {
  const [here, setHere] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<LocateStatus>("idle");
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null && typeof navigator !== "undefined") navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watch.current !== null) return;
    setStatus("locating");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("idle");
        setHere((prev) => {
          const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          // Ignore GPS jitter under 20 m so the list doesn't reshuffle constantly.
          return prev && distanceMeters(prev, next) < 20 ? prev : next;
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          stop();
        } else setStatus("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  }, [stop]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => { if (!cancelled && p.state === "granted") locate(); })
      .catch(() => {});
    return () => { cancelled = true; stop(); };
  }, [active, locate, stop]);

  const start = airport ? pickStart(airport, here) : null;
  return { start, status, locate };
}

export type StartPointState = ReturnType<typeof useStartPoint>;
