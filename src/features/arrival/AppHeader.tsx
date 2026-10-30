import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import { LANGUAGES, setLanguage, syncClientLanguage, type Language } from "@/lib/i18n";

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
      <div className="mx-auto flex max-w-xl items-center justify-end px-4 py-1.5">
        <LanguageSwitcher />
      </div>
      {offline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
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
    <div role="group" aria-label={t("app.language")} className="inline-flex shrink-0 rounded-lg border p-0.5">
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={current === l}
          onClick={() => setLanguage(l)}
          className={`min-h-10 min-w-11 rounded-md px-2.5 text-sm font-semibold uppercase ${
            current === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
