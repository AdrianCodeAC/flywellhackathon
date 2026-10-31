import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppHeader } from "@/features/arrival/AppHeader";
import { TripPage } from "@/features/trips/TripPage";

const searchSchema = z.object({
  tab: fallback(z.enum(["before", "during", "arrival", ""]), "").default(""),
});

export const Route = createFileRoute("/trips/$tripId")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Flywell — Your trip" },
      { name: "description", content: "Before you fly, during the flight and on arrival for this trip." },
      { property: "og:title", content: "Flywell — Your trip" },
      { property: "og:description", content: "Checklist, in-flight help and arrival guide for one flight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TripRoute,
});

function TripRoute() {
  const { tripId } = Route.useParams();
  const { tab } = Route.useSearch();
  return (
    <>
      <AppHeader />
      <main className="arrival-main mx-auto w-full max-w-3xl px-5 pt-6 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-9">
        <TripPage tripId={tripId} tab={tab} />
      </main>
    </>
  );
}
