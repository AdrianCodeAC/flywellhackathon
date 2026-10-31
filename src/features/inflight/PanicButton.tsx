import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";

const HelpScreen = lazy(() => import("./HelpScreen"));

/** Always-visible help button in the header; the help screen works in airplane mode. */
export function PanicButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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
