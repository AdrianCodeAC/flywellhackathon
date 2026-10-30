/**
 * Backend helpers for the visit and transport sections: Wikipedia summaries in
 * the reader's language and the city's airport-arrival advice. Both are cached in
 * the database, and the Romanian advice goes through the AI function.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;

const summaryInput = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        wikipedia: z.string().max(300).nullable().default(null),
        wikidata: z.string().max(20).nullable().default(null),
      }),
    )
    .max(12),
  lang: z.enum(["en", "ro"]),
});

/**
 * Short summaries for the places that have a Wikipedia/Wikidata tag.
 * Romanian readers get the Romanian article when Wikidata says one exists.
 */
export const getPlaceSummaries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => summaryInput.parse(d))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { cachedJson, cachedText, DAY } = await import("./content-cache.server");
    const { fetchWikidataSitelinks, fetchSummary, pickArticle } = await import("./wikipedia");
    const out: Record<string, string> = {};

    await Promise.all(
      data.items.map(async (item) => {
        try {
          const rawId = item.wikidata?.trim().toUpperCase();
          const qid = rawId && /^Q[1-9]\d*$/.test(rawId) ? rawId : undefined;
          const links = qid
            ? await cachedJson(`wd:${qid}`, 30 * DAY_MS, () => fetchWikidataSitelinks(qid))
            : undefined;
          const ref = pickArticle(item, data.lang, links);
          if (!ref) return;
          const text = await cachedText(`sum:${ref.lang}:${ref.title}`, 30 * DAY_MS, () => fetchSummary(ref));
          if (text) out[item.id] = text;
        } catch {
          /* one place failing must not cost the others their summary */
        }
      }),
    );
    return out;
  });

const guideInput = z.object({
  city: z.string().min(1).max(120),
  lang: z.enum(["en", "ro"]),
});

export interface TransportGuide {
  text?: string;
  /** Where the text came from, so the UI can be honest about a fallback. */
  source: "en" | "ro" | "none";
}

/**
 * "Get in → By plane" advice for the city, cleaned of wiki markup.
 * Saved per city; the Romanian version is translated once and saved too.
 */
export const getTransportGuide = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => guideInput.parse(d))
  .handler(async ({ data }): Promise<TransportGuide> => {
    const { cachedText } = await import("./content-cache.server");
    const { fetchWikivoyageByPlane } = await import("./wikivoyage");
    const slug = data.city.trim().toLowerCase();

    const english = await cachedText(`wv:${slug}:en`, DAY_MS, () => fetchWikivoyageByPlane(data.city.trim()));
    if (!english) return { source: "none" };
    if (data.lang === "en") return { text: english, source: "en" };

    const romanian = await cachedText(`wv:${slug}:ro`, DAY_MS, async () => {
      const { askText } = await import("./ai.server");
      return askText(
        "You translate travel advice into Romanian. Keep place names, brand names, prices and numbers exactly as written. " +
          "Use correct Romanian diacritics (ă, â, î, ș, ț with comma below). Return only the translated text.",
        english,
      );
    });
    return romanian ? { text: romanian, source: "ro" } : { text: english, source: "en" };
  });
