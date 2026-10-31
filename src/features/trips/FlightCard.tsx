import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import tzLookup from "tz-lookup";
import { BellRing, CalendarPlus, DoorOpen, Luggage, PlaneTakeoff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAirportByIata } from "@/features/arrival/services";
import {
  flightNumber,
  isLiveWindow,
  remindersIcs,
  type FlightLookup,
  type FlightStatus,
} from "./flight";
import { getFlightStatus } from "./flight-status.functions";
import {
  loadSettings,
  notificationsSupported,
  saveSettings,
  showNotification,
  tripReminders,
  type FlightSettings,
} from "./reminders";
import type { MyTrip } from "./model";

const REFRESH_MS = 5 * 60_000;

/** Flight number, live status on the flight day, and check-in / leave-for-the-airport reminders. */
export function FlightCard({ trip }: { trip: MyTrip }) {
  const { t, i18n } = useTranslation();
  const lookup = useServerFn(getFlightStatus);
  const [s, setS] = useState<FlightSettings>(() => ({ ...loadSettings(trip.id), flight: "" }));
  const [status, setStatus] = useState<FlightLookup | "loading" | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const live = isLiveWindow(trip.input.date);

  // Read the phone's copy after hydration; fill the flight number from the ticket and the time zone from the airport.
  useEffect(() => {
    const saved = loadSettings(trip.id);
    setS({
      ...saved,
      flight: saved.flight || trip.input.flight || flightNumber(trip.airline || trip.input.airline) || "",
      time: saved.time || trip.input.time || "",
    });
    setPermission(notificationsSupported() ? Notification.permission : "unsupported");
    if (saved.tz) return;
    void getAirportByIata(trip.input.origin.iata).then((a) => {
      if (!a) return;
      try {
        update({ tz: tzLookup(a.lat, a.lon) });
      } catch {
        /* no time zone: reminders stay off */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  function update(patch: Partial<FlightSettings>) {
    setS((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(trip.id, next);
      return next;
    });
  }

  const refresh = () => {
    if (!live || !/^[A-Z0-9]{2}\d{1,4}$/.test(s.flight)) return;
    setStatus("loading");
    lookup({ data: { flight: s.flight, date: trip.input.date } })
      .then((r) => {
        setStatus(r);
        // The schedule fills an empty departure time, which turns the reminders on.
        const scheduled = r.kind === "found" ? r.status.departure.scheduled : null;
        if (scheduled && !loadSettings(trip.id).time) update({ time: scheduled });
      })
      .catch(() => setStatus({ kind: "error" }));
  };
  useEffect(() => {
    refresh();
    if (!live) return;
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.flight, live, trip.input.date]);

  const list = tripReminders(trip, s);
  const time = (d: Date) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  const clock = (d: Date) =>
    new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(d);

  async function enable() {
    if (permission === "unsupported") return;
    const result = permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;
    update({ notify: true });
    void showNotification(
      t("flight.notify.testTitle"),
      t("flight.notify.testBody"),
      `/trips/${trip.id}?tab=before`,
    );
  }

  function downloadCalendar() {
    const ics = remindersIcs(
      trip.id,
      list.map((r) => ({
        at: r.at,
        title: t(`flight.notify.${r.kind}.title`, { city: trip.input.destination.city }),
        body: t(`flight.notify.${r.kind}.body`, {
          time: r.leaveAt ? clock(r.leaveAt) : "",
          flight: s.flight || trip.airline,
        }),
      })),
    );
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `flywell-${trip.id}.ics`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section
      aria-labelledby="flight-card-title"
      className="mb-8 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 id="flight-card-title" className="flex items-center gap-2 text-lg font-semibold">
        <PlaneTakeoff className="size-5 text-primary" />
        {t("flight.title")}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="flight-number">{t("flight.number")}</Label>
          <Input
            id="flight-number"
            className="h-11 uppercase"
            value={s.flight}
            maxLength={8}
            autoComplete="off"
            onChange={(e) =>
              update({ flight: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="flight-time">{t("flight.time", { iata: trip.input.origin.iata })}</Label>
          <Input
            id="flight-time"
            type="time"
            className="h-11"
            value={s.time}
            onChange={(e) => update({ time: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {!live ? (
          <p className="text-sm text-muted-foreground">{t("flight.liveLater")}</p>
        ) : !s.flight ? (
          <p className="text-sm text-muted-foreground">{t("flight.needNumber")}</p>
        ) : status === "loading" || status === null ? (
          <p className="text-sm text-muted-foreground">{t("flight.loading")}</p>
        ) : status.kind === "found" ? (
          <LiveStatus status={status.status} onRefresh={refresh} />
        ) : (
          <p className="text-sm text-muted-foreground">{t(`flight.lookup.${status.kind}`)}</p>
        )}
      </div>

      <div className="mt-5 border-t pt-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <BellRing className="size-4 text-primary" />
          {t("flight.remindersTitle")}
        </h3>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("flight.needTime")}</p>
        ) : (
          <>
            <ul className="mt-3 grid gap-2 text-sm">
              {list.map((r) => (
                <li key={r.kind} className="rounded-lg bg-muted/60 p-3">
                  <p className="font-medium">{time(r.at)}</p>
                  <p className="text-muted-foreground">
                    {t(`flight.reminder.${r.kind}`, { time: r.leaveAt ? clock(r.leaveAt) : "" })}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-1.5">
              <Label htmlFor="flight-travel">{t("flight.travel")}</Label>
              <Input
                id="flight-travel"
                type="number"
                inputMode="numeric"
                min={5}
                max={300}
                step={5}
                className="h-11 w-28"
                value={s.travelMin}
                onChange={(e) =>
                  update({ travelMin: Math.min(300, Math.max(5, Number(e.target.value) || 45)) })
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {permission !== "unsupported" && (
                <Button
                  className="min-h-11"
                  variant={s.notify && permission === "granted" ? "secondary" : "default"}
                  disabled={permission === "denied"}
                  onClick={() =>
                    s.notify && permission === "granted" ? update({ notify: false }) : void enable()
                  }
                >
                  <BellRing className="size-4" />
                  {s.notify && permission === "granted"
                    ? t("flight.notifyOn")
                    : t("flight.notifyEnable")}
                </Button>
              )}
              <Button variant="outline" className="min-h-11" onClick={downloadCalendar}>
                <CalendarPlus className="size-4" />
                {t("flight.calendar")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {permission === "denied"
                ? t("flight.notifyDenied")
                : permission === "unsupported"
                  ? t("flight.notifyUnsupported")
                  : t("flight.notifyHint")}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function LiveStatus({ status, onRefresh }: { status: FlightStatus; onRefresh: () => void }) {
  const { t } = useTranslation();
  const { departure: dep, arrival: arr } = status;
  const bad =
    status.state === "cancelled" || status.state === "diverted" || status.state === "incident";
  const delay = Math.max(dep.delayMin, 0);
  const rows = [
    {
      icon: DoorOpen,
      label: t("flight.gate"),
      value: [
        dep.terminal && t("flight.terminal", { terminal: dep.terminal }),
        dep.gate ? t("flight.gateValue", { gate: dep.gate }) : t("flight.gateUnknown"),
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      icon: PlaneTakeoff,
      label: t("flight.departs"),
      value:
        dep.estimated && dep.estimated !== dep.scheduled
          ? t("flight.changed", { from: dep.scheduled ?? "", to: dep.estimated })
          : (dep.scheduled ?? "—"),
    },
    ...(arr.baggage
      ? [{ icon: Luggage, label: t("flight.baggage", { iata: arr.iata }), value: arr.baggage }]
      : []),
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={bad ? "destructive" : delay >= 15 ? "outline" : "secondary"}
          className="text-sm"
        >
          {t(`flight.state.${status.state}`)}
        </Badge>
        {delay >= 15 && !bad && (
          <span className="text-sm font-medium text-destructive">
            {t("flight.delay", { count: delay })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-11"
          aria-label={t("flight.refresh")}
          onClick={onRefresh}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <dl className="mt-3 grid gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3">
            <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <dt className="text-sm font-semibold">{r.label}</dt>
              <dd className="text-sm text-muted-foreground">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t("flight.source")}</p>
    </div>
  );
}
