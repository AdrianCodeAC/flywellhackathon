import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/features/arrival/AppHeader";
import { loadAirports } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { getDiscovery } from "./discovery.functions";
import { PICKED_FARE_KEY, recommendedFares, type RouteFare } from "./discovery";
import { TripRecommendations } from "./TripRecommendations";

/** The home page: one message, the way into the flight search, and flights from the user's airport. */
export function TripLanding() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const load = useServerFn(getDiscovery);
  const lang = i18n.language === "ro" ? "ro" : "en";
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState("");
  const [fares, setFares] = useState<RouteFare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAirports().then(setAirports);
    let saved = "";
    try {
      saved = localStorage.getItem("flywell:origin") ?? "";
    } catch {
      /* private window: use the default airport */
    }
    setOrigin(/^[A-Z]{3}$/.test(saved) ? saved : "CRA");
  }, []);

  useEffect(() => {
    if (!origin) return;
    let active = true;
    setLoading(true);
    setFares([]);
    void load({ data: { origin, lang, includeStop: true } })
      .then((value) => {
        if (active) setFares(recommendedFares(value.fares));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origin, lang, load]);

  function changeOrigin(airport: Airport | null) {
    if (!airport) return;
    setOrigin(airport.iata);
    try {
      localStorage.setItem("flywell:origin", airport.iata);
    } catch {
      /* private window: the choice lasts for this page only */
    }
  }

  function pick(fare: RouteFare) {
    sessionStorage.setItem(PICKED_FARE_KEY, JSON.stringify(fare));
    localStorage.setItem("flywell:tab", "plan");
    void navigate({ to: "/search", search: { fresh: true } });
  }

  return (
    <>
      <AppHeader />
      <main className="landing pb-[max(3rem,env(safe-area-inset-bottom))]">
        <section className="mx-auto max-w-4xl px-5 pb-12 pt-12 text-center sm:px-8 sm:pt-16">
          <h1 className="poster-title text-5xl sm:text-7xl lg:text-8xl">{t("landing.title")}</h1>
          <p className="mx-auto mt-6 max-w-md leading-relaxed">{t("landing.subtitle")}</p>
          <Button asChild className="mt-8 min-h-14 px-10 text-base font-semibold">
            <Link
              to="/search"
              search={{ fresh: true }}
              onClick={() => localStorage.setItem("flywell:tab", "plan")}
            >
              {t("design.begin")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
        <TripRecommendations
          fares={fares}
          loading={loading}
          origin={airports.find((a) => a.iata === origin) ?? null}
          onOriginChange={changeOrigin}
          onPick={pick}
        />
      </main>
    </>
  );
}
