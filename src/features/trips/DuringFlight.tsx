import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { BellRing, IdCard, Pencil, Stethoscope, WifiOff, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTripUser } from "@/features/trip/auth";
import { openHelp } from "@/features/inflight/PanicButton";
import { CARD_EVENT, hasMedicalInfo, loadCard, type MedicalCard } from "@/features/inflight/medical-card";
import { JetLagCard } from "@/features/preflight/JetLagCard";
import type { MyTrip } from "./model";

const HELP = [
  { view: "breathe", icon: Wind, tone: "trip-help-calm" },
  { view: "crew", icon: BellRing, tone: "trip-help-alert" },
  { view: "unwell", icon: Stethoscope, tone: "trip-help-care" },
] as const;

/** The "During the flight" tab: nothing here needs the network. */
export function DuringFlight({ trip }: { trip: MyTrip }) {
  const { t } = useTranslation();
  const user = useTripUser();
  const [card, setCard] = useState<MedicalCard | null>(null);
  useEffect(() => {
    const refresh = () => setCard(loadCard());
    refresh();
    window.addEventListener(CARD_EVENT, refresh);
    return () => window.removeEventListener(CARD_EVENT, refresh);
  }, []);
  const tips = t("trips.during.tips", { returnObjects: true }) as string[];
  const ready = card ? hasMedicalInfo(card) : false;

  return (
    <div>
      <p className="trip-offline-chip"><WifiOff className="size-3.5" />{t("trips.during.subtitle")}</p>

      <h3 className="mt-6 text-lg font-semibold">{t("trips.during.help")}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {HELP.map(({ view, icon: Icon, tone }) => (
          <button key={view} type="button" onClick={() => openHelp(view)} className={`trip-help-tile ${tone}`}>
            <span className="trip-help-icon"><Icon className="size-5" /></span>
            <span className="min-w-0 text-left">
              <span className="block font-semibold">{t(`help.tile.${view}.title`)}</span>
              <span className="block text-sm leading-snug text-muted-foreground">{t(`help.tile.${view}.detail`)}</span>
            </span>
          </button>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><IdCard className="size-5 text-primary" />{t("help.card.title")}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ready ? t("trips.during.cardReady") : t("trips.during.cardMissing")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ready && <Button className="min-h-11" onClick={() => openHelp("card")}><IdCard />{t("trips.during.showCard")}</Button>}
          <Button asChild variant="outline" className="min-h-11">
            {user ? (
              <Link to="/account" hash="medical-card"><Pencil />{t("trips.during.editCard")}</Link>
            ) : (
              <Link to="/auth" search={{ redirect: "/account#medical-card" }}><Pencil />{t("trips.during.signInCard")}</Link>
            )}
          </Button>
        </div>
      </section>

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
