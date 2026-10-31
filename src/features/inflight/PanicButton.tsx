import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { View } from "./HelpScreen";

const loadHelp = () => import("./HelpScreen");
const HelpScreen = lazy(loadHelp);
const OPEN_EVENT = "flywell:open-help";

/** Opens the help screen on a given page (e.g. from the trip's "During the flight" tab). */
export function openHelp(view: View = "home") {
  window.dispatchEvent(new CustomEvent<View>(OPEN_EVENT, { detail: view }));
}

/** Always-visible help button in the header; the help screen works in airplane mode. */
export function PanicButton({ seat = "" }: { seat?: string } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  // Fetch the help screen early so it is cached before the phone goes offline.
  useEffect(() => {
    const id = setTimeout(() => void loadHelp().catch(() => {}), 1500);
    const onOpen = (e: Event) => {
      setView((e as CustomEvent<View>).detail ?? "home");
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      clearTimeout(id);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setView("home");
          setOpen(true);
        }}
        className="panic-button relative min-h-11 rounded-full px-3.5 text-sm font-semibold"
        aria-haspopup="dialog"
      >
        <span className="panic-ring" aria-hidden />
        <HeartPulse className="size-4" />
        {t("help.button")}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <HelpScreen open={open} onOpenChange={setOpen} initialView={view} seat={seat} />
        </Suspense>
      )}
    </>
  );
}
