import { useEffect, useState } from "react";
import { createFileRoute, useHydrated, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Ticket } from "lucide-react";
import { AppHeader } from "@/features/arrival/AppHeader";
import { PreflightForm } from "@/features/preflight/PreflightForm";
import { preflightInputSchema, type PreflightInput } from "@/features/preflight/rules";
import { OPEN_PREFLIGHT_KEY } from "@/features/account/device";
import { makeTrip, type MyTrip } from "@/features/trips/model";
import { getTrip, removeTrip, upsertTrip } from "@/features/trips/store";

const searchSchema = z.object({
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  date: fallback(z.string(), "").default(""),
  /** Id of a trip being edited. */
  edit: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/preflight")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Flywell — I already have a ticket" },
      { name: "description", content: "Scan your boarding pass or type your flight to get help before, during and after the flight." },
      { property: "og:title", content: "Flywell — I already have a ticket" },
      { property: "og:description", content: "Add your flight: checklist, in-flight help and arrival guide in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TicketPage,
});

/** "I already have a ticket": the flight details become a trip with its own three tabs. */
function TicketPage() {
  const { from, to, date, edit } = Route.useSearch();
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<MyTrip | null>(null);

  const open = (input: PreflightInput, previous: MyTrip | null) => {
    const trip = makeTrip(input, { returnDate: previous?.returnDate ?? null, airline: input.airline });
    if (previous && previous.id !== trip.id) removeTrip(previous.id);
    upsertTrip(previous && previous.id === trip.id ? { ...trip, addedAt: previous.addedAt } : trip);
    localStorage.setItem("flywell:tab", "trips");
    void navigate({ to: "/trips/$tripId", params: { tripId: trip.id }, search: { tab: "before" }, replace: Boolean(previous) });
  };

  useEffect(() => {
    if (edit) setEditing(getTrip(edit));
    // A checklist opened from the account, or saved before signing in, opens as a trip.
    const raw = sessionStorage.getItem(OPEN_PREFLIGHT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(OPEN_PREFLIGHT_KEY);
    try {
      const parsed = preflightInputSchema.safeParse(JSON.parse(raw));
      if (parsed.success) open(parsed.data, null);
    } catch {
      /* ignore malformed */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  return (
    <>
      <AppHeader />
      <main className="arrival-main mx-auto w-full max-w-3xl px-5 pt-9 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-12">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
          <Ticket className="size-4" />
          {t("ticket.eyebrow")}
        </p>
        <h1 className="font-display text-5xl font-normal leading-[1.05] sm:text-6xl">{t("ticket.title")}</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">{t("ticket.subtitle")}</p>
        <div className="mt-8">
          {hydrated && (
            <PreflightForm
              key={editing?.id ?? "new"}
              initial={editing?.input ?? null}
              prefill={{ from, to, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined }}
              onSubmit={(v) => open(v, editing)}
            />
          )}
        </div>
      </main>
    </>
  );
}
