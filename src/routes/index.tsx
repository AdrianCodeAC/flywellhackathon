import { createFileRoute, redirect } from "@tanstack/react-router";

// The Arrival Assistant owns its own route (see docs/arrival-assistant-spec.md),
// so the app opens directly on it instead of the blank template placeholder.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arrival Assistant — Airport travel companion" },
      {
        name: "description",
        content:
          "Pick the airport you landed at and find food, rides and sights nearby.",
      },
      { property: "og:title", content: "Arrival Assistant — Airport travel companion" },
      { property: "og:description", content: "Food, rides, sights and practical advice after landing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/arrival", search: { iata: "" } });
  },
});
