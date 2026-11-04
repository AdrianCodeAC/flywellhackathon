import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/features/arrival/AppHeader";
import { loadAirports } from "@/features/arrival/services";
import type { Airport } from "@/features/arrival/types";
import { getDiscovery } from "./discovery.functions";
import { PICKED_FARE_KEY, recommendedFares, type RouteFare } from "./discovery";
import { TripJourney } from "./TripJourney";
import { TripRecommendations } from "./TripRecommendations";

/** Decorative sky: each cloud drifts on its own and moves at its own speed while scrolling. */
function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`cloud cloud-${n}`}>
          <svg viewBox="0 0 200 100">
            <path d="M48 92a30 30 0 0 1-6-59 44 44 0 0 1 84-12 36 36 0 0 1 34 71Z" />
          </svg>
        </div>
      ))}
    </div>
  );
}

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
  const page = useRef<HTMLElement>(null);

  // The clouds and the little plane read this value in CSS.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        page.current?.style.setProperty("--scroll", String(window.scrollY)),
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
      <main ref={page} className="landing">
        <div className="landing-sky pb-24 lg:pb-32">
          <Sky />
          <section className="relative z-10 mx-auto max-w-4xl px-5 pb-12 pt-12 text-center sm:px-8 sm:pt-16">
            <h1 className="poster-title text-5xl sm:text-7xl lg:text-8xl">{t("landing.title")}</h1>
            <p className="mx-auto mt-6 max-w-md leading-relaxed">{t("landing.subtitle")}</p>
            <Button asChild className="landing-cta mt-8 min-h-14 px-10 text-base font-semibold">
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
          <div className="scroll-plane" aria-hidden="true">
            <Plane className="size-6" />
          </div>
          <TripRecommendations
            fares={fares}
            loading={loading}
            origin={airports.find((a) => a.iata === origin) ?? null}
            onOriginChange={changeOrigin}
            onPick={pick}
          />
        </div>
        <TripJourney />
        <footer className="landing-end pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-20">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 sm:px-8">
            <p className="max-w-md text-xl">{t("landing.endText")}</p>
            <Button asChild className="landing-cta min-h-14 px-10 text-base font-semibold">
              <Link
                to="/search"
                search={{ fresh: true }}
                onClick={() => localStorage.setItem("flywell:tab", "plan")}
              >
                {t("design.begin")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <p aria-hidden="true" className="landing-mark">
            Flywell
          </p>
        </footer>
      </main>
    </>
  );
}
