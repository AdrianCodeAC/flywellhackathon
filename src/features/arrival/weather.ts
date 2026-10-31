/** Weather at the destination (Open-Meteo, keyless) and what to wear for it. */

export interface Weather {
  /** "now" for current conditions, otherwise the forecast day (YYYY-MM-DD). */
  day: string;
  /** Current or daytime-max temperature, °C. */
  temp: number;
  /** Current feels-like or night-min temperature, °C. */
  low: number;
  /** WMO weather code. */
  code: number;
  /** Chance (%) or presence (100/0) of precipitation. */
  rainChance: number;
  windKmh: number;
}

export type Sky = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function skyFromCode(code: number): Sky {
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code <= 77 || code === 85 || code === 86) return "snow";
  return "storm";
}

/** Locale keys under weather.wear, most important first. */
export function whatToWear(w: Weather): string[] {
  const sky = skyFromCode(w.code);
  const coldest = Math.min(w.temp, w.low);
  const items: string[] = [];
  if (w.temp <= 0) items.push("winterCoat", "hatGloves");
  else if (w.temp <= 10) items.push("warmJacket");
  else if (w.temp <= 17) items.push("lightJacket");
  else if (w.temp <= 24) items.push("tshirtLayer");
  else items.push("lightClothes", "sunWater");
  if (sky === "snow") items.push("boots");
  else if (sky === "rain" || sky === "storm" || sky === "drizzle" || w.rainChance >= 50)
    items.push("umbrella");
  if (w.windKmh >= 35) items.push("windproof");
  if (w.temp > 10 && w.temp - coldest >= 10) items.push("layers");
  return items;
}

interface CurrentResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    precipitation: number;
    wind_speed_10m: number;
  };
}
interface DailyResponse {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    weather_code: (number | null)[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

export const FORECAST_DAYS = 15;

export function weatherUrl(lat: number, lon: number, day?: string): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: "auto",
    wind_speed_unit: "kmh",
  });
  if (day) {
    q.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max",
    );
    q.set("start_date", day);
    q.set("end_date", day);
  } else {
    q.set(
      "current",
      "temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m",
    );
  }
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

export function parseWeather(body: unknown, day?: string): Weather | null {
  if (!day) {
    const c = (body as CurrentResponse).current;
    if (!c) return null;
    return {
      day: "now",
      temp: Math.round(c.temperature_2m),
      low: Math.round(c.apparent_temperature),
      code: c.weather_code,
      rainChance: c.precipitation > 0 ? 100 : 0,
      windKmh: Math.round(c.wind_speed_10m),
    };
  }
  const d = (body as DailyResponse).daily;
  const max = d?.temperature_2m_max[0];
  const min = d?.temperature_2m_min[0];
  if (!d || max == null || min == null) return null;
  return {
    day,
    temp: Math.round(max),
    low: Math.round(min),
    code: d.weather_code[0] ?? 3,
    rainChance: d.precipitation_probability_max[0] ?? 0,
    windKmh: Math.round(d.wind_speed_10m_max[0] ?? 0),
  };
}
