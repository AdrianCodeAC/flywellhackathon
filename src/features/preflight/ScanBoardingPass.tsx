import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseBoardingPass, type BoardingPass } from "./bcbp";

/** "Scan boarding pass": opens the camera on phones, a file picker on desktop. */
export function ScanBoardingPass({ onScan }: { onScan: (pass: BoardingPass) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const { decodeBarcode } = await import("./decode-barcode");
      const raw = await decodeBarcode(file);
      const pass = raw ? parseBoardingPass(raw) : null;
      if (pass) onScan(pass);
      else setMessage(t(raw ? "preflight.scan.notBoardingPass" : "preflight.scan.notFound"));
    } catch {
      setMessage(t("preflight.scan.notFound"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-dashed bg-secondary/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("preflight.scan.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("preflight.scan.hint")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ScanLine />}
          {t(busy ? "preflight.scan.reading" : "preflight.scan.button")}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={t("preflight.scan.button")}
        onChange={(e) => void read(e.target.files?.[0])}
      />
      {message && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
