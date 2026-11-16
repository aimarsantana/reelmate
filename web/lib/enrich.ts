import { filmKey } from "./keys";
import { getCached, putCached } from "./storage";
import type { Enriched, Film, LookupItem } from "./types";

const BATCH = 20;
const PARALLEL = 2;

async function fetchBatch(items: LookupItem[], signal?: AbortSignal): Promise<Record<string, Enriched>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/tmdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        signal,
      });
      if (res.ok) return ((await res.json()) as { results: Record<string, Enriched> }).results;
      if (res.status === 400 || res.status === 502) break;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("tmdb_failed");
}

/**
 * Looks every film up on TMDB (via our own API route), checking the browser's
 * IndexedDB cache first. Only titles, years and TMDB ids leave the browser.
 */
export async function enrichAll(
  films: Film[],
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<Map<string, Enriched>> {
  const unique = new Map<string, Film>();
  for (const f of films) unique.set(filmKey(f), unique.get(filmKey(f)) ?? f);
  const keys = [...unique.keys()];
  const result = new Map<string, Enriched>();

  const cached = await getCached(keys);
  for (const [k, v] of Object.entries(cached)) result.set(k, v);
  let done = result.size;
  opts.onProgress?.(done, keys.length);

  const missing = keys.filter((k) => !result.has(k));
  const batches: LookupItem[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) {
    batches.push(
      missing.slice(i, i + BATCH).map((k) => {
        const f = unique.get(k)!;
        return { k, title: f.title, year: f.year, tmdbId: f.tmdbId };
      }),
    );
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, batches.length) }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const res = await fetchBatch(batch, opts.signal);
        await putCached(res);
        for (const [k, v] of Object.entries(res)) result.set(k, v);
        done += batch.length;
        opts.onProgress?.(done, keys.length);
      }
    }),
  );
  return result;
}
