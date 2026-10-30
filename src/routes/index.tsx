import { createFileRoute, redirect } from "@tanstack/react-router";

// The Arrival Assistant owns its own route (see docs/arrival-assistant-spec.md),
// so the app opens directly on it instead of the blank template placeholder.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arrival Assistant — Just landed? Start here" },
      {
        name: "description",
        content:
          "Pick the airport you landed at and find food, rides and sights nearby.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/arrival", search: { iata: "" } });
  },
});
