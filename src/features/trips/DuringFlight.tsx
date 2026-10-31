import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, WifiOff } from "lucide-react";
import { PanicButton } from "@/features/inflight/PanicButton";
import { JetLagCard } from "@/features/preflight/JetLagCard";
import { keepPagesOffline, type OfflineState } from "@/lib/offline-pages";
import type { MyTrip } from "./model";

/**
 * The "During the flight" tab: nothing here needs the network. The trip comes from
 * the phone, texts are bundled, and the page itself is saved for airplane mode.
 */
export function DuringFlight({ trip }: { trip: MyTrip }) {
  const { t } = useTranslation();
  const [offline, setOffline] = useState<OfflineState | null>(null);

  useEffect(() => {
    // Load the help screen now, so it opens even if the phone goes offline right after.
    void import("@/features/inflight/HelpScreen");
    void keepPagesOffline([`/trips/${trip.id}?tab=during`, "/trips"]).then(setOffline);
  }, [trip.id]);

  const tips = t("trips.during.tips", { returnObjects: true }) as string[];

  return (
    <div>
      <p className="trip-offline-chip">
        {offline === "ready" ? <CheckCircle2 className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {offline === "ready" ? t("trips.during.savedOffline") : t("trips.during.subtitle")}
      </p>

      <div className="mt-6 flex flex-col items-start gap-2">
        <PanicButton />
        <p className="text-sm text-muted-foreground">{t("trips.during.helpHint")}</p>
      </div>

      <JetLagCard input={trip.input} />

      <section className="mt-8">
        <h3 className="text-lg font-semibold">{t("trips.during.tipsTitle")}</h3>
        <ul className="mt-3 grid gap-2">
          {tips.map((tip) => (
            <li key={tip} className="flex gap-3 rounded-lg border bg-card p-4 text-sm leading-relaxed">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
