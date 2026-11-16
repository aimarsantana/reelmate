import "server-only";
import { norm } from "../keys";
import type { Enriched, LookupItem, Movie } from "../types";

const BASE = "https://api.themoviedb.org/3";
const WEEK = 60 * 60 * 24 * 7;

// Best-effort in-memory cache (per server instance) on top of fetch's data cache.
const memory = new Map<string, Enriched>();

async function tget<T>(path: string, params: Record<string, string> = {}, retry = true): Promise<T | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not configured");
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { next: { revalidate: WEEK } });
  if (res.status === 404) return null;
  if (res.status === 429 && retry) {
    const wait = Number(res.headers.get("retry-after") ?? "1");
    await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000));
    return tget<T>(path, params, false);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

interface TmdbDetails {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  genres?: { id: number }[];
  runtime?: number | null;
  production_countries?: { iso_3166_1: string }[];
  original_language?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
  credits?: {
    cast?: { name: string; order: number }[];
    crew?: { name: string; job: string }[];
  };
}

interface TmdbSearch {
  results: { id: number; title: string; original_title: string; release_date?: string; popularity?: number }[];
}

const yearOf = (d?: string) => (d && d.length >= 4 ? Number(d.slice(0, 4)) : null);

async function details(id: number): Promise<Movie | null> {
  const d = await tget<TmdbDetails>(`/movie/${id}`, { append_to_response: "credits" });
  if (!d) return null;
  const directors = [...new Set((d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name))];
  const cast = (d.credits?.cast ?? [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.name);
  return {
    id: d.id,
    title: d.title,
    year: yearOf(d.release_date),
    genres: (d.genres ?? []).map((g) => g.id),
    directors,
    cast,
    runtime: d.runtime || null,
    countries: (d.production_countries ?? []).map((c) => c.iso_3166_1),
    lang: d.original_language ?? null,
    vote: d.vote_average ?? 0,
    votes: d.vote_count ?? 0,
    popularity: d.popularity ?? 0,
    poster: d.poster_path ?? null,
  };
}

function sameTitle(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && x === y;
}

async function search(title: string, year: number | null): Promise<Enriched> {
  // 1) exact year, 2) no year filter (then we filter ±1 year ourselves)
  const attempts: Record<string, string>[] = [];
  if (year) attempts.push({ query: title, year: String(year) });
  attempts.push({ query: title });

  for (const params of attempts) {
    const res = await tget<TmdbSearch>("/search/movie", { ...params, include_adult: "false" });
    const candidates = (res?.results ?? [])
      .map((r) => ({ r, y: yearOf(r.release_date) }))
      .filter((c) => year === null || (c.y !== null && Math.abs(c.y - year) <= 1));
    if (!candidates.length) continue;

    const score = (c: (typeof candidates)[number]) =>
      (sameTitle(c.r.title, title) || sameTitle(c.r.original_title, title) ? 100 : 0) +
      (year !== null && c.y === year ? 10 : 0) +
      Math.min(c.r.popularity ?? 0, 9) / 10;
    candidates.sort((a, b) => score(b) - score(a));
    const best = candidates[0];
    const exactTitle = sameTitle(best.r.title, title) || sameTitle(best.r.original_title, title);
    const movie = await details(best.r.id);
    if (!movie) continue;
    // A ±1 year difference is tolerated; only an unsure title makes the match doubtful.
    return { status: exactTitle ? "ok" : "doubtful", movie };
  }
  return { status: "notfound" };
}

export async function resolve(item: LookupItem): Promise<Enriched> {
  const memKey = item.tmdbId ? `id:${item.tmdbId}` : `t:${norm(item.title)}|${item.year ?? ""}`;
  const hit = memory.get(memKey);
  if (hit) return hit;

  let out: Enriched | null = null;
  if (item.tmdbId) {
    const movie = await details(item.tmdbId);
    if (movie) out = { status: "ok", movie };
  }
  if (!out) out = await search(item.title, item.year);
  memory.set(memKey, out);
  return out;
}

/** Runs `fn` over `items` with limited concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
