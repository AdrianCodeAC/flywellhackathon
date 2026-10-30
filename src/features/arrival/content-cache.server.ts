/**
 * Server-only text cache backed by the `content_cache` table. Used for Wikipedia
 * summaries, Wikivoyage advice and its Romanian translations so every phone gets
 * the same saved copy instead of re-asking the source.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

async function readRow(key: string, ttlMs: number): Promise<string | undefined> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("content_cache")
    .select("value, created_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return undefined;
  if (Date.now() - new Date(data.created_at).getTime() > ttlMs) return undefined;
  return data.value;
}

async function writeRow(key: string, value: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("content_cache")
    .upsert({ cache_key: key, value, created_at: new Date().toISOString() });
}

/** Saved text for a key, or `load()` once and save it. Failures are not cached. */
export async function cachedText(
  key: string,
  ttlMs: number,
  load: () => Promise<string | undefined>,
): Promise<string | undefined> {
  const hit = await readRow(key, ttlMs);
  if (hit !== undefined) return hit;
  const fresh = await load();
  if (fresh) await writeRow(key, fresh);
  return fresh;
}

/** Same, for small JSON values (e.g. Wikidata sitelinks). */
export async function cachedJson<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = await readRow(key, ttlMs);
  if (hit !== undefined) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      /* bad row — reload below */
    }
  }
  const fresh = await load();
  await writeRow(key, JSON.stringify(fresh));
  return fresh;
}

export const DAY = DAY_MS;
