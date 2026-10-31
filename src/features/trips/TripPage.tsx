import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ClipboardCheck, Plane, PlaneLanding, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTripUser } from "@/features/trip/auth";
import { PreflightChecklist } from "@/features/preflight/PreflightChecklist";
import { PreflightChat } from "@/features/preflight/PreflightChat";
import { ArrivalAssistant } from "@/features/arrival/ArrivalAssistant";
import { deleteTripEverywhere } from "@/features/account/sync";
import { DuringFlight } from "./DuringFlight";
import { defaultTab, TRIP_TABS, type MyTrip, type TripTab } from "./model";
import { useMyTrips } from "./store";

const TAB_ICONS: Record<TripTab, typeof Plane> = { before: ClipboardCheck, during: Plane, arrival: PlaneLanding };

export function TripPage({ tripId, tab }: { tripId: string; tab: TripTab | "" }) {
  const trips = useMyTrips();
  const { t } = useTranslation();
  if (trips === null) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const trip = trips.find((x) => x.id === tripId);
  if (!trip) {
    return (
      <div className="rounded-2xl border border-dashed p-6">
        <p className="font-semibold">{t("trips.notFound")}</p>
        <Button asChild variant="outline" className="mt-4 min-h-11"><Link to="/trips"><ArrowLeft />{t("trips.backToTrips")}</Link></Button>
      </div>
    );
  }
  return <TripView key={trip.id} trip={trip} trips={trips} tab={tab || defaultTab(trip)} />;
}

function TripView({ trip, trips, tab }: { trip: MyTrip; trips: MyTrip[]; tab: TripTab }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useTripUser();
  // Tabs mount on first visit and then stay mounted, so switching back keeps their state.
  const [visited, setVisited] = useState<Set<TripTab>>(() => new Set([tab]));
  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set([...v, tab]))), [tab]);

  const setTab = (next: TripTab) => {
    void navigate({ to: "/trips/$tripId", params: { tripId: trip.id }, search: { tab: next }, replace: true });
    requestAnimationFrame(() => document.getElementById("trip-tabs")?.scrollIntoView({ block: "start" }));
  };
  const date = (v: string) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${v}T12:00:00`));
  const title = `${trip.input.origin.city} → ${trip.input.destination.city}`;

  async function remove() {
    if (!window.confirm(t("trips.deleteConfirm", { title }))) return;
    await deleteTripEverywhere(trip, Boolean(user));
    void navigate({ to: "/trips" });
  }

  const panel = (id: TripTab, children: ReactNode) =>
    visited.has(id) ? (
      <div role="tabpanel" id={`trip-panel-${id}`} aria-labelledby={`trip-tab-${id}`} hidden={tab !== id} className="pt-7">
        {children}
      </div>
    ) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="-ml-3 min-h-11 text-primary"><Link to="/trips"><ArrowLeft />{t("trips.title")}</Link></Button>
        {trips.length > 1 && (
          <Select value={trip.id} onValueChange={(id) => void navigate({ to: "/trips/$tripId", params: { tripId: id }, search: { tab } })}>
            <SelectTrigger className="h-11 w-auto min-w-48 max-w-full" aria-label={t("trips.switch")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {trips.map((x) => <SelectItem key={x.id} value={x.id} className="min-h-11">{x.input.origin.iata} → {x.input.destination.city} · {x.input.date.slice(5).split("-").reverse().join(".")}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-4xl leading-tight sm:text-5xl">{trip.input.origin.city} <span className="text-primary">→</span> {trip.input.destination.city}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {trip.input.origin.iata} – {trip.input.destination.iata} · {date(trip.input.date)}
            {trip.returnDate && ` – ${date(trip.returnDate)}`}
            {trip.airline && ` · ${trip.airline}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${t("trips.delete")}: ${title}`} onClick={() => void remove()}><Trash2 className="size-4" /></Button>
      </header>

      <div id="trip-tabs" role="tablist" aria-label={t("trips.stages")} className="trip-tabs sticky top-[calc(env(safe-area-inset-top)+7.5rem)] z-30 mt-6 grid scroll-mt-32 grid-cols-3 gap-1 rounded-2xl p-1">
        {TRIP_TABS.map((id) => {
          const Icon = TAB_ICONS[id];
          return (
            <button key={id} type="button" role="tab" id={`trip-tab-${id}`} aria-selected={tab === id} aria-controls={`trip-panel-${id}`} onClick={() => setTab(id)} className="trip-tab">
              <Icon className="size-5" />
              <span>{t(`trips.tab.${id}`)}</span>
            </button>
          );
        })}
      </div>

      {panel("before", <>
        <PreflightChecklist input={trip.input} returnTo={`/trips/${trip.id}`} hideJetLag onArrival={() => setTab("arrival")}
          onEdit={() => void navigate({ to: "/preflight", search: { from: "", to: "", date: "", edit: trip.id } })} />
        <PreflightChat input={trip.input} />
      </>)}
      {panel("during", <DuringFlight trip={trip} />)}
      {panel("arrival", <ArrivalAssistant iata={trip.input.destination.iata} embedded />)}
    </div>
  );
}
