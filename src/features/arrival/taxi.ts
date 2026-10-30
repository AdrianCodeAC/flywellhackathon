/**
 * Rough taxi fare ranges for the "Need a ride?" card.
 *
 * These are deliberately generic placeholders (a flag-down fee plus a per-km and
 * per-minute rate per country), NOT live tariff data — the card always labels the
 * result "Estimate". Replace the table with real tariffs per city if you have them.
 */

export interface TaxiRate {
  currency: string;
  start: number;
  perKm: number;
  perMin: number;
}

const GENERIC_RATE: TaxiRate = { currency: "EUR", start: 3.5, perKm: 1.2, perMin: 0.35 };

export const TAXI_RATES: Record<string, TaxiRate> = {
  AT: { currency: "EUR", start: 3.8, perKm: 1.1, perMin: 0.4 },
  BE: { currency: "EUR", start: 4.0, perKm: 1.2, perMin: 0.35 },
  CH: { currency: "CHF", start: 6.0, perKm: 2.2, perMin: 0.8 },
  CZ: { currency: "CZK", start: 40, perKm: 28, perMin: 9 },
  DE: { currency: "EUR", start: 4.0, perKm: 1.5, perMin: 0.4 },
  DK: { currency: "DKK", start: 20, perKm: 9, perMin: 3.5 },
  ES: { currency: "EUR", start: 3.5, perKm: 1.0, perMin: 0.3 },
  FI: { currency: "EUR", start: 6.0, perKm: 1.7, perMin: 0.5 },
  FR: { currency: "EUR", start: 4.0, perKm: 1.3, perMin: 0.35 },
  GB: { currency: "GBP", start: 3.5, perKm: 1.4, perMin: 0.4 },
  GR: { currency: "EUR", start: 3.5, perKm: 0.9, perMin: 0.3 },
  HU: { currency: "HUF", start: 1100, perKm: 440, perMin: 100 },
  IE: { currency: "EUR", start: 4.0, perKm: 1.5, perMin: 0.4 },
  IT: { currency: "EUR", start: 3.5, perKm: 1.1, perMin: 0.35 },
  NL: { currency: "EUR", start: 3.5, perKm: 1.3, perMin: 0.4 },
  NO: { currency: "NOK", start: 60, perKm: 18, perMin: 6 },
  PL: { currency: "PLN", start: 9, perKm: 3.5, perMin: 1.2 },
  PT: { currency: "EUR", start: 3.5, perKm: 0.7, perMin: 0.3 },
  RO: { currency: "RON", start: 5, perKm: 2.0, perMin: 0.6 },
  SE: { currency: "SEK", start: 50, perKm: 15, perMin: 5 },
  US: { currency: "USD", start: 3.5, perKm: 1.3, perMin: 0.4 },
};

export interface FareEstimate {
  low: number;
  high: number;
  currency: string;
}

/** +/- 25% around a flag-down + distance + time calculation. */
export function estimateTaxiFare(distanceM: number, durationSec: number, countryCode: string): FareEstimate {
  const rate = TAXI_RATES[countryCode.toUpperCase()] ?? GENERIC_RATE;
  const km = Math.max(0, distanceM) / 1000;
  const min = Math.max(0, durationSec) / 60;
  const mid = rate.start + rate.perKm * km + rate.perMin * min;
  return { low: Math.round(mid * 0.75), high: Math.round(mid * 1.25), currency: rate.currency };
}

/** "€25–35" / "80–110 RON" / "50–70 lei" style, locale-aware. */
export function formatFare(estimate: FareEstimate, locale = "en"): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: estimate.currency,
      maximumFractionDigits: 0,
    }).format(v);
  return `${fmt(estimate.low)}–${fmt(estimate.high)}`;
}
