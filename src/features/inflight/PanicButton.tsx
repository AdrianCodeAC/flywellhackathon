import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";

const loadHelp = () => import("./HelpScreen");
const HelpScreen = lazy(loadHelp);

/** Always-visible help button in the header; the help screen works in airplane mode. */
export function PanicButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Fetch the help screen early so it is cached before the phone goes offline.
  useEffect(() => {
    const id = setTimeout(() => void loadHelp().catch(() => {}), 1500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="panic-button relative min-h-11 rounded-full px-3.5 text-sm font-semibold"
        aria-haspopup="dialog"
      >
        <span className="panic-ring" aria-hidden />
        <HeartPulse className="size-4" />
        {t("help.button")}
      </Button>
      {open && (
        <Suspense fallback={null}>
          <HelpScreen open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
