/**
 * Wikipedia summaries. The Romanian article is found through Wikidata sitelinks,
 * so a place whose OSM tag only names an English article still gets a Romanian
 * summary when one exists.
 */

export interface ArticleRef {
  lang: string;
  title: string;
}

export interface WikiSource {
  wikipedia?: string | null;
  wikidata?: string | null;
}

/** "en:Lisbon Cathedral" -> { lang: "en", title: "Lisbon Cathedral" } */
export function parseWikipediaTag(tag?: string | null): ArticleRef | undefined {
  const value = tag?.trim();
  if (!value) return undefined;
  const m = /^([a-z][a-z-]*):(.+)$/i.exec(value);
  if (m && m[1] && m[2]) return { lang: m[1].toLowerCase(), title: m[2].trim() };
  return { lang: "en", title: value };
}

/** { rowowiki: {title}, enwiki: {title} } -> { ro: "...", en: "..." } */
export function sitelinksToLanguages(
  rows: Record<string, { title?: string }> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [wiki, link] of Object.entries(rows ?? {})) {
    const lang = wiki.replace(/wiki$/, "").toLowerCase();
    if (lang && link?.title) out[lang] = link.title;
  }
  return out;
}

/**
 * Which article to show for the requested language: the article in that language
 * when we have one, then the tag's own language, then English.
 */
export function pickArticle(
  item: WikiSource,
  lang: string,
  links: Record<string, string> | undefined,
): ArticleRef | undefined {
  const wanted = links?.[lang];
  if (wanted) return { lang, title: wanted };
  const tag = parseWikipediaTag(item.wikipedia);
  if (tag && tag.lang === lang) return tag;
  const english = links?.en;
  if (english) return { lang: "en", title: english };
  return tag;
}

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

/** Language -> article title for one Wikidata item. */
export async function fetchWikidataSitelinks(qid: string): Promise<Record<string, string>> {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&format=json&origin=*`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Wikidata failed: ${res.status}`);
  const data = (await res.json()) as {
    entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
  };
  return sitelinksToLanguages(data.entities?.[qid.toUpperCase()]?.sitelinks);
}

/** One-paragraph summary, or nothing when there is no readable article. */
export async function fetchSummary(ref: ArticleRef): Promise<string | undefined> {
  const url = `https://${ref.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ref.title)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ArrivalAssistant/1.0 (travel helper web app)" },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { extract?: string; type?: string };
  if (!data.extract || data.type === "disambiguation") return undefined;
  return data.extract.trim();
}
