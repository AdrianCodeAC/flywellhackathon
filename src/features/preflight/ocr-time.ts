/**
 * Boarding passes print the departure and gate-closing times as text, but the
 * BCBP barcode carries no time — so after a successful barcode scan we OCR the
 * image and pull the time from the labels ("Departure 14:35", "Gate closes 14:20").
 */

const TIME = /([01]?\d|2[0-3])[:.]([0-5]\d)/g;

/** Priority: the actual departure time first, then boarding/gate labels. */
const LABELS: RegExp[] = [
  /departure|departs|dep\.|std/i,
  /gate closes|gate close|boarding|board/i,
];

/** First HH:MM found on a line matching a time label, in label priority order. */
export function extractDepartureTime(text: string): string | null {
  const lines = text.split(/\n+/);
  for (const label of LABELS) {
    for (const line of lines) {
      if (!label.test(line)) continue;
      TIME.lastIndex = 0;
      const m = TIME.exec(line);
      if (m) return `${m[1]!.padStart(2, "0")}:${m[2]}`;
    }
  }
  return null;
}

/** OCR the pass image and return the departure time, or null when unreadable. */
export async function readPassTime(file: File): Promise<string | null> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const { data } = await worker.recognize(file);
      return extractDepartureTime(data.text);
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}
