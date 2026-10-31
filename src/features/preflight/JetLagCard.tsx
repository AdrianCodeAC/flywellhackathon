import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import tzLookup from "tz-lookup";
import { Coffee, Moon, Plane, Sun, Clock } from "lucide-react";
import { getAirportByIata } from "@/features/arrival/services";
import { jetLagPlan, type JetLagPlan } from "./jetlag";
import type { PreflightInput } from "./rules";

/** Jet-lag coach: a short, time-zone-aware plan for before, during and after the flight. */
export function JetLagCard({ input }: { input: PreflightInput }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<JetLagPlan | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getAirportByIata(input.origin.iata),
      getAirportByIata(input.destination.iata),
    ]).then(([a, b]) => {
      if (!active || !a || !b) return;
      try {
        setPlan(
          jetLagPlan(
            tzLookup(a.lat, a.lon),
            tzLookup(b.lat, b.lon),
            new Date(`${input.date}T12:00:00Z`),
          ),
        );
      } catch {
        setPlan(null);
      }
    });
    return () => {
      active = false;
    };
  }, [input.origin.iata, input.destination.iata, input.date]);

  if (!plan) return null;
  const hours = Math.round(plan.shift * 10) / 10;
  const diff = Math.round(plan.difference * 10) / 10;
  const steps =
    plan.direction === "none"
      ? [{ icon: Clock, key: "none" }]
      : [
          { icon: Moon, key: `prep_${plan.direction}` },
          { icon: Plane, key: "flight" },
          { icon: Sun, key: `light_${plan.direction}` },
          { icon: Coffee, key: "caffeine" },
        ];

  return (
    <section className="mt-8" aria-labelledby="jetlag-title">
      <h3 id="jetlag-title" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Clock className="size-5 text-primary" />
        {t("preflight.jetlag.title")}
      </h3>
      <article className="rounded-lg border bg-card p-4">
        <p className="font-semibold">
          {diff === 0
            ? t("preflight.jetlag.same")
            : t(diff > 0 ? "preflight.jetlag.ahead" : "preflight.jetlag.behind", {
                hours: Math.abs(diff),
                city: input.destination.city,
              })}
        </p>
        {plan.direction !== "none" && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("preflight.jetlag.recovery", { count: plan.recoveryDays })}
          </p>
        )}
        <ol className="mt-4 grid gap-3">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed">
                {t(`preflight.jetlag.step.${s.key}`, { count: plan.prepDays, hours })}
              </p>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}
