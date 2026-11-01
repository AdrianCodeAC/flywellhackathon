import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Plane } from "lucide-react";
import cityImage from "@/assets/arrival-craiova.jpg";
import type { Airport } from "@/features/arrival/types";
import { getCityPhoto } from "./discovery.functions";

export function OriginBanner({ airport }: { airport: Airport | null }) {
  const { t, i18n } = useTranslation();
  const load = useServerFn(getCityPhoto);
  const [photo, setPhoto] = useState<{ city: string; url: string } | null>(null);
  const city = airport?.city ?? "Craiova";
  const lang = i18n.language === "ro" ? "ro" : "en";
  const isCraiova = city === "Craiova";
  const url = isCraiova ? cityImage : photo?.city === city ? photo.url : null;

  useEffect(() => {
    if (isCraiova) return;
    let active = true;
    void load({ data: { city, lang } }).then(value => {
      if (!active || !value) return;
      const image = new Image();
      image.onload = () => { if (active) setPhoto({ city, url: value }); };
      image.src = value;
    }).catch(() => {});
    return () => { active = false; };
  }, [city, lang, isCraiova, load]);

  const country = airport ? new Intl.DisplayNames([lang], { type: "region" }).of(airport.countryCode) : new Intl.DisplayNames([lang], { type: "region" }).of("RO");
  return <section className="arrival-hero trip-hero bg-primary">
    {url && <img key={url} src={url} alt={city} className="arrival-hero-image" width={1920} height={1088} fetchPriority="high" />}
    <div className="arrival-hero-shade" />
    <div className="arrival-hero-content">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase"><Plane className="size-4" />{t("trip.eyebrow")}</p>
      <h1 className="font-display text-5xl font-normal sm:text-7xl">{t("trip.title")}</h1>
      <p className="mt-4 max-w-md leading-relaxed text-hero-foreground/90">{t("trip.subtitle")}</p>
    </div>
    <span className="arrival-photo-caption"><MapPin className="size-3" />{city}, {country}</span>
  </section>;
}