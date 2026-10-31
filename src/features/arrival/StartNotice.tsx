import { useTranslation } from "react-i18next";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StartPointState } from "./start-point";

/** Says where the distances are measured from, and offers live location. */
export function StartNotice({ state }: { state: StartPointState }) {
  const { t } = useTranslation();
  const { start, status, locate } = state;
  if (!start) return null;
  const live = start.source === "you";
  const note = live
    ? t("start.fromYou")
    : start.far
      ? t("start.far")
      : status === "denied"
        ? t("start.denied")
        : t("start.fromAirport");
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground" role="status">
      <span className="flex min-w-0 items-center gap-1.5">
        {live ? <LocateFixed className="h-4 w-4 shrink-0 text-primary" /> : <MapPin className="h-4 w-4 shrink-0" />}
        <span className="break-words">{note}</span>
      </span>
      {!live && !start.far && status !== "denied" && (
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={status === "locating"} className="min-h-11 gap-1.5">
          <LocateFixed className="h-4 w-4" />
          {status === "locating" ? t("start.locating") : t("start.useMine")}
        </Button>
      )}
    </div>
  );
}
