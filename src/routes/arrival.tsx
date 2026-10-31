import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppHeader } from "@/features/arrival/AppHeader";
import { ArrivalAssistant } from "@/features/arrival/ArrivalAssistant";

const searchSchema = z.object({
  iata: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/arrival")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Arrival Assistant — Just landed? Start here" },
      { name: "description", content: "Pick the airport you landed at and find food, rides and sights nearby." },
      { property: "og:title", content: "Arrival Assistant" },
      { property: "og:description", content: "Just landed? Find food, rides and sights near your airport." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArrivalPage,
});

function ArrivalPage() {
  const { iata } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <AppHeader />
      <ArrivalAssistant iata={iata} onIataChange={(code) => void navigate({ search: { iata: code }, replace: true })} />
    </>
  );
}
