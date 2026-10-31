import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { checklistStorageKey, preflightInputSchema } from "@/features/preflight/rules";
import { accountCard, hasMedicalInfo, loadCard, mergeAccountCard, saveCard, type MedicalCard } from "@/features/inflight/medical-card";
import { makeTrip, tripIdFor, type MyTrip } from "@/features/trips/model";
import { getTrip, listTrips, markSynced, removeTrip, upsertTrip } from "@/features/trips/store";
import { deleteSaved, findSaved, listSaved, saveItem } from "./saved";
import { loadAdvice, parseStoredAdvice, storeAdvice } from "@/features/preflight/advice-store";

function storedTicks(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Account trips (saved "preflight" items) come down to the phone so they open offline. */
export async function pullTrips() {
  const rows = await listSaved();
  for (const row of rows) {
    if (row.kind !== "preflight") continue;
    const data = (row.data ?? {}) as { input?: unknown; returnDate?: unknown; airline?: unknown; ticks?: unknown; aiAdvice?: unknown };
    const parsed = preflightInputSchema.safeParse(data.input);
    if (!parsed.success) continue;
    if (data.aiAdvice) storeAdvice(checklistStorageKey(parsed.data), parseStoredAdvice(data.aiAdvice));
    const id = tripIdFor(parsed.data);
    const local = getTrip(id);
    if (local) {
      if (!local.synced) markSynced(id);
      continue;
    }
    const trip = makeTrip(parsed.data, {
      returnDate: typeof data.returnDate === "string" ? data.returnDate : null,
      airline: typeof data.airline === "string" ? data.airline : parsed.data.airline,
    }, new Date(row.created_at));
    upsertTrip({ ...trip, synced: true });
    if (Array.isArray(data.ticks)) {
      const key = checklistStorageKey(parsed.data);
      const ticks = [...new Set([...storedTicks(key), ...data.ticks.filter((v): v is string => typeof v === "string")])];
      try { localStorage.setItem(key, JSON.stringify(ticks)); } catch { /* storage unavailable */ }
    }
  }
}

const pushing = new Set<string>();

/** Trips added on this phone go up to the account once, then stay in step through SaveButton. */
export async function pushTrips(userId: string) {
  for (const trip of listTrips()) {
    if (trip.synced || pushing.has(trip.id)) continue;
    pushing.add(trip.id);
    try {
      const key = checklistStorageKey(trip.input);
      const found = await findSaved("preflight", key);
      if (!found) {
        await saveItem({
          userId,
          kind: "preflight",
          title: `${trip.input.origin.city} → ${trip.input.destination.city}`,
          travelDate: trip.input.date,
          data: { key, input: trip.input, ticks: storedTicks(key), total: 0, returnDate: trip.returnDate, airline: trip.airline, aiAdvice: loadAdvice(key) },
        });
      }
      markSynced(trip.id);
    } finally {
      pushing.delete(trip.id);
    }
  }
}

export async function deleteTripEverywhere(trip: MyTrip, signedIn: boolean) {
  removeTrip(trip.id);
  if (!signedIn) return;
  const found = await findSaved("preflight", checklistStorageKey(trip.input)).catch(() => null);
  if (found) await deleteSaved(found.id).catch(() => {});
}

/** Account copy → phone (keeping the phone's seat); a card made on this phone before signing in goes up. */
export async function syncMedicalCard(userId: string) {
  const { data, error } = await supabase.from("medical_cards").select("card").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const local = loadCard();
  if (data) saveCard(mergeAccountCard(local, data.card));
  else if (hasMedicalInfo(local)) await saveMedicalCard(userId, local);
}

export async function saveMedicalCard(userId: string, card: MedicalCard) {
  const { error } = await supabase
    .from("medical_cards")
    .upsert({ user_id: userId, card: accountCard(card) as unknown as Json });
  if (error) throw error;
}
