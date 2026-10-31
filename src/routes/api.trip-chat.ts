import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/trip-chat")({server:{handlers:{POST:async({request})=>{
  const {handleTripChat}=await import("@/features/trip/chat.server");return handleTripChat(request);
}}}});