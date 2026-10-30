/**
 * Small parser for the common subset of OSM opening_hours, e.g.
 * "24/7", "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off", "09:00-23:00", "Mo-Su 18:00-02:00".
 * Returns undefined when the value uses syntax we don't understand.
 */
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDays(spec: string): Set<number> | undefined {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.trim().split("-");
    const s = DAYS.indexOf(a ?? "");
    if (s < 0) return undefined;
    if (b === undefined) {
      out.add(s);
      continue;
    }
    const e = DAYS.indexOf(b);
    if (e < 0) return undefined;
    for (let d = s; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === e) break;
    }
  }
  return out;
}

function toMin(t: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isOpenNow(value: string | undefined, now: Date = new Date()): boolean | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (v === "24/7") return true;
  const day = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  const prev = (day + 6) % 7;
  let result: boolean | undefined = false;
  let matchedAny = false;

  for (const raw of v.split(";")) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = /^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(.*)$/.exec(rule);
    if (!m) return undefined;
    const days = m[1] ? parseDays(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return undefined;
    const times = (m[2] ?? "").trim();

    if (times === "off" || times === "closed") {
      if (days.has(day)) {
        matchedAny = true;
        result = false;
      }
      continue;
    }

    let openToday = false;
    let todayMatches = days.has(day);
    for (const span of times.split(",")) {
      const [a, b] = span.split("-");
      const s = toMin(a ?? "");
      const e = b === "24:00" ? 1440 : toMin(b ?? "");
      if (s === undefined || e === undefined) return undefined;
      if (e > s) {
        if (todayMatches && min >= s && min < e) openToday = true;
      } else {
        // Overnight span: today after start, or yesterday's span still running.
        if (todayMatches && min >= s) openToday = true;
        if (days.has(prev) && min < e) {
          openToday = true;
          todayMatches = true;
        }
      }
    }
    // Later rules override earlier ones for the days they cover.
    if (todayMatches) {
      matchedAny = true;
      result = openToday;
    }
  }
  return matchedAny ? result : false;
}

/**
 * Shows OSM opening hours with the selected locale's day names, e.g.
 * "Mo-Fr 09:00-18:00; Su off" → "lun.–vin. 09:00–18:00; dum. închis" in Romanian.
 */
export function formatOpeningHours(
  value: string,
  locale: string,
  labels: { alwaysOpen: string; closed: string },
): string {
  const v = value.trim();
  if (v === "24/7") return labels.alwaysOpen;
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 2023-01-01 was a Sunday, matching DAYS[0].
  const names = DAYS.map((_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
  return v
    .replace(/\b(Su|Mo|Tu|We|Th|Fr|Sa)\b/g, (d) => names[DAYS.indexOf(d)] ?? d)
    .replace(/\b(off|closed)\b/g, labels.closed)
    .replace(/(\d)-(\d)/g, "$1–$2")
    .replace(/\.-/g, ".–");
}
