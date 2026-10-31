import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  CloudSun,
  ExternalLink,
  FileText,
  Gavel,
  Luggage,
  PlaneLanding,
  ShieldCheck,
  Sparkles,
  Timer,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { preflightAdvice, type PreflightAdvice } from "./ai.functions";
import { AirlineBaggage } from "./AirlineBaggage";
import { JetLagCard } from "./JetLagCard";
import { WeatherCard } from "@/features/arrival/WeatherCard";
import { getAirportByIata } from "@/features/arrival/services";
import { FORECAST_DAYS } from "@/features/arrival/weather";
import {
  CATEGORIES,
  SOURCES,
  buildChecklist,
  checklistStorageKey,
  type Category,
  type PreflightInput,
  type Priority,
  type SourceId,
  daysUntil,
} from "./rules";

const ICONS: Record<Category, typeof FileText> = {
  documents: FileText,
  security: ShieldCheck,
  baggage: Luggage,
  timeline: Timer,
  customs: Package,
  rights: Gavel,
};

interface Row {
  id: string;
  category: Category;
  priority: Priority;
  title: string;
  detail: string;
  source?: SourceId | null | undefined;
  ai?: boolean | undefined;
}

function loadTicks(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function PreflightChecklist({
  input,
  onEdit,
}: {
  input: PreflightInput;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const storageKey = checklistStorageKey(input);
  const [ticks, setTicks] = useState<string[]>([]);
  const [advice, setAdvice] = useState<PreflightAdvice>();
  const [adviceState, setAdviceState] = useState<"loading" | "ready" | "error">("loading");

  const fixed = useMemo(() => buildChecklist(input), [input]);
  useEffect(() => setTicks(loadTicks(storageKey)), [storageKey]);

  useEffect(() => {
    let active = true;
    setAdvice(undefined);
    setAdviceState("loading");
    preflightAdvice({
      data: {
        ...input,
        lang: i18n.language === "ro" ? "ro" : "en",
        covered: fixed.map((i) => i.key),
      },
    })
      .then((value) => active && (setAdvice(value), setAdviceState("ready")))
      .catch(() => active && setAdviceState("error"));
    return () => {
      active = false;
    };
  }, [input, fixed, i18n.language]);

  const rows: Row[] = [
    ...fixed.map((i) => ({
      id: i.id,
      category: i.category,
      priority: i.priority,
      title: t(`preflight.rule.${i.key}.title`, i.params ?? {}),
      detail: t(`preflight.rule.${i.key}.detail`, i.params ?? {}),
      source: i.source,
    })),
    ...(advice?.items ?? []).map((i, n) => ({
      ...i,
      id: `ai-${n}-${i.title.slice(0, 24)}`,
      ai: true,
    })),
  ];
  const done = rows.filter((r) => ticks.includes(r.id)).length;

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...new Set([...ticks, id])] : ticks.filter((v) => v !== id);
    setTicks(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const date = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${input.date}T12:00:00`));

  return (
    <section aria-labelledby="preflight-summary">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="section-index">{t("preflight.yourFlight")}</p>
          <h2 id="preflight-summary" className="font-display text-3xl sm:text-4xl">
            {input.origin.city} → {input.destination.city}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {input.origin.iata} – {input.destination.iata} · {date}
            {input.airline && ` · ${input.airline}`}
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={onEdit}>
          {t("trip.edit")}
        </Button>
      </div>

      <div className="mt-5" aria-live="polite">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">{t("preflight.progress")}</span>
          <span>{t("preflight.done", { done, total: rows.length })}</span>
        </div>
        <Progress
          value={rows.length ? (done / rows.length) * 100 : 0}
          aria-label={t("preflight.progress")}
        />
      </div>

      {CATEGORIES.map((category) => {
        const list = rows.filter((r) => r.category === category);
        if (!list.length) return null;
        const Icon = ICONS[category];
        return (
          <section key={category} className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Icon className="size-5 text-primary" />
              {t(`preflight.category.${category}`)}
            </h3>
            {category === "baggage" && <AirlineBaggage airline={input.airline} />}
            <ul className="grid gap-3">
              {list.map((row) => (
                <ChecklistRow
                  key={row.id}
                  row={row}
                  checked={ticks.includes(row.id)}
                  onChange={(on) => toggle(row.id, on)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <JetLagCard input={input} />
      <LandingWeather input={input} />

      <div className="mt-8 rounded-lg border border-dashed p-4 text-sm" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          {t("preflight.aiTitle")}
        </p>
        {adviceState === "loading" && (
          <Shimmer className="mt-2">{t("preflight.aiLoading")}</Shimmer>
        )}
        {adviceState === "error" && (
          <p className="mt-2 text-muted-foreground">{t("preflight.aiError")}</p>
        )}
        {adviceState === "ready" && (
          <p className="mt-2 text-muted-foreground">
            {advice?.items.length
              ? t("preflight.aiAdded", { count: advice.items.length })
              : t("preflight.aiNone")}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {t("preflight.disclaimer")}
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-4 min-h-11 w-full whitespace-normal sm:w-auto"
      >
        <Link
          to="/arrival"
          search={{ iata: input.destination.iata }}
          onClick={() => localStorage.setItem("flywell:tab", "arrival")}
        >
          <PlaneLanding />
          {t("preflight.toArrival", { city: input.destination.city })}
        </Link>
      </Button>
    </section>
  );
}

function ChecklistRow({
  row,
  checked,
  onChange,
}: {
  row: Row;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = `check-${row.id}`;
  const source = row.source ? SOURCES[row.source] : undefined;
  return (
    <li
      className={`rounded-lg border bg-card p-4 transition-opacity ${checked ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5 size-5"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className={`flex flex-wrap items-center gap-2 font-semibold ${checked ? "line-through" : ""}`}
          >
            {row.title}
            {row.priority === "must" && <Badge variant="destructive">{t("preflight.must")}</Badge>}
            {row.ai && (
              <Badge variant="secondary">
                <Sparkles className="size-3" />
                AI
              </Badge>
            )}
          </label>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
          {source && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {source.name}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/** Forecast for the flight day at the destination, once it is within forecast range. */
function LandingWeather({ input }: { input: PreflightInput }) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ lat: number; lon: number }>();
  const days = daysUntil(input.date);
  useEffect(() => {
    void getAirportByIata(input.destination.iata).then(
      (a) => a && setCoords({ lat: a.lat, lon: a.lon }),
    );
  }, [input.destination.iata]);
  return (
    <section className="mt-8">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <CloudSun className="size-5 text-primary" />
        {t("weather.landingTitle")}
      </h3>
      {days >= FORECAST_DAYS ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {t("weather.tooFar", { count: days - FORECAST_DAYS + 1 })}
        </p>
      ) : (
        coords && (
          <WeatherCard
            lat={coords.lat}
            lon={coords.lon}
            city={input.destination.city}
            day={input.date}
          />
        )
      )}
    </section>
  );
}
