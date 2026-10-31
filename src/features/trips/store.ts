import { useEffect, useState } from "react";
import { myTripSchema, sortTrips, type MyTrip } from "./model";

/** Trips live on the phone first so every tab opens in airplane mode; the account keeps a copy. */
const KEY = "flywell:my-trips";
const listeners = new Set<() => void>();

export function listTrips(): MyTrip[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((v) => {
      const parsed = myTripSchema.safeParse(v);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function write(trips: MyTrip[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(trips.slice(0, 100)));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export const getTrip = (id: string) => listTrips().find((t) => t.id === id) ?? null;

export function upsertTrip(trip: MyTrip) {
  write([trip, ...listTrips().filter((t) => t.id !== trip.id)]);
}

export function removeTrip(id: string) {
  write(listTrips().filter((t) => t.id !== id));
}

export function markSynced(id: string) {
  write(listTrips().map((t) => (t.id === id ? { ...t, synced: true } : t)));
}

/** On sign-out, account copies leave this phone; trips never sent to an account stay. */
export function forgetSyncedTrips() {
  write(listTrips().filter((t) => !t.synced));
}

export function subscribeTrips(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Sorted device trips; empty until hydrated so server and first client render match. */
export function useMyTrips() {
  const [trips, setTrips] = useState<MyTrip[] | null>(null);
  useEffect(() => {
    const update = () => setTrips(sortTrips(listTrips()));
    update();
    return subscribeTrips(update);
  }, []);
  return trips;
}
