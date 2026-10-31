import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Luggage } from "lucide-react";
import { AppHeader } from "@/features/arrival/AppHeader";
import { TripsList } from "@/features/trips/TripsList";

export const Route = createFileRoute("/trips/")({
  head: () => ({
    meta: [
      { title: "Flywell — My trips" },
      { name: "description", content: "All your flights in one place, each with before, during and after the flight help." },
      { property: "og:title", content: "Flywell — My trips" },
      { property: "og:description", content: "Your flights with a checklist, in-flight help and an arrival guide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const { t } = useTranslation();
  return (
    <>
      <AppHeader />
      <main className="arrival-main mx-auto w-full max-w-3xl px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-12">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Luggage className="size-4" />{t("trips.eyebrow")}</p>
        <h1 className="font-display text-5xl font-normal leading-[1.05] sm:text-6xl">{t("trips.title")}</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">{t("trips.subtitle")}</p>
        <div className="mt-8"><TripsList /></div>
      </main>
    </>
  );
}
