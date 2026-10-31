import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CARD_EVENT, loadCard, saveCard, type MedicalCard } from "@/features/inflight/medical-card";
import { saveMedicalCard } from "./sync";

type Field = Exclude<keyof MedicalCard, "seat">;
const FIELDS: { key: Field; multiline?: boolean; type?: string }[] = [
  { key: "name" },
  { key: "conditions", multiline: true },
  { key: "allergies", multiline: true },
  { key: "medication", multiline: true },
  { key: "bloodType" },
  { key: "contactName" },
  { key: "contactPhone", type: "tel" },
];

/** The only place the medical card is edited. Saved to the account and kept on the phone for airplane mode. */
export function MedicalCardEditor({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [card, setCard] = useState<MedicalCard | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setCard(loadCard());
    if (window.location.hash === "#medical-card") requestAnimationFrame(() => document.getElementById("medical-card")?.scrollIntoView({ block: "start" }));
    // The account copy may arrive after the page opens; don't overwrite what is being typed.
    const refresh = () => { if (!editing.current) setCard(loadCard()); };
    window.addEventListener(CARD_EVENT, refresh);
    return () => { window.removeEventListener(CARD_EVENT, refresh); clearTimeout(timer.current); };
  }, []);

  function change(key: Field, value: string) {
    if (!card) return;
    editing.current = true;
    const next = { ...card, [key]: value.slice(0, 300) };
    setCard(next);
    saveCard(next);
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveMedicalCard(userId, next)
        .then(() => setState("saved"))
        .catch(() => setState("error"))
        .finally(() => { editing.current = false; });
    }, 700);
  }

  return (
    <section id="medical-card" aria-labelledby="medical-title" className="mt-9 scroll-mt-28 rounded-2xl border bg-card p-5">
      <h2 id="medical-title" className="flex items-center gap-2 font-display text-3xl"><IdCard className="size-6 text-primary" />{t("help.card.title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("account.medicalPrivacy")}</p>
      {card && (
        <div className="mt-5 grid gap-4">
          {FIELDS.map(({ key, multiline, type }) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={`account-card-${key}`}>{t(`help.card.${key}`)}</Label>
              {multiline ? (
                <Textarea id={`account-card-${key}`} value={card[key]} className="min-h-20 text-base" placeholder={t(`help.card.placeholder.${key}`)} onChange={(e) => change(key, e.target.value)} />
              ) : (
                <Input id={`account-card-${key}`} type={type ?? "text"} value={card[key]} className="h-11 text-base" maxLength={120} placeholder={t(`help.card.placeholder.${key}`)} onChange={(e) => change(key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground" role="status" aria-live="polite">
        {state === "saving" ? t("account.medicalSaving") : state === "saved" ? t("account.medicalSaved") : state === "error" ? t("account.medicalError") : t("help.card.autosave")}
      </p>
    </section>
  );
}
