import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarClock, Dog, ExternalLink, Luggage, PawPrint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { findPetPolicy, PET_POLICIES, type PetPolicy } from "./pets";

/** Pet rules of the passenger's airline, or every known airline when it is unknown. */
export function PetPolicyCard({ airline: text, to }: { airline: string; to: string }) {
  const { t } = useTranslation();
  const policy = findPetPolicy(text);

  if (!policy) {
    return (
      <article className="mb-3 rounded-lg border border-primary/40 bg-card p-4">
        <h4 className="flex items-center gap-2 font-semibold">
          <PawPrint className="size-5 text-primary" />
          {t("preflight.pets.compareTitle")}
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">{t("preflight.pets.compareHint")}</p>
        <ul className="mt-3 grid gap-1.5">
          {PET_POLICIES.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-0">
              <a href={p.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                {p.name}
              </a>
              <span className={`text-right ${p.cabin ? "text-foreground" : "text-muted-foreground"}`}>
                {summary(p, t)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t("preflight.pets.checked")}</p>
      </article>
    );
  }

  const species = policy.cabin?.species.map((s) => t(`preflight.pets.species.${s}`)).join(", ");
  const rows = [
    {
      icon: PawPrint,
      label: t("preflight.pets.cabin"),
      value: policy.cabin
        ? t(policy.cabin.size ? "preflight.pets.cabinYesSize" : "preflight.pets.cabinYes", {
            kg: policy.cabin.kg,
            size: policy.cabin.size,
            species,
          })
        : t("preflight.pets.cabinNo"),
    },
    {
      icon: Luggage,
      label: t("preflight.pets.hold"),
      value:
        policy.hold.kind === "yes"
          ? policy.hold.kg
            ? t("preflight.pets.holdKg", { kg: policy.hold.kg })
            : t("preflight.pets.holdYes")
          : policy.hold.kind === "cargo"
            ? t("preflight.pets.holdCargo")
            : t("preflight.pets.holdNo"),
    },
    { icon: Dog, label: t("preflight.pets.assistance"), value: t("preflight.pets.assistanceText") },
    ...(policy.noticeHours
      ? [
          {
            icon: CalendarClock,
            label: t("preflight.pets.booking"),
            value: t("preflight.pets.notice", { hours: policy.noticeHours }),
          },
        ]
      : []),
  ];

  return (
    <article className="mb-3 rounded-lg border border-primary/40 bg-card p-4">
      <h4 className="flex flex-wrap items-center gap-2 font-semibold">
        {t("preflight.pets.title", { airline: policy.name })}
        {policy.verify && <Badge variant="outline">{t("preflight.pets.verifyBadge")}</Badge>}
      </h4>
      {to === "GB" && (
        <p className="mt-2 flex gap-2 rounded-md bg-accent p-2 text-sm text-accent-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("preflight.pets.gbWarning")}
        </p>
      )}
      <dl className="mt-3 grid gap-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3">
            <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <dt className="text-sm font-semibold">{r.label}</dt>
              <dd className="text-sm text-muted-foreground">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {policy.notes.map((n) => (
        <p key={n} className="mt-3 text-sm text-muted-foreground">
          {t(`preflight.pets.note.${n}`)}
        </p>
      ))}
      <p className="mt-3 text-xs text-muted-foreground">
        {t(policy.verify ? "preflight.pets.verify" : "preflight.pets.checked")}
      </p>
      <a
        href={policy.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("preflight.pets.official", { airline: policy.name })}
        <ExternalLink className="size-3.5" />
      </a>
    </article>
  );
}

function summary(p: PetPolicy, t: (k: string, o?: Record<string, unknown>) => string) {
  if (p.cabin) return t("preflight.pets.shortCabin", { kg: p.cabin.kg });
  if (p.hold.kind === "cargo") return t("preflight.pets.shortCargo");
  return t("preflight.pets.shortNo");
}
