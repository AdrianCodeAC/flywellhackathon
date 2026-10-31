import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Cloud, Plane, Smartphone, Ticket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripUser } from "@/features/trip/auth";
import { deleteTripEverywhere } from "@/features/account/sync";
import { isPast, type MyTrip } from "./model";
import { useMyTrips } from "./store";

export function TripsList() {
  const { t, i18n } = useTranslation();
  const trips = useMyTrips();
  const user = useTripUser();
  const today = new Date().toISOString().slice(0, 10);
  const date = (v: string) => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${v}T12:00:00`));
  const status = (trip: MyTrip) => (trip.input.date === today ? "today" : isPast(trip) ? "past" : trip.input.date < today ? "away" : "upcoming");

  async function remove(trip: MyTrip) {
    const title = `${trip.input.origin.city} → ${trip.input.destination.city}`;
    if (!window.confirm(t("trips.deleteConfirm", { title }))) return;
    await deleteTripEverywhere(trip, Boolean(user));
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/" onClick={() => localStorage.setItem("flywell:tab", "plan")} className="trip-start">
          <span className="trip-start-icon"><Plane className="size-5 -rotate-12" /></span>
          <span><span className="block font-semibold">{t("trip.planTab")}</span><span className="block text-sm text-muted-foreground">{t("trips.planHint")}</span></span>
        </Link>
        <Link to="/preflight" search={{ from: "", to: "", date: "", edit: "" }} onClick={() => localStorage.setItem("flywell:tab", "preflight")} className="trip-start trip-start-warm">
          <span className="trip-start-icon"><Ticket className="size-5" /></span>
          <span><span className="block font-semibold">{t("trip.arrivalTab")}</span><span className="block text-sm text-muted-foreground">{t("trips.ticketHint")}</span></span>
        </Link>
      </div>

      {!user && (
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-secondary p-4 text-sm">
          <Cloud className="size-4 text-primary" />
          <span className="flex-1">{t("trips.signInSync")}</span>
          <Link to="/auth" search={{ redirect: "/trips" }} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">{t("trips.signIn")}</Link>
        </p>
      )}

      <div className="mt-7 grid gap-3">
        {trips === null ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : trips.length ? (
          trips.map((trip) => {
            const s = status(trip);
            return (
              <article key={trip.id} className={`trip-card ${s === "past" ? "opacity-70" : ""}`}>
                <Link to="/trips/$tripId" params={{ tripId: trip.id }} search={{ tab: "" }} className="flex min-w-0 flex-1 items-center gap-4 p-4">
                  <span className="trip-card-code">{trip.input.destination.iata}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`trip-status trip-status-${s}`}>{t(`trips.status.${s}`)}</span>
                    <span className="mt-1 block break-words text-lg font-semibold">{trip.input.origin.city} → {trip.input.destination.city}</span>
                    <span className="block text-sm text-muted-foreground">{date(trip.input.date)}{trip.returnDate ? ` – ${date(trip.returnDate)}` : ""}{trip.airline ? ` · ${trip.airline}` : ""}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{trip.synced ? <Cloud className="size-3" /> : <Smartphone className="size-3" />}{t(trip.synced ? "trips.synced" : "trips.deviceOnly")}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
                <Button variant="ghost" size="icon" className="m-2 size-11 shrink-0" aria-label={`${t("trips.delete")}: ${trip.input.destination.city}`} onClick={() => void remove(trip)}><Trash2 className="size-4" /></Button>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("trips.empty")}</p>
        )}
      </div>
    </div>
  );
}
