import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plane, WifiOff } from "lucide-react";
import { LANGUAGES, setLanguage, syncClientLanguage, type Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "@tanstack/react-router";
import { AccountButton } from "@/features/account/AccountButton";
import { useFlightReminders } from "@/features/trips/reminders";

/** Sticky header: always-visible EN/RO switcher plus the offline banner. */
export function AppHeader() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);
  const location = useLocation();
  const trips = location.pathname.startsWith("/trips");
  const ticket = location.pathname === "/preflight";
  const plan = location.pathname === "/" || location.pathname === "/flights";
  useFlightReminders();

  useEffect(() => { if (trips || ticket) localStorage.setItem("flywell:tab", trips ? "trips" : "preflight"); }, [trips, ticket]);

  // Apply the saved / phone language only after hydration so server and client HTML match.
  useEffect(() => {
    syncClientLanguage();
  }, []);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link to="/" onClick={() => localStorage.setItem("flywell:tab", "plan")} className="flex min-h-11 items-center gap-2.5" aria-label={t("design.brand")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plane className="h-5 w-5 -rotate-12" /></span>
          <span className="hidden text-xl font-bold min-[400px]:inline">{t("design.brand")}<span className="text-primary">.</span></span>
        </Link>
        <span className="hidden text-xs font-medium uppercase text-muted-foreground sm:block">{t("design.companion")}</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <AccountButton />
          <LanguageSwitcher />
        </div>
      </div>
      <nav aria-label={t("trip.navigation")} className="mx-auto flex max-w-6xl gap-1 px-3 pb-2 sm:px-8">
        <Button asChild variant={plan ? "secondary" : "ghost"} className="min-h-11 flex-1 whitespace-normal px-2 text-sm sm:flex-none sm:px-3"><Link to="/" aria-current={plan ? "page" : undefined} onClick={() => localStorage.setItem("flywell:tab", "plan")}>{t("trip.planTab")}</Link></Button>
        <Button asChild variant={trips ? "secondary" : "ghost"} className="min-h-11 flex-1 whitespace-normal px-2 text-sm sm:flex-none sm:px-3"><Link to="/trips" aria-current={trips ? "page" : undefined} onClick={() => localStorage.setItem("flywell:tab", "trips")}>{t("trips.title")}</Link></Button>
        <Button asChild variant={ticket ? "secondary" : "ghost"} className="min-h-11 flex-1 whitespace-normal px-2 text-sm sm:flex-none sm:px-3"><Link to="/preflight" search={{from:"",to:"",date:"",edit:""}} aria-current={ticket ? "page" : undefined} onClick={() => localStorage.setItem("flywell:tab", "preflight")}>{t("trip.arrivalTab")}</Link></Button>
      </nav>
      {offline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          {t("app.offline")}
        </div>
      )}
    </header>
  );
}

/** EN / RO toggle. Used in the header and on the full-screen map so it is always reachable. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current: Language = i18n.language === "ro" ? "ro" : "en";
  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className="inline-flex shrink-0 rounded-full bg-muted p-0.5"
    >
      {LANGUAGES.map((l) => (
        <Button
          variant="ghost"
          key={l}
          type="button"
          lang={l}
          aria-pressed={current === l}
          onClick={() => setLanguage(l)}
          className={`min-h-11 min-w-11 rounded-full px-2.5 text-xs font-semibold uppercase ${
            current === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {l}
        </Button>
      ))}
    </div>
  );
}
