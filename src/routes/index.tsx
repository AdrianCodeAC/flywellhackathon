import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TripLanding } from "@/features/trip/TripLanding";
import { rememberedTab } from "@/features/trip/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flywell — Plan a trip" },
      {
        name: "description",
        content: "Plan flights, places to stay and your trip budget with Flywell.",
      },
      { property: "og:title", content: "Flywell — Plan a trip" },
      {
        property: "og:description",
        content: "Flights, accommodation estimates and practical travel advice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    const tab = rememberedTab(localStorage.getItem("flywell:tab"));
    if (tab === "trips") void navigate({ to: "/trips", replace: true });
    else if (tab === "preflight")
      void navigate({
        to: "/preflight",
        search: { from: "", to: "", date: "", edit: "" },
        replace: true,
      });
  }, [navigate]);
  return <TripLanding />;
}
