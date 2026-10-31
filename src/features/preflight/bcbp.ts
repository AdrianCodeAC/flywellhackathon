/**
 * IATA Bar Coded Boarding Pass (BCBP, Resolution 792) — the mandatory fixed-width
 * fields every boarding-pass barcode starts with. Only the first leg is read.
 */
export interface BoardingPass {
  name: string;
  pnr: string;
  from: string;
  to: string;
  carrier: string;
  flight: string;
  /** Day of the year (1–366) of the flight. */
  julianDay: number;
  compartment: string;
  seat: string;
}

export function parseBoardingPass(raw: string): BoardingPass | null {
  const s = raw.replace(/^\s+/, "");
  if (s.length < 58 || s[0] !== "M" || !/[1-4]/.test(s[1] ?? "")) return null;
  const field = (start: number, length: number) => s.slice(start, start + length).trim();
  const from = field(30, 3);
  const to = field(33, 3);
  const carrier = field(36, 3);
  const julianDay = Number(field(44, 3));
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^[A-Z0-9]{2,3}$/.test(carrier))
    return null;
  if (!Number.isInteger(julianDay) || julianDay < 1 || julianDay > 366) return null;
  const [last = "", first = ""] = field(2, 20).split("/");
  return {
    name: [first, last].filter(Boolean).join(" "),
    pnr: field(23, 7),
    from,
    to,
    carrier,
    flight: field(39, 5).replace(/^0+(?=\d)/, ""),
    julianDay,
    compartment: field(47, 1),
    seat: field(48, 4).replace(/^0+(?=\d)/, ""),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * BCBP carries no year: pick the year that puts the flight closest after
 * `today` (allowing two days in the past, for a pass scanned after midnight).
 */
export function flightDate(julianDay: number, today = new Date()): string {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const time = Date.UTC(year, 0, julianDay);
    if (new Date(time).getUTCFullYear() !== year) continue; // day 366 in a non-leap year
    if (time >= start - 2 * 86_400_000) {
      const d = new Date(time);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
  }
  const d = new Date(Date.UTC(today.getFullYear() + 1, 0, Math.min(julianDay, 365)));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
