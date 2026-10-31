import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAirportByIata } from "@/features/arrival/services";
import type { Destination, Flight, TripInput } from "@/features/trip/types";
import { inputFromPlan, makeTrip } from "./model";
import { listTrips, upsertTrip } from "./store";

/** Turns the chosen flight into a trip with its own Before / During / On arrival tabs. */
export function AddToTrips({ input, destination, flight }: { input: TripInput; destination: Destination; flight: Flight }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function add() {
    setBusy(true);
    setError(false);
    try {
      const [from, to] = await Promise.all([getAirportByIata(input.origin), getAirportByIata(destination.iata)]);
      if (!from || !to) throw new Error("Unknown airport");
      const previous = listTrips()[0]?.input ?? null;
      const preflight = inputFromPlan({
        origin: { iata: from.iata, city: from.city, countryCode: from.countryCode },
        destination: { iata: to.iata, city: to.city, countryCode: to.countryCode },
        departure: flight.departure,
        airline: flight.airline,
        children: input.children,
        bag: input.bag,
        lang: input.lang,
        previous,
      });
      const trip = makeTrip(preflight, { returnDate: input.oneWay ? null : flight.returnDate.slice(0, 10), airline: flight.airline });
      upsertTrip(trip);
      localStorage.setItem("flywell:tab", "trips");
      void navigate({ to: "/trips/$tripId", params: { tripId: trip.id }, search: { tab: "before" } });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="mt-2 min-h-11 w-full whitespace-normal" disabled={busy} onClick={() => void add()}>
        <CalendarPlus className="size-4" />
        {busy ? t("trips.adding") : t("trips.addToTrips")}
      </Button>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{t("trips.addError")}</p>}
    </>
  );
}
