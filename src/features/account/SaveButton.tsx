import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTripUser } from "@/features/trip/auth";
import { findSaved, saveItem, savedQueryKey, type SavedKind } from "./saved";

/**
 * Saves a trip or checklist into the signed-in account and keeps it in sync afterwards
 * (e.g. newly ticked checklist items). Signed-out users go to sign-in and come back here.
 */
export function SaveButton({ kind, itemKey, title, travelDate, data, label, onSignedOut, onLoaded, returnTo }: {
  kind: SavedKind;
  itemKey: string;
  title: string;
  travelDate: string | null;
  data: Record<string, unknown>;
  label: string;
  /** Prepare whatever is needed to reopen this screen after signing in. */
  onSignedOut?: () => void;
  /** Receives the stored copy when this item is already in the account (e.g. to restore ticks on a new phone). */
  onLoaded?: (data: unknown) => void;
  returnTo: string;
}) {
  const { t } = useTranslation();
  const user = useTripUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const synced = useRef("");
  const payload = JSON.stringify({ key: itemKey, ...data });
  const latest = useRef(payload);
  latest.current = payload;
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;

  useEffect(() => {
    setSavedId(null); synced.current = "";
    if (!user) return;
    let active = true;
    void findSaved(kind, itemKey).then((found) => {
      if (!active || !found) return;
      // Don't overwrite the stored copy with this screen's state just because it was opened.
      synced.current = latest.current;
      loaded.current?.(found.data);
      setSavedId(found.id);
    }).catch(() => {});
    return () => { active = false; };
  }, [user, kind, itemKey]);

  // Keep an already-saved item up to date as the screen changes.
  useEffect(() => {
    if (!user || !savedId || synced.current === payload) return;
    const timer = setTimeout(() => {
      synced.current = payload;
      void saveItem({ id: savedId, userId: user.id, kind, title, travelDate, data: JSON.parse(payload) })
        .then(() => queryClient.invalidateQueries({ queryKey: savedQueryKey(user.id) }))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [user, savedId, payload, kind, title, travelDate, queryClient]);

  async function save() {
    if (!user) {
      onSignedOut?.();
      router.history.push(`/auth?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    setBusy(true); setError(false);
    try {
      const id = await saveItem({ userId: user.id, kind, title, travelDate, data: JSON.parse(payload) });
      synced.current = payload;
      setSavedId(id);
      void queryClient.invalidateQueries({ queryKey: savedQueryKey(user.id) });
    } catch { setError(true); } finally { setBusy(false); }
  }

  if (savedId) return <Button asChild variant="secondary" className="min-h-11"><Link to="/account"><BookmarkCheck className="size-4 text-primary" />{t("account.saved")}</Link></Button>;
  return <div className="flex flex-col items-start gap-1">
    <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void save()}><Bookmark className="size-4" />{label}</Button>
    {error && <p role="alert" className="text-xs text-destructive">{t("account.saveError")}</p>}
  </div>;
}
