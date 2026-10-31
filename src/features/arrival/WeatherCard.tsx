import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Shirt,
  Sun,
  Wind,
} from "lucide-react";
import { getWeather } from "./services";
import { skyFromCode, whatToWear, type Sky, type Weather } from "./weather";

const ICONS: Record<Sky, typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/**
 * Weather at the destination plus what to wear. Without `day` it shows the
 * current conditions (just landed); with `day` the forecast for that date.
 */
export function WeatherCard({
  lat,
  lon,
  city,
  day,
}: {
  lat: number;
  lon: number;
  city: string;
  day?: string | undefined;
}) {
  const { t } = useTranslation();
  const [weather, setWeather] = useState<Weather | null | "error">(null);

  useEffect(() => {
    let active = true;
    setWeather(null);
    getWeather(lat, lon, day)
      .then((w) => active && setWeather(w ?? "error"))
      .catch(() => active && setWeather("error"));
    return () => {
      active = false;
    };
  }, [lat, lon, day]);

  if (weather === null)
    return (
      <div
        className="h-28 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
        aria-hidden
      />
    );
  if (weather === "error")
    return <p className="text-sm text-muted-foreground">{t("weather.unavailable")}</p>;

  const sky = skyFromCode(weather.code);
  const Icon = ICONS[sky];
  return (
    <article className="rounded-lg border bg-card p-4" aria-live="polite">
      <div className="flex items-center gap-4">
        <Icon className="size-10 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {t(day ? "weather.onDay" : "weather.now", { city })}
          </p>
          <p className="text-2xl font-semibold">
            {weather.temp}°C{" "}
            <span className="text-base font-normal text-muted-foreground">
              · {t(`weather.sky.${sky}`)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t(day ? "weather.range" : "weather.feels", { low: weather.low })}
            {day && ` · ${t("weather.rain", { chance: weather.rainChance })}`}
            {weather.windKmh >= 20 && (
              <>
                {" · "}
                <Wind className="inline size-3.5" aria-hidden />{" "}
                {t("weather.wind", { kmh: weather.windKmh })}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 border-t pt-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Shirt className="size-4 text-primary" />
          {t("weather.wearTitle")}
        </p>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {whatToWear(weather).map((k) => (
            <li key={k}>• {t(`weather.wear.${k}`)}</li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("weather.source")}</p>
    </article>
  );
}
