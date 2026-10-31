import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/trip")({server:{handlers:{POST:async({request})=>{
  const {handleTrip}=await import("@/features/trip/services.server");
  return handleTrip(request);
}}}});