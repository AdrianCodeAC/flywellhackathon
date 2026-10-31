import { SIX_HOURS } from "./types";
export async function readTripCache<T>(key: string): Promise<T | undefined> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {data,error} = await supabaseAdmin.from("trip_search_cache").select("value,created_at").eq("cache_key",key).maybeSingle();
  if(error || !data || Date.now()-Date.parse(data.created_at)>=SIX_HOURS) return;
  return data.value as T;
}
export async function writeTripCache(key: string,value: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {error} = await supabaseAdmin.from("trip_search_cache").upsert({cache_key:key,value:JSON.parse(JSON.stringify(value)),created_at:new Date().toISOString()});
  if(error) console.warn("Trip cache write failed",error.code);
}