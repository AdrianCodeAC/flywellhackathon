import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Armchair, ArrowRight, CalendarDays, Luggage, Plane, PlaneLanding, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { getAirportByIata } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { daysUntil, type PreflightInput } from "./rules";
import { AIRLINES } from "./airlines";
import { flightDate, type BoardingPass } from "./bcbp";
import { ScanBoardingPass } from "./ScanBoardingPass";

export interface PreflightPrefill {
  from?: string | undefined;
  to?: string | undefined;
  date?: string | undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const short = (a: Airport) => ({ iata: a.iata, city: a.city, countryCode: a.countryCode });

/** `initial` restores the previous answers when the passenger edits the trip. */
export function PreflightForm({
  prefill,
  initial,
  onSubmit,
}: {
  prefill: PreflightPrefill;
  initial?: PreflightInput | null;
  onSubmit: (input: PreflightInput) => void;
}) {
  const { t, i18n } = useTranslation();
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [date, setDate] = useState(
    () => initial?.date ?? prefill.date ?? isoDay(new Date(Date.now() + 7 * 86_400_000)),
  );
  const [citizenship, setCitizenship] = useState<PreflightInput["citizenship"]>(
    initial?.citizenship ?? "ro",
  );
  const [bag, setBag] = useState<PreflightInput["bag"]>(initial?.bag ?? "cabin");
  const [airline, setAirline] = useState(initial?.airline ?? "");
  const [seat, setSeat] = useState(initial?.seat ?? "");
  const [flight, setFlight] = useState(initial?.flight ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [flags, setFlags] = useState({
    children: initial?.children ?? false,
    medication: initial?.medication ?? false,
    pet: initial?.pet ?? false,
  });
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState("");

  // A scanned boarding pass fills airports, date and airline in one go.
  const applyPass = (pass: BoardingPass) => {
    void getAirportByIata(pass.from).then((a) => a && setOrigin(a));
    void getAirportByIata(pass.to).then((a) => a && setDestination(a));
    setDate(flightDate(pass.julianDay));
    const name = AIRLINES.find((a) => a.codes.includes(pass.carrier))?.name ?? pass.carrier;
    // Known airline: just its name ("Wizz Air"); unknown: the carrier code so rule lookups still match.
    setAirline(name);
    if (pass.seat) setSeat(pass.seat.toUpperCase());
    setFlight(`${pass.carrier}${pass.flight}`.replace(/\s/g, "").toUpperCase());
    if (pass.time) setTime(pass.time);
    setError("");
    setScanned(
      t("preflight.scan.done", {
        flight: `${pass.carrier} ${pass.flight}`,
        from: pass.from,
        to: pass.to,
        seat: pass.seat || "—",
      }),
    );
  };

  // Origin: link from the planner, then the planner's saved departure airport, then Craiova.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("flywell:origin") ?? "";
    } catch {
      /* storage unavailable */
    }
    const from = initial?.origin.iata || prefill.from || saved || "CRA";
    const to = initial?.destination.iata || prefill.to;
    void getAirportByIata(from).then((a) => a && setOrigin(a));
    if (to) void getAirportByIata(to).then((a) => a && setDestination(a));
  }, [initial, prefill.from, prefill.to]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || origin.iata === destination.iata)
      return setError(t("preflight.errorAirports"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || daysUntil(date) < 0)
      return setError(t("preflight.errorDate"));
    if (!/^\d{1,2}[A-K]$/i.test(seat.trim()))
      return setError(t("preflight.errorSeat"));
    setError("");
    onSubmit({
      origin: short(origin),
      destination: short(destination),
      date,
      citizenship,
      bag,
      airline: airline.trim(),
      seat: seat.trim().toUpperCase(),
      ...(flight ? { flight } : {}),
      ...(time ? { time } : {}),
      ...flags,
      lang: i18n.language === "ro" ? "ro" : "en",
    });
  };

  const label = "mb-3 flex items-center gap-2 text-sm font-semibold";
  return (
    <form onSubmit={submit} className="trip-search rounded-lg border bg-card p-5 sm:p-7">
      <ScanBoardingPass onScan={applyPass} />
      {scanned && (
        <p role="status" className="-mt-3 mb-6 text-sm font-medium text-primary">
          {scanned}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className={label}>
            <Plane className="size-4 text-primary" />
            {t("preflight.from")}
          </p>
          <AirportSearch
            selected={origin}
            onSelect={setOrigin}
            onClear={() => setOrigin(null)}
            label={t("preflight.from")}
          />
        </div>
        <div>
          <p className={label}>
            <PlaneLanding className="size-4 text-primary" />
            {t("preflight.to")}
          </p>
          <AirportSearch
            selected={destination}
            onSelect={setDestination}
            onClear={() => setDestination(null)}
            label={t("preflight.to")}
          />
        </div>
        <div>
          <label htmlFor="preflight-date" className={label}>
            <CalendarDays className="size-4 text-primary" />
            {t("preflight.date")}
          </label>
          <Input
            id="preflight-date"
            type="date"
            required
            min={isoDay(new Date())}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-14 text-base"
          />
        </div>
        <div>
          <label htmlFor="preflight-airline" className={label}>
            <Plane className="size-4 text-primary" />
            {t("preflight.airline")}
          </label>
          <Input
            id="preflight-airline"
            value={airline}
            maxLength={60}
            onChange={(e) => setAirline(e.target.value)}
            placeholder={t("preflight.airlinePlaceholder")}
            className="min-h-14 text-base"
          />
        </div>
        <div>
          <label htmlFor="preflight-flight" className={label}>
            <Plane className="size-4 text-primary" />
            {t("trip.flightNumber")}
          </label>
          <Input
            id="preflight-flight"
            value={flight}
            maxLength={7}
            onChange={(e) => setFlight(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            autoComplete="off"
            spellCheck={false}
            className="min-h-14 text-base uppercase"
          />
        </div>
        <div>
          <label htmlFor="preflight-time" className={label}>
            <CalendarDays className="size-4 text-primary" />
            {t("preflight.time", { iata: origin?.iata ?? "" })}
          </label>
          <Input
            id="preflight-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-14 text-base"
          />
        </div>
        <div>
          <label htmlFor="preflight-seat" className={label}>
            <Armchair className="size-4 text-primary" />
            {t("preflight.seat")} *
          </label>
          <Input
            id="preflight-seat"
            value={seat}
            required
            maxLength={3}
            onChange={(e) => setSeat(e.target.value.toUpperCase().replace(/[^0-9A-K]/g, ""))}
            placeholder={t("preflight.seatPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            className="min-h-14 text-base"
          />
        </div>
        <div>
          <p className={label}>
            <UserRound className="size-4 text-primary" />
            {t("preflight.citizenship")}
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            value={citizenship}
            onValueChange={(v) => v && setCitizenship(v as typeof citizenship)}
            className="grid w-full grid-cols-3"
            aria-label={t("preflight.citizenship")}
          >
            {(["ro", "eu", "other"] as const).map((c) => (
              <ToggleGroupItem
                key={c}
                value={c}
                className="h-auto min-h-11 whitespace-normal px-2 py-2 text-sm"
              >
                {t(`preflight.citizen.${c}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div>
          <p className={label}>
            <Luggage className="size-4 text-primary" />
            {t("preflight.bag")}
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            value={bag}
            onValueChange={(v) => v && setBag(v as typeof bag)}
            className="grid w-full grid-cols-2"
            aria-label={t("preflight.bag")}
          >
            {(["cabin", "checked"] as const).map((b) => (
              <ToggleGroupItem
                key={b}
                value={b}
                className="h-auto min-h-11 whitespace-normal px-2 py-2 text-sm"
              >
                {t(`preflight.bagType.${b}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <fieldset className="mt-6 border-t pt-5">
        <legend className="sr-only">{t("preflight.extras")}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(["children", "medication", "pet"] as const).map((f) => (
            <label key={f} className="flex min-h-11 items-center gap-3 text-sm">
              <Switch
                checked={flags[f]}
                onCheckedChange={(v) => setFlags((s) => ({ ...s, [f]: v }))}
              />
              {t(`preflight.flag.${f}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button type="submit" className="min-h-12 w-full px-7 text-base sm:w-auto">
          {t("preflight.submit")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}
