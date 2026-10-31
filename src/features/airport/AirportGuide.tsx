import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { CheckCircle2, CloudOff, MapPinned, Navigation, PlaneLanding, PlaneTakeoff, Signpost } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PreflightInput } from "@/features/preflight/rules";
import { AirportMap, type Layer } from "./AirportMap";
import { loadLayout } from "./device-cache";
import { arrivalSteps, departureSteps, placeSteps } from "./journey";
import type { AirportLayout } from "./layout";

const LAYERS: Layer[] = ["gates", "toilets", "food", "transport", "money", "services"];
type Side = "departures" | "arrivals";

/** Step-by-step airport walk-through drawn on a virtual map of each airport. */
export function AirportGuide({ input }: { input: PreflightInput }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: 1 });
  const params = (p: Record<string, string | number> | undefined) =>
    Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, typeof v === "number" ? number.format(v) : v]));
  const [side, setSide] = useState<Side>("departures");
  const [layouts, setLayouts] = useState<Record<string, AirportLayout | null | undefined>>({});
  const [active, setActive] = useState(0);
  const [layers, setLayers] = useState<Set<Layer>>(new Set<Layer>(["gates", "toilets", "transport"]));
  const gateKey = `flywell:gate:${input.origin.iata}-${input.destination.iata}-${input.date}`;
  const [gate, setGate] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setGate(localStorage.getItem(gateKey) ?? "");
  }, [gateKey]);

  // Load both airports now so the arrival map is saved before the phone goes into airplane mode.
  useEffect(() => {
    let alive = true;
    setOffline(!navigator.onLine);
    for (const iata of [input.origin.iata, input.destination.iata]) {
      void loadLayout(iata).then((layout) => alive && setLayouts((m) => ({ ...m, [iata]: layout ?? null })));
    }
    return () => {
      alive = false;
    };
  }, [input.origin.iata, input.destination.iata]);

  const airport = side === "departures" ? input.origin : input.destination;
  const layout = layouts[airport.iata];
  const steps = useMemo(
    () => placeSteps(side === "departures" ? departureSteps(input) : arrivalSteps(input), layout ?? undefined, side, gate),
    [side, input, layout, gate],
  );
  useEffect(() => setActive(0), [side]);

  const saveGate = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    setGate(clean);
    try {
      localStorage.setItem(gateKey, clean);
    } catch {
      /* storage unavailable */
    }
  };

  const toggleLayer = (layer: Layer) =>
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  const ready = layout !== undefined;
  const mapped = Boolean(layout && (layout.terminals.length || layout.pois.length));

  return (
    <section className="mt-12" aria-labelledby="airport-guide-title">
      <p className="section-index flex items-center gap-1.5">
        <MapPinned className="size-3.5" />
        {t("airportGuide.eyebrow")}
      </p>
      <h3 id="airport-guide-title" className="font-display text-3xl sm:text-4xl">
        {t("airportGuide.title")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("airportGuide.subtitle")}</p>

      <ToggleGroup
        type="single"
        value={side}
        onValueChange={(v) => v && setSide(v as Side)}
        className="mt-5 grid w-full grid-cols-2 gap-2"
        aria-label={t("airportGuide.whichAirport")}
      >
        <ToggleGroupItem value="departures" className="min-h-12 gap-2 whitespace-normal rounded-lg border data-[state=on]:border-primary data-[state=on]:bg-secondary">
          <PlaneTakeoff className="size-4 shrink-0" />
          <span className="text-left text-sm leading-tight">
            {t("airportGuide.departTab")} <b>{input.origin.iata}</b>
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem value="arrivals" className="min-h-12 gap-2 whitespace-normal rounded-lg border data-[state=on]:border-primary data-[state=on]:bg-secondary">
          <PlaneLanding className="size-4 shrink-0" />
          <span className="text-left text-sm leading-tight">
            {t("airportGuide.arriveTab")} <b>{input.destination.iata}</b>
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      {side === "departures" && (
        <label className="mt-4 flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
          <Signpost className="size-5 shrink-0 text-primary" />
          <span className="flex-1 font-medium leading-tight">
            {t("airportGuide.gateLabel")}
            <span className="block text-xs font-normal text-muted-foreground">{t("airportGuide.gateHint")}</span>
          </span>
          <Input
            value={gate}
            onChange={(e) => saveGate(e.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            placeholder={t("airportGuide.gatePlaceholder")}
            className="h-11 w-20 text-center text-base font-semibold"
            aria-label={t("airportGuide.gateLabel")}
          />
        </label>
      )}

      <div className="mt-4">
        {!ready ? (
          <div className="airport-map relative overflow-hidden rounded-xl border">
            <Skeleton className="absolute inset-0 rounded-none" />
            <p className="absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">
              {t("airportGuide.loading", { airport: airport.city })}
            </p>
          </div>
        ) : mapped && layout ? (
          <AirportMap key={`${side}-${airport.iata}`} layout={layout} steps={steps} active={active} onSelect={setActive} gate={side === "departures" ? gate : ""} layers={layers} />
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            {offline ? <CloudOff className="mb-2 size-5" /> : <Signpost className="mb-2 size-5" />}
            {t(offline ? "airportGuide.offlineNoMap" : "airportGuide.noMap", { airport: airport.city })}
          </div>
        )}
      </div>

      {mapped && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("airportGuide.layers")}>
          {LAYERS.map((layer) => (
            <Button
              key={layer}
              type="button"
              variant={layers.has(layer) ? "secondary" : "outline"}
              aria-pressed={layers.has(layer)}
              onClick={() => toggleLayer(layer)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-xs map-chip map-chip-${layer}`}
            >
              <span className="map-chip-dot" />
              {t(`airportGuide.layer.${layer}`)}
            </Button>
          ))}
        </div>
      )}

      <ol className="mt-5 grid gap-2.5">
        {steps.map((step, i) => (
          <motion.li
            key={`${side}-${step.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-current={active === i ? "step" : undefined}
              className={`journey-step flex w-full gap-3 rounded-lg border bg-card p-4 text-left transition-colors ${active === i ? "journey-step-active" : ""}`}
            >
              <span className="journey-number">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`airportGuide.step.${step.id}.title`, params(step.params))}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {t(`airportGuide.step.${step.id}.detail`, params(step.params))}
                </span>
                {mapped && (
                  <Badge variant={step.exact ? "secondary" : "outline"} className="mt-2 gap-1 whitespace-normal font-normal">
                    {step.exact ? <CheckCircle2 className="size-3" /> : <Navigation className="size-3" />}
                    {step.exact
                      ? step.label
                        ? t("airportGuide.exactNamed", { name: step.label })
                        : t("airportGuide.exact")
                      : t(step.id === "gate" ? "airportGuide.gateArea" : "airportGuide.approx")}
                  </Badge>
                )}
              </span>
            </button>
          </motion.li>
        ))}
      </ol>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <CloudOff className="mt-0.5 size-3.5 shrink-0" />
        {t("airportGuide.savedOffline")}
      </p>
      {side === "arrivals" && (
        <Button asChild variant="outline" className="mt-3 min-h-11 w-full whitespace-normal sm:w-auto">
          <Link to="/arrival" search={{ iata: input.destination.iata }} onClick={() => localStorage.setItem("flywell:tab", "arrival")}>
            <PlaneLanding />
            {t("airportGuide.rides", { city: input.destination.city })}
          </Link>
        </Button>
      )}
    </section>
  );
}
