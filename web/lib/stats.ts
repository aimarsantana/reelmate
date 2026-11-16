import { filmKey } from "./keys";
import type { Enriched, Film, Movie, Profile } from "./types";

export interface Group {
  key: string;
  n: number; // films (watched for byCount, rated for byRating)
  avg: number; // average user rating over rated films in the group
  rated: number;
  adj: number; // Bayesian-adjusted average, used only for ordering
}

export interface Opinion {
  title: string;
  year: number | null;
  rating: number;
  world: number; // TMDB average on a 0.5–5 scale
  diff: number;
  poster: string | null;
}

export type QuirkKind = "length" | "era" | "language" | "popularity";

export interface Quirk {
  kind: QuirkKind;
  a: { n: number; avg: number }; // long / old / English / popular
  b: { n: number; avg: number };
  diff: number; // a - b
  notable: boolean;
}

export interface Dim {
  byRating: Group[];
  byCount: Group[];
}

export interface Stats {
  watchedCount: number;
  ratedCount: number;
  likedCount: number;
  avg: number | null;
  dist: { rating: number; count: number }[];
  tone: "generous" | "harsh" | "balanced" | null;
  toneDelta: number | null;
  matchedRated: number;
  directors: Dim;
  actors: Dim;
  genres: Dim;
  decades: Dim;
  countries: Dim;
  decadeSeries: { decade: number; avg: number; n: number }[];
  up: Opinion[];
  down: Opinion[];
  controversial: Opinion | null;
  quirks: Quirk[];
  watchlist: { count: number; genres: { key: string; n: number }[] } | null;
  report: { title: string; year: number | null; status: "doubtful" | "notfound"; matched?: string }[];
  enough: { dims: boolean; world: boolean; quirks: boolean };
}

/** Minimum rated films for a group to appear in the "best rated" rankings. */
/**
 * Prior weight m of the Bayesian average: adj = (n·avg + m·C) / (n + m), with C = the user's overall average.
 * Groups are ordered by adj; the plain average is what the UI shows.
 */
export const PRIOR_M = { directors: 3, actors: 3, genres: 5, decades: 5, countries: 5 } as const;

export const MIN_RATED = { directors: 3, actors: 3, genres: 10, decades: 10, countries: 5 } as const;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

function group(
  rated: { r: number; keys: string[] }[],
  watched: { keys: string[] }[],
  min: number,
  prior: { m: number; c: number },
  limit = 8,
): Dim {
  const byKey = new Map<string, { n: number; rs: number[] }>();
  for (const w of watched)
    for (const k of new Set(w.keys)) {
      const g = byKey.get(k) ?? { n: 0, rs: [] };
      g.n++;
      byKey.set(k, g);
    }
  for (const x of rated)
    for (const k of new Set(x.keys)) {
      const g = byKey.get(k) ?? { n: 0, rs: [] };
      g.rs.push(x.r);
      byKey.set(k, g);
    }
  const all: Group[] = [...byKey.entries()].map(([key, g]) => ({
    key,
    n: g.n,
    rated: g.rs.length,
    avg: mean(g.rs),
    adj: (g.rs.length * mean(g.rs) + prior.m * prior.c) / (g.rs.length + prior.m || 1),
  }));
  return {
    byRating: all
      .filter((g) => g.rated >= min)
      .sort((a, b) => b.adj - a.adj || b.rated - a.rated)
      .slice(0, limit),
    byCount: all
      .filter((g) => g.n >= 2)
      .sort((a, b) => b.n - a.n || b.avg - a.avg)
      .slice(0, limit),
  };
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

export function computeStats(profile: Profile, enr: Map<string, Enriched>): Stats {
  // Union of everything the user has seen (rated films are always "watched").
  const seen = new Map<string, Film>();
  for (const f of [...profile.watched, ...profile.rated]) if (!seen.has(filmKey(f))) seen.set(filmKey(f), f);

  const ratedAll = profile.rated.filter((f) => f.rating);
  const ratings = ratedAll.map((f) => f.rating!);
  const avg = ratings.length ? mean(ratings) : null;

  const dist: Stats["dist"] = [];
  for (let r = 0.5; r <= 5; r += 0.5) dist.push({ rating: r, count: ratings.filter((x) => x === r).length });

  const movieOf = (f: Film): Movie | undefined => enr.get(filmKey(f))?.movie;
  const rated = ratedAll.map((f) => ({ f, r: f.rating!, m: movieOf(f) })).filter((x): x is { f: Film; r: number; m: Movie } => !!x.m);
  const watchedM = [...seen.values()].map((f) => ({ f, m: movieOf(f) })).filter((x): x is { f: Film; m: Movie } => !!x.m);

  const nRated = rated.length;

  const C = avg ?? 0;
  const dimOf = (pick: (m: Movie) => string[], min: number, m: number) =>
    group(
      rated.map((x) => ({ r: x.r, keys: pick(x.m) })),
      watchedM.map((x) => ({ keys: pick(x.m) })),
      min,
      { m, c: C },
    );
  const decadeOf = (m: Movie) => (m.year ? [String(Math.floor(m.year / 10) * 10)] : []);

  const directors = dimOf((m) => m.directors, MIN_RATED.directors, PRIOR_M.directors);
  const actors = dimOf((m) => m.cast, MIN_RATED.actors, PRIOR_M.actors);
  const genres = dimOf((m) => m.genres.map(String), MIN_RATED.genres, PRIOR_M.genres);
  const decades = dimOf(decadeOf, MIN_RATED.decades, PRIOR_M.decades);
  const countries = dimOf((m) => m.countries, MIN_RATED.countries, PRIOR_M.countries);

  const decadeSeries = [...group(
    rated.map((x) => ({ r: x.r, keys: decadeOf(x.m) })),
    [],
    1,
    { m: 0, c: C },
    50,
  ).byRating]
    .map((g) => ({ decade: Number(g.key), avg: round1(g.avg), n: g.rated }))
    .sort((a, b) => a.decade - b.decade);

  // You vs. the world (TMDB average rescaled from 0–10 to 0–5; ignore films with few votes).
  const opinions: Opinion[] = rated
    .filter((x) => x.m.votes >= 50 && x.m.vote > 0)
    .map((x) => ({
      title: x.m.title,
      year: x.m.year,
      rating: x.r,
      world: x.m.vote / 2,
      diff: x.r - x.m.vote / 2,
      poster: x.m.poster,
    }));
  const byDiff = [...opinions].sort((a, b) => b.diff - a.diff);
  const up = byDiff.filter((o) => o.diff > 0.4).slice(0, 5);
  const down = byDiff
    .filter((o) => o.diff < -0.4)
    .reverse()
    .slice(0, 5);
  const controversial = [...opinions].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0] ?? null;

  const toneDelta = opinions.length >= 5 ? mean(opinions.map((o) => o.diff)) : null;
  const tone = toneDelta === null ? null : toneDelta > 0.25 ? "generous" : toneDelta < -0.25 ? "harsh" : "balanced";

  // Quirks
  const split = (pred: (m: Movie) => boolean | null): { a: number[]; b: number[] } => {
    const a: number[] = [];
    const b: number[] = [];
    for (const x of rated) {
      const p = pred(x.m);
      if (p === null) continue;
      (p ? a : b).push(x.r);
    }
    return { a, b };
  };
  const medPop = median(rated.map((x) => x.m.popularity));
  const defs: [QuirkKind, (m: Movie) => boolean | null][] = [
    ["length", (m) => (m.runtime ? m.runtime > 120 : null)],
    ["era", (m) => (m.year ? m.year < 2000 : null)],
    ["language", (m) => (m.lang ? m.lang === "en" : null)],
    ["popularity", (m) => m.popularity > medPop],
  ];
  const quirks: Quirk[] = [];
  for (const [kind, pred] of defs) {
    const { a, b } = split(pred);
    if (a.length < 3 || b.length < 3) continue;
    const diff = mean(a) - mean(b);
    quirks.push({
      kind,
      a: { n: a.length, avg: mean(a) },
      b: { n: b.length, avg: mean(b) },
      diff,
      notable: Math.abs(diff) >= 0.2 && Math.min(a.length, b.length) >= 5,
    });
  }

  // Watchlist
  let watchlist: Stats["watchlist"] = null;
  if (profile.watchlist.length) {
    const counts = new Map<string, number>();
    for (const f of profile.watchlist) for (const g of movieOf(f)?.genres ?? []) counts.set(String(g), (counts.get(String(g)) ?? 0) + 1);
    watchlist = {
      count: profile.watchlist.length,
      genres: [...counts.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n).slice(0, 8),
    };
  }

  // Report of dubious / missing matches
  const report: Stats["report"] = [];
  for (const f of [...seen.values(), ...profile.watchlist]) {
    const e = enr.get(filmKey(f));
    if (!e || e.status === "ok") continue;
    report.push({ title: f.title, year: f.year, status: e.status as "doubtful" | "notfound", matched: e.movie ? `${e.movie.title} (${e.movie.year ?? "?"})` : undefined });
  }

  return {
    watchedCount: seen.size,
    ratedCount: ratedAll.length,
    likedCount: profile.rated.filter((f) => f.liked).length,
    avg,
    dist,
    tone,
    toneDelta,
    matchedRated: nRated,
    directors,
    actors,
    genres,
    decades,
    countries,
    decadeSeries,
    up,
    down,
    controversial,
    quirks,
    watchlist,
    report,
    enough: { dims: nRated >= 8, world: opinions.length >= 5, quirks: quirks.length > 0 },
  };
}
