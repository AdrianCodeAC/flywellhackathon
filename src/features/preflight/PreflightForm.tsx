import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarDays, Luggage, Plane, PlaneLanding, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AirportSearch } from "@/features/arrival/AirportSearch";
import { getAirportByIata } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { daysUntil, type PreflightInput } from "./rules";

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
  const [flags, setFlags] = useState({
    children: initial?.children ?? false,
    medication: initial?.medication ?? false,
    pet: initial?.pet ?? false,
  });
  const [error, setError] = useState("");

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
    setError("");
    onSubmit({
      origin: short(origin),
      destination: short(destination),
      date,
      citizenship,
      bag,
      airline: airline.trim(),
      ...flags,
      lang: i18n.language === "ro" ? "ro" : "en",
    });
  };

  const label = "mb-3 flex items-center gap-2 text-sm font-semibold";
  return (
    <form onSubmit={submit} className="trip-search rounded-lg border bg-card p-5 sm:p-7">
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
