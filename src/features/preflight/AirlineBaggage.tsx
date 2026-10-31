import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Backpack, BriefcaseBusiness, ExternalLink, Luggage } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findAirline, type Bag } from "./airlines";

/** Bag allowance for the passenger's airline, per fare, with the official link. */
export function AirlineBaggage({ airline: text }: { airline: string }) {
  const { t } = useTranslation();
  const airline = findAirline(text);
  const [fareId, setFareId] = useState(airline?.fares[0]?.id ?? "");
  if (!airline) return null;
  const fare = airline.fares.find((f) => f.id === fareId) ?? airline.fares[0];
  if (!fare) return null;

  const bag = (b: Bag | null) =>
    b
      ? `${b.size} cm${b.kg ? ` · ${t("preflight.bags.kg", { kg: b.kg })}` : ""}`
      : t("preflight.bags.notIncluded");
  const checked =
    fare.checked === null
      ? t("preflight.bags.notIncluded")
      : fare.checked === "paid"
        ? t("preflight.bags.paid")
        : fare.checked === "route"
          ? t("preflight.bags.byRoute")
          : fare.checked;
  const rows = [
    {
      icon: Backpack,
      label: t("preflight.bags.personal"),
      value: bag(fare.personal),
      hide: !fare.personal && fare.cabin !== null,
    },
    {
      icon: BriefcaseBusiness,
      label: t("preflight.bags.cabin"),
      value: bag(fare.cabin),
      hide: false,
    },
    { icon: Luggage, label: t("preflight.bags.checked"), value: checked, hide: false },
  ];

  return (
    <article className="mb-3 rounded-lg border border-primary/40 bg-card p-4">
      <h4 className="flex flex-wrap items-center gap-2 font-semibold">
        {t("preflight.bags.title", { airline: airline.name })}
        {airline.verify && <Badge variant="outline">{t("preflight.bags.verifyBadge")}</Badge>}
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">{t("preflight.bags.pickFare")}</p>
      <ToggleGroup
        type="single"
        variant="outline"
        value={fare.id}
        onValueChange={(v) => v && setFareId(v)}
        className="mt-3 flex w-full flex-wrap justify-start"
        aria-label={t("preflight.bags.pickFare")}
      >
        {airline.fares.map((f) => (
          <ToggleGroupItem
            key={f.id}
            value={f.id}
            className="h-auto min-h-11 whitespace-normal px-3 py-2 text-sm"
          >
            {f.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <dl className="mt-4 grid gap-3">
        {rows
          .filter((r) => !r.hide)
          .map((r) => (
            <div key={r.label} className="flex items-start gap-3">
              <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <dt className="text-sm font-semibold">{r.label}</dt>
                <dd className="text-sm text-muted-foreground">{r.value}</dd>
              </div>
            </div>
          ))}
      </dl>
      {fare.note && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t(`preflight.bags.note.${fare.note}`)}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {t(airline.verify ? "preflight.bags.verify" : "preflight.bags.checkedOn")}
      </p>
      <a
        href={airline.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("preflight.bags.official", { airline: airline.name })}
        <ExternalLink className="size-3.5" />
      </a>
    </article>
  );
}
