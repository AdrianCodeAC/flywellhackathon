import { useState } from "react";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { AppHeader } from "@/features/arrival/AppHeader";
import { PreflightForm } from "@/features/preflight/PreflightForm";
import { PreflightChecklist } from "@/features/preflight/PreflightChecklist";
import { PreflightChat } from "@/features/preflight/PreflightChat";
import type { PreflightInput } from "@/features/preflight/rules";

const searchSchema = z.object({
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  date: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/preflight")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Flywell — Before you fly" },
      {
        name: "description",
        content:
          "Documents, security rules, baggage and passenger rights checklist for your flight.",
      },
      { property: "og:title", content: "Flywell — Before you fly" },
      {
        property: "og:description",
        content: "A pre-flight checklist and agent based on official regulations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreflightPage,
});

function PreflightPage() {
  const { from, to, date } = Route.useSearch();
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const [trip, setTrip] = useState<PreflightInput | null>(null);
  const [editing, setEditing] = useState<PreflightInput | null>(null);

  return (
    <>
      <AppHeader />
      <main className="arrival-main mx-auto w-full max-w-3xl px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-12">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
          <ShieldCheck className="size-4" />
          {t("preflight.eyebrow")}
        </p>
        <h1 className="font-display text-5xl font-normal leading-[1.05] sm:text-6xl">
          {t("preflight.title")}
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          {t("preflight.subtitle")}
        </p>
        <div className="mt-8">
          {hydrated &&
            (trip ? (
              <PreflightChecklist
                input={trip}
                onEdit={() => {
                  setEditing(trip);
                  setTrip(null);
                }}
              />
            ) : (
              <PreflightForm
                initial={editing}
                prefill={{ from, to, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined }}
                onSubmit={(v) => {
                  setTrip(v);
                  requestAnimationFrame(() => window.scrollTo({ top: 0 }));
                }}
              />
            ))}
        </div>
        {hydrated && <PreflightChat input={trip} />}
      </main>
    </>
  );
}
