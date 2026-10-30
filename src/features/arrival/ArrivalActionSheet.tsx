import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Landmark, MessageCircle, UtensilsCrossed } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

export type ArrivalSection = "food";

interface ArrivalActionSheetProps {
  open: boolean;
  city: string;
  onOpenChange: (open: boolean) => void;
  onPick: (section: ArrivalSection) => void;
}

const CARDS: { icon: ComponentType<{ className?: string }>; label: string; hint: string; section?: ArrivalSection }[] = [
  { icon: UtensilsCrossed, label: "sheet.food", hint: "sheet.foodHint", section: "food" },
  { icon: Car, label: "sheet.ride", hint: "sheet.rideHint" },
  { icon: Landmark, label: "sheet.visit", hint: "sheet.visitHint" },
];

/** Bottom sheet on phones, centered modal on wider screens. */
export function ArrivalActionSheet({ open, city, onOpenChange, onPick }: ArrivalActionSheetProps) {
  const { t } = useTranslation();
  const place = city || t("sheet.yourDestination");
  const soon = (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {t("sheet.comingSoon")}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "inset-x-0 bottom-0 left-0 top-auto max-h-[88dvh] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-2xl border-b-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6"
        }
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" aria-hidden />
        {/* pr-10 keeps the title clear of the close button. */}
        <DialogHeader className="gap-1 pr-10 text-left">
          <DialogTitle>{t("sheet.title", { city: place })}</DialogTitle>
          <DialogDescription>{t("sheet.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2.5">
          {CARDS.map(({ icon: Icon, label, hint, section }) => (
            <button
              key={label}
              type="button"
              disabled={!section}
              onClick={() => section && onPick(section)}
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors active:bg-accent disabled:opacity-90"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{t(label)}</span>
                <span className="block text-sm text-muted-foreground">{t(hint)}</span>
              </span>
              {!section && soon}
            </button>
          ))}

          <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{t("sheet.ask")}</span>
                <span className="block text-sm text-muted-foreground">{t("sheet.askHint", { city: place })}</span>
              </span>
              {soon}
            </span>
            <input
              type="text"
              disabled
              placeholder={t("sheet.askPlaceholder", { city: place })}
              className="h-11 w-full rounded-md border bg-background px-3 text-base text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
