import { ArrowUpRight, Car, Landmark, Sparkles, UtensilsCrossed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ArrivalSection } from "./ArrivalActionSheet";

const OPTIONS = [
  { section: "food", icon: UtensilsCrossed, tone: "food", label: "sheet.food", hint: "sheet.foodHint" },
  { section: "ride", icon: Car, tone: "ride", label: "sheet.ride", hint: "sheet.rideHint" },
  { section: "visit", icon: Landmark, tone: "visit", label: "sheet.visit", hint: "sheet.visitHint" },
  { section: "ask", icon: Sparkles, tone: "ask", label: "sheet.ask", hint: "sheet.askHint" },
] as const;

export function ArrivalOptions({ city, onPick, disabled = false, compact = false }: {
  city: string;
  onPick: (section: ArrivalSection) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`arrival-options ${compact ? "arrival-options-compact" : ""}`}>
      {OPTIONS.map(({ section, icon: Icon, tone, label, hint }, index) => (
        <Button key={section} variant="outline" disabled={disabled} onClick={() => onPick(section)}
          className={`arrival-option option-${tone}`}>
          <div className="flex w-full items-center justify-between">
            <span className="option-icon"><Icon /></span>
            <ArrowUpRight className="option-arrow" />
          </div>
          <div className="option-copy w-full min-w-0">
            <span className="block text-base font-semibold">{t(label)}</span>
            <span className="mt-1 block text-sm font-normal text-muted-foreground">{t(hint, { city: city || t("sheet.yourDestination") })}</span>
          </div>
          <span className="option-number" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
        </Button>
      ))}
    </div>
  );
}