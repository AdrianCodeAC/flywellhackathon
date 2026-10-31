import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TripPlanner } from "@/features/trip/TripPlanner";
import { rememberedTab } from "@/features/trip/types";

// The Arrival Assistant owns its own route (see docs/arrival-assistant-spec.md),
// so the app opens directly on it instead of the blank template placeholder.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flywell — Plan a trip" },
      {
        name: "description",
        content:
          "Plan flights, places to stay and your trip budget with Flywell.",
      },
      { property: "og:title", content: "Flywell — Plan a trip" },
      { property: "og:description", content: "Flights, accommodation estimates and practical travel advice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home(){
  const navigate=useNavigate();
  useEffect(()=>{if(rememberedTab(localStorage.getItem("flywell:tab"))==="arrival")void navigate({to:"/arrival",search:{iata:""},replace:true});},[navigate]);
  return <TripPlanner/>;
}
