import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { utcOffset } from "@/features/preflight/jetlag";
import { arrivalHours } from "@/features/preflight/rules";
import { departureInstant, reminders, type Reminder } from "./flight";
import { listTrips, subscribeTrips } from "./store";
import type { MyTrip } from "./model";

/** What the passenger told us about one flight. Kept on this phone only. */
export interface FlightSettings {
  flight: string;
  /** Departure, local time at the origin airport ("HH:MM"), or "" when unknown. */
  time: string;
  /** Minutes from home to the airport. */
  travelMin: number;
  notify: boolean;
  /** Origin time zone, filled in once the airport is known. */
  tz: string;
}

const KEY = "flywell:flight-settings";
const SHOWN_KEY = "flywell:reminders-shown";
export const SETTINGS_EVENT = "flywell:flight-settings-updated";
export const DEFAULT_SETTINGS: FlightSettings = {
  flight: "",
  time: "",
  travelMin: 45,
  notify: false,
  tz: "",
};

function readAll(): Record<string, FlightSettings> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function loadSettings(tripId: string): FlightSettings {
  return { ...DEFAULT_SETTINGS, ...readAll()[tripId] };
}

export function saveSettings(tripId: string, settings: FlightSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [tripId]: settings }));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** The reminders for a trip, or [] until the departure time and time zone are known. */
export function tripReminders(trip: MyTrip, s: FlightSettings): Reminder[] {
  if (!s.time || !s.tz) return [];
  try {
    const offset = utcOffset(s.tz, new Date(`${trip.input.date}T12:00:00Z`));
    return reminders(
      departureInstant(trip.input.date, s.time, offset),
      arrivalHours(trip.input),
      s.travelMin,
    );
  } catch {
    return [];
  }
}

function shown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function markShown(id: string) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown(), id].slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

export const notificationsSupported = () =>
  typeof window !== "undefined" && "Notification" in window;

export async function showNotification(title: string, body: string, url: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options = { body, icon: "/icons/icon-192.png", tag: url, data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, options));
  } catch {
    /* fall back to a page notification */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      window.location.assign(url);
    };
  } catch {
    /* some mobile browsers only allow service-worker notifications */
  }
}

const MAX_TIMEOUT = 2 ** 31 - 1;
const LATE_MS = 60 * 60_000;

/**
 * Fires check-in and leave-for-the-airport reminders while Flywell is open. A reminder
 * missed by under an hour shows as soon as the app opens. The calendar export covers
 * the time the app is closed.
 */
export function useFlightReminders() {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    let timers: number[] = [];
    const schedule = () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers = [];
      if (!notificationsSupported() || Notification.permission !== "granted") return;
      const all = readAll();
      const done = shown();
      for (const trip of listTrips()) {
        const s = all[trip.id];
        if (!s?.notify) continue;
        for (const r of tripReminders(trip, { ...DEFAULT_SETTINGS, ...s })) {
          const id = `${trip.id}:${r.kind}:${r.at.toISOString()}`;
          if (done.has(id)) continue;
          const wait = r.at.getTime() - Date.now();
          if (wait < -LATE_MS || wait > MAX_TIMEOUT) continue;
          const fire = () => {
            markShown(id);
            const time = r.leaveAt
              ? new Intl.DateTimeFormat(i18n.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(r.leaveAt)
              : "";
            void showNotification(
              t(`flight.notify.${r.kind}.title`, { city: trip.input.destination.city }),
              t(`flight.notify.${r.kind}.body`, { time, flight: s.flight || trip.airline }),
              `/trips/${trip.id}?tab=before`,
            );
          };
          timers.push(window.setTimeout(fire, Math.max(0, wait)));
        }
      }
    };
    schedule();
    window.addEventListener(SETTINGS_EVENT, schedule);
    const unsubscribe = subscribeTrips(schedule);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener(SETTINGS_EVENT, schedule);
      unsubscribe();
    };
  }, [t, i18n.language]);
}
