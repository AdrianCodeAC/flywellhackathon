import { createFileRoute } from "@tanstack/react-router";
import { TripPlanner } from "@/features/trip/TripPlanner";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { runTrip?: boolean; fresh?: boolean } => ({
    ...(search["runTrip"] === true ? { runTrip: true } : {}),
    ...(search["fresh"] === true ? { fresh: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Flywell — Plan a trip" },
      {
        name: "description",
        content: "Search flights, places to stay and your trip budget with Flywell.",
      },
    ],
  }),
  component: Search,
});

function Search() {
  const { runTrip = false, fresh = false } = Route.useSearch();
  return <TripPlanner runTrip={runTrip} fresh={fresh} />;
}
