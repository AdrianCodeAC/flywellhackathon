import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const loadTripConversation=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data,error}=await context.supabase.from("trip_conversations").select("messages,trip_input").eq("user_id",context.userId).maybeSingle();
  if(error)throw new Error("Conversation could not be loaded");
  return data;
});