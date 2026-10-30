import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plane, WifiOff } from "lucide-react";
import { LANGUAGES, setLanguage, syncClientLanguage, type Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/** Sticky header: always-visible EN/RO switcher plus the offline banner. */
export function AppHeader() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

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
        <a href="/arrival" className="flex min-h-11 items-center gap-2.5" aria-label={t("app.title")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plane className="h-5 w-5 -rotate-12" /></span>
          <span className="text-xl font-bold">{t("design.brand")}<span className="text-primary">.</span></span>
        </a>
        <span className="hidden text-xs font-medium uppercase text-muted-foreground sm:block">{t("design.companion")}</span>
        <LanguageSwitcher />
      </div>
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
