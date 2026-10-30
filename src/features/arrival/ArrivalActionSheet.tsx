import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { ArrivalOptions } from "./ArrivalOptions";

export type ArrivalSection = "food" | "ride" | "visit" | "ask";

interface ArrivalActionSheetProps {
  open: boolean;
  city: string;
  onOpenChange: (open: boolean) => void;
  onPick: (section: ArrivalSection) => void;
}

/** Bottom sheet on phones, centered modal on wider screens. */
export function ArrivalActionSheet({ open, city, onOpenChange, onPick }: ArrivalActionSheetProps) {
  const { t } = useTranslation();
  const place = city || t("sheet.yourDestination");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("sheet.close")}
        className={
          "arrival-sheet inset-x-0 bottom-0 left-0 top-auto max-h-[88dvh] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-2xl border-b-0 p-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-8"
        }
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" aria-hidden />
        {/* pr-10 keeps the title clear of the close button. */}
        <DialogHeader className="gap-1 pr-10 text-left">
          <DialogTitle className="font-display text-3xl font-normal">{t("sheet.title", { city: place })}</DialogTitle>
          <DialogDescription>{t("sheet.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="mt-6"><ArrivalOptions city={place} onPick={onPick} compact /></div>
      </DialogContent>
    </Dialog>
  );
}
