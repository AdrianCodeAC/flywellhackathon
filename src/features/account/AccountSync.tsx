import { useEffect } from "react";
import { useTripUser } from "@/features/trip/auth";
import { listTrips, subscribeTrips } from "@/features/trips/store";
import { pullTrips, pushTrips, syncMedicalCard } from "./sync";

/** Keeps the phone's trips and medical card in step with the signed-in account. Renders nothing. */
export function AccountSync() {
  const user = useTripUser();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const run = async () => {
      await pullTrips().catch(() => {});
      if (active) await pushTrips(userId).catch(() => {});
      if (active) await syncMedicalCard(userId).catch(() => {});
    };
    void run();
    const unsubscribe = subscribeTrips(() => {
      if (listTrips().some((t) => !t.synced)) void pushTrips(userId).catch(() => {});
    });
    const online = () => void run();
    window.addEventListener("online", online);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", online);
    };
  }, [userId]);
  return null;
}
