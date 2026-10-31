import { useTranslation } from "react-i18next";
import { Accessibility, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Codes airlines use to book special assistance (IATA SSR). */
const CODES = ["WCHR", "WCHS", "WCHC", "BLND", "DEAF", "DPNA"] as const;
const STEPS = ["request", "arrive", "equipment", "complain"] as const;

/** Small profile button: how to get free airport assistance under Regulation (EC) No 1107/2006. */
export function AssistanceInfo() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ro" ? "ro" : "en";
  const links = [
    {
      href: `https://europa.eu/youreurope/citizens/travel/passenger-rights/reduced-mobility/index_${lang}.htm`,
      label: t("prm.linkYourEurope"),
    },
    {
      href: `https://eur-lex.europa.eu/legal-content/${lang.toUpperCase()}/TXT/?uri=CELEX:32006R1107`,
      label: t("prm.linkRegulation"),
    },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11">
          <Accessibility className="size-4" />
          {t("prm.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Accessibility className="size-5 shrink-0 text-primary" />
            {t("prm.title")}
          </DialogTitle>
          <DialogDescription className="text-left">{t("prm.intro")}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{t(`prm.step.${step}.title`)}</p>
                <p className="text-muted-foreground">{t(`prm.step.${step}.body`)}</p>
                {step === "request" && (
                  <dl className="mt-2 grid gap-1.5 rounded-lg bg-muted/60 p-3">
                    {CODES.map((code) => (
                      <div key={code} className="flex gap-2">
                        <dt className="w-14 shrink-0 font-mono font-semibold">{code}</dt>
                        <dd className="text-muted-foreground">{t(`prm.code.${code}`)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="grid gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {l.label}
              <ExternalLink className="size-3.5" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("prm.outsideEu")}</p>
      </DialogContent>
    </Dialog>
  );
}
