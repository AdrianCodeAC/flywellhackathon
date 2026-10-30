import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Car, Landmark, MessageCircle, UtensilsCrossed } from "lucide-react";
import type { ComponentType } from "react";

interface ArrivalActionSheetProps {
  open: boolean;
  city: string;
  onOpenChange: (open: boolean) => void;
  onPick: (section: "food") => void;
}

const CARDS: { icon: ComponentType<{ className?: string }>; label: string; hint: string; section?: "food" }[] = [
  { icon: UtensilsCrossed, label: "Hungry?", hint: "Food nearby", section: "food" },
  { icon: Car, label: "Need a ride?", hint: "Taxi, bus, app" },
  { icon: Landmark, label: "What to visit?", hint: "Sights & museums" },
];

function Soon() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Coming soon
    </span>
  );
}

/** Bottom sheet on mobile, centered modal on desktop. */
export function ArrivalActionSheet({ open, city, onOpenChange, onPick }: ArrivalActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "inset-x-0 bottom-0 left-0 top-auto max-h-[88vh] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-2xl border-b-0 p-4 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6"
        }
      >
        {/* pr-10 keeps the title clear of the close button. */}
        <DialogHeader className="gap-1 pr-10">
          <DialogTitle>Welcome to {city}! What do you need?</DialogTitle>
          <DialogDescription>Pick one and we'll take it from there.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2.5">
          {CARDS.map(({ icon: Icon, label, hint, section }) => (
            <button
              key={label}
              type="button"
              disabled={!section}
              onClick={() => section && onPick(section)}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-90"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              {!section && <Soon />}
            </button>
          ))}

          <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">Ask anything</span>
                <span className="block text-sm text-muted-foreground">
                  Ask about {city || "your destination"}
                </span>
              </span>
              <Soon />
            </span>
            <input
              type="text"
              disabled
              placeholder={`Ask anything about ${city || "your destination"}…`}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
