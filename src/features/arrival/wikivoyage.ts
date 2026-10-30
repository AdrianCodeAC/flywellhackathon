/**
 * Wikivoyage: read the city's "Get in -> By plane" advice and turn the wikitext
 * into plain, readable text. Parsing is pure so it can be tested without network.
 */

const WIKIVOYAGE_API = "https://en.wikivoyage.org/w/api.php";

function headingLevel(line: string): number {
  const m = /^(={1,6})\s*\S.*?\1\s*$/.exec(line);
  return m?.[1] ? m[1].length : 0;
}

function headingText(line: string): string {
  return line.replace(/^=+\s*/, "").replace(/\s*=+\s*$/, "").trim().toLowerCase();
}

/** Body of `heading` (level 2), optionally only its `subheading` (level 3). */
export function extractSection(wikitext: string, heading: string, subheading?: string): string | undefined {
  const lines = wikitext.split("\n");
  const want = heading.toLowerCase();
  const start = lines.findIndex((l) => headingLevel(l) === 2 && headingText(l) === want);
  if (start < 0) return undefined;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const level = headingLevel(lines[i] ?? "");
    if (level > 0 && level <= 2) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start + 1, end);
  if (!subheading) return block.join("\n").trim() || undefined;

  const sub = subheading.toLowerCase();
  const from = block.findIndex((l) => headingLevel(l) === 3 && headingText(l) === sub);
  if (from < 0) return undefined;
  let to = block.length;
  for (let i = from + 1; i < block.length; i++) {
    const level = headingLevel(block[i] ?? "");
    if (level > 0 && level <= 3) {
      to = i;
      break;
    }
  }
  return block.slice(from + 1, to).join("\n").trim() || undefined;
}

/** Wikitext -> readable prose: no templates, refs, markup or wiki links. */
export function cleanWikiText(src: string): string {
  let t = src;
  t = t.replace(/<!--[\s\S]*?-->/g, " ");
  t = t.replace(/<ref[^>]*\/>/gi, " ");
  t = t.replace(/<ref[\s\S]*?<\/ref>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/?(?:small|big|span|div|p|ul|ol|li|nowrap|abbr)[^>]*>/gi, " ");
  // Templates can nest, so collapse the innermost pair until none are left.
  while (/\{\{[^{}]*\}\}/i.test(t)) t = t.replace(/\{\{[^{}]*\}\}/gi, " ");
  t = t.replace(/\{\{[\s\S]*?\}\}/gi, " ");
  t = t.replace(/\[\[(?:[Ff]ile|[Ii]mage):[^\]]*\]\]/g, " ");
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[\[([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[(?:https?:\/\/|mailto:)[^\s\]]+\s+([^\]]+)\]/g, "$1");
  t = t.replace(/\[(?:https?:\/\/|mailto:)[^\s\]]+\]/g, "");
  t = t.replace(/'{2,}/g, "");
  t = t.replace(/^\s*=+\s*[^\n]*?=+\s*$/gm, " ");
  t = t.replace(/~{3,}/g, "");
  t = t.replace(/^\s*[*#:;]+\s*/gm, "");
  t = t.replace(/<[^>]*>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/ *\n */g, "\n");
  t = t.replace(/\n{2,}/g, "\n\n");
  return t.trim();
}

interface ParseResponse {
  parse?: { wikitext?: { "*": string } };
  error?: { code?: string };
}

/** The city's airport arrival advice, cleaned. Undefined when the page has none. */
export async function fetchWikivoyageByPlane(city: string): Promise<string | undefined> {
  const url = `${WIKIVOYAGE_API}?action=parse&page=${encodeURIComponent(city)}&prop=wikitext&redirects=1&format=json&origin=*`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ArrivalAssistant/1.0 (travel helper)" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikivoyage failed: ${res.status}`);
  const data = (await res.json()) as ParseResponse;
  if (data.error) return undefined;
  const wikitext = data.parse?.wikitext?.["*"];
  if (!wikitext) return undefined;
  const section = extractSection(wikitext, "Get in", "By plane");
  if (!section) return undefined;
  const clean = cleanWikiText(section);
  return clean || undefined;
}
