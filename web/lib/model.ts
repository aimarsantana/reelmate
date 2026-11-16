/**
 * "How many stars would I give it?" — rating model that trains in the browser.
 *
 * TypeScript port of analysis/src/features.py + analysis/src/models.py (see
 * analysis/notebooks/01_rating_model.ipynb). Pure functions, no DOM: it runs in a Web Worker
 * and in the unit tests (lib/model.test.ts checks it against the Python reference).
 *
 * Two models:
 *  - "fallback": user mean + (TMDB score − their usual TMDB score) + shrunk genre effects.
 *  - "personal": Ridge regression on genres, decade, runtime, popularity, TMDB score, language,
 *    country and a Bayesian-smoothed encoding of directors/actors (leave-one-out inside the
 *    training data, so a film never "sees" its own rating).
 * Which one is used is decided per user by cross-validating both on their own ratings.
 */
import type { Movie } from "./types";

export const PRIOR_M = 3; // Bayesian prior weight for directors / actors (same as the dashboard)
export const MIN_GENRE = 5;
export const MIN_COUNTRY = 8;
/** TMDB scores are shrunk by vote count: (v·R + m·C)/(v + m), C = global TMDB mean, m = prior weight in votes. */
export const TMDB_C = 6.5;
export const VOTE_M = 500;
/** Films with fewer TMDB votes than this get a "less reliable" warning in the UI. */
export const LOW_VOTES = 100;
export const adjustedVote = (vote: number, votes: number, m = VOTE_M) => (votes + m > 0 ? (votes * vote + m * TMDB_C) / (votes + m) : TMDB_C);
export const FREE_SCALE = 10; // TMDB slope is (almost) not penalised
export const GENRE_PRIOR_M = 5;
export const ALPHAS = Array.from({ length: 20 }, (_, i) => 10 ** (-1 + (4 * i) / 19));
/** Minimum rated films before the personal model is even considered. */
export const MIN_PERSONAL = 30;

export interface Sample {
  movie: Movie;
  filmYear: number | null;
  rating: number;
}

export type ModelKind = "personal" | "fallback";

export interface Part {
  kind: "crowd" | "director" | "cast" | "genre" | "decade" | "runtime" | "popularity" | "language" | "country";
  /** Contribution in stars relative to an "average film" for this user. */
  value: number;
  /** Person name, genre id or country code, depending on `kind`. */
  label?: string;
  /** TMDB average (0–10) for `crowd`. */
  tmdb?: number;
}

export interface Prediction {
  value: number; // clipped to [0.5, 5]
  parts: Part[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const clip = (p: number) => Math.min(5, Math.max(0.5, p));

// ---------------------------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------------------------
export class Encoder {
  C = 0;
  genres: number[] = [];
  countries: string[] = [];
  runtimeMedian = 100;
  private stats = { director: new Map<string, [number, number]>(), cast: new Map<string, [number, number]>() };
  columns: string[] = [];

  fit(train: Sample[]): this {
    this.C = mean(train.map((s) => s.rating));
    const gc = new Map<number, number>();
    const cc = new Map<string, number>();
    for (const s of train) {
      for (const g of new Set(s.movie.genres)) gc.set(g, (gc.get(g) ?? 0) + 1);
      for (const c of new Set(s.movie.countries)) cc.set(c, (cc.get(c) ?? 0) + 1);
    }
    this.genres = [...gc].filter(([, k]) => k >= MIN_GENRE).map(([g]) => g).sort((a, b) => a - b);
    this.countries = [...cc].filter(([, k]) => k >= MIN_COUNTRY).map(([c]) => c).sort();
    const rt = train.map((s) => s.movie.runtime).filter((r): r is number => r != null).sort((a, b) => a - b);
    this.runtimeMedian = rt.length ? (rt.length % 2 ? rt[(rt.length - 1) / 2] : (rt[rt.length / 2 - 1] + rt[rt.length / 2]) / 2) : 100;
    this.stats = { director: new Map(), cast: new Map() };
    for (const s of train) {
      for (const [kind, keys] of [["director", s.movie.directors], ["cast", s.movie.cast]] as const) {
        for (const k of new Set(keys)) {
          const e = this.stats[kind].get(k) ?? [0, 0];
          e[0] += s.rating;
          e[1] += 1;
          this.stats[kind].set(k, e);
        }
      }
    }
    this.columns = [
      "decade",
      "runtime",
      "log_popularity",
      "tmdb_vote",
      "english",
      "director_te",
      "cast_te",
      ...this.genres.map((g) => `genre_${g}`),
      ...this.countries.map((c) => `country_${c}`),
    ];
    return this;
  }

  /** Bayesian-smoothed deviation from the global mean: (sum − n·C)/(n + m). `own` = leave-one-out. */
  private dev(kind: "director" | "cast", key: string, own?: number): number {
    let [s, n] = this.stats[kind].get(key) ?? [0, 0];
    if (own !== undefined) {
      s -= own;
      n -= 1;
    }
    return (s - n * this.C) / (n + PRIOR_M);
  }

  /** Per-person deviations (used to name "the" director/actor that moves the prediction). */
  devs(kind: "director" | "cast", keys: string[]): { key: string; dev: number }[] {
    return [...new Set(keys)].map((key) => ({ key, dev: this.dev(kind, key) }));
  }

  private encode(kind: "director" | "cast", keys: string[], own?: number): number {
    const u = [...new Set(keys)];
    return u.length ? mean(u.map((k) => this.dev(kind, k, own))) : 0;
  }

  row(movie: Movie, filmYear: number | null, own?: number): number[] {
    const year = movie.year ?? filmYear ?? 2000;
    const g = new Set(movie.genres);
    const c = new Set(movie.countries);
    return [
      (Math.floor(year / 10) * 10 - 1900) / 10,
      movie.runtime ?? this.runtimeMedian,
      Math.log1p(movie.popularity),
      adjustedVote(movie.vote, movie.votes) / 2,
      movie.lang === "en" ? 1 : 0,
      this.encode("director", movie.directors, own),
      this.encode("cast", movie.cast, own),
      ...this.genres.map((x) => (g.has(x) ? 1 : 0)),
      ...this.countries.map((x) => (c.has(x) ? 1 : 0)),
    ];
  }

  /** Training features: leave-one-out target encoding (the film's own rating is removed). */
  fitTransform(train: Sample[]): number[][] {
    this.fit(train);
    return train.map((s) => this.row(s.movie, s.filmYear, s.rating));
  }
}

// ---------------------------------------------------------------------------------------------
// Linear algebra (tiny dense matrices)
// ---------------------------------------------------------------------------------------------
function invert(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    const d = m[c][c];
    for (let j = 0; j < 2 * n; j++) m[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      if (f !== 0) for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((r) => r.slice(n));
}

// ---------------------------------------------------------------------------------------------
// Ridge (TMDB slope almost unpenalised; alpha by exact leave-one-out inside the training data)
// ---------------------------------------------------------------------------------------------
export interface RidgeFit {
  columns: string[];
  mu: number[];
  sd: number[];
  yMean: number;
  alpha: number;
  /** Effect in stars of +1 standard deviation of each feature. */
  coefStd: number[];
  /** Raw weights on the (scaled) standardised features. */
  w: number[];
}

export function fitRidge(columns: string[], X: number[][], y: number[]): RidgeFit {
  const n = X.length;
  const p = columns.length;
  const ti = columns.indexOf("tmdb_vote");
  const mu = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const sd = Array.from({ length: p }, (_, j) => {
    const s = Math.sqrt(mean(X.map((r) => (r[j] - mu[j]) ** 2)));
    return s === 0 ? 1 : s;
  });
  const Z = X.map((r) => r.map((v, j) => ((v - mu[j]) / sd[j]) * (j === ti ? FREE_SCALE : 1)));
  const yMean = mean(y);
  const yc = y.map((v) => v - yMean);
  const G = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++) {
      b[j] += Z[i][j] * yc[i];
      for (let k = j; k < p; k++) G[j][k] += Z[i][j] * Z[i][k];
    }
  for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) G[j][k] = G[k][j];

  let best = { alpha: ALPHAS[0], mse: Infinity, w: [] as number[] };
  for (const alpha of ALPHAS) {
    const A = G.map((r, j) => r.map((v, k) => v + (j === k ? alpha : 0)));
    const inv = invert(A);
    const w = inv.map((r) => r.reduce((s, v, k) => s + v * b[k], 0));
    let mse = 0;
    for (let i = 0; i < n; i++) {
      const zi = Z[i];
      let pred = 0;
      let q = 0;
      for (let j = 0; j < p; j++) {
        pred += zi[j] * w[j];
        let t = 0;
        for (let k = 0; k < p; k++) t += inv[j][k] * zi[k];
        q += zi[j] * t;
      }
      const h = 1 / n + q;
      const e = (yc[i] - pred) / (1 - h);
      mse += e * e;
    }
    mse /= n;
    if (mse < best.mse) best = { alpha, mse, w };
  }
  const coefStd = best.w.map((v, j) => (j === ti ? v * FREE_SCALE : v));
  return { columns, mu, sd, yMean, alpha: best.alpha, coefStd, w: best.w };
}

const ridgeContrib = (f: RidgeFit, x: number[], j: number) => (f.coefStd[j] * (x[j] - f.mu[j])) / f.sd[j];
export const ridgePredict = (f: RidgeFit, x: number[]) => f.yMean + f.columns.reduce((s, _, j) => s + ridgeContrib(f, x, j), 0);

// ---------------------------------------------------------------------------------------------
// Fallback: TMDB score shifted to the user's mean + shrunk genre residuals
// ---------------------------------------------------------------------------------------------
export interface FallbackFit {
  columns: string[];
  mean: number;
  voteMean: number;
  genreDev: Map<string, number>;
}

export function fitFallback(columns: string[], X: number[][], y: number[]): FallbackFit {
  const vi = columns.indexOf("tmdb_vote");
  const m = mean(y);
  const voteMean = mean(X.map((r) => r[vi]));
  const resid = y.map((v, i) => v - (m + X[i][vi] - voteMean));
  const genreDev = new Map<string, number>();
  columns.forEach((c, j) => {
    if (!c.startsWith("genre_")) return;
    let s = 0;
    let k = 0;
    X.forEach((r, i) => {
      if (r[j] > 0) {
        s += resid[i];
        k++;
      }
    });
    genreDev.set(c, s / (k + GENRE_PRIOR_M));
  });
  return { columns, mean: m, voteMean, genreDev };
}

function fallbackParts(f: FallbackFit, x: number[]): { base: number; crowd: number; genres: { col: string; value: number }[] } {
  const vi = f.columns.indexOf("tmdb_vote");
  const on = [...f.genreDev].filter(([c]) => x[f.columns.indexOf(c)] > 0);
  return {
    base: f.mean,
    crowd: x[vi] - f.voteMean,
    genres: on.map(([col, d]) => ({ col, value: d / on.length })),
  };
}

export const fallbackPredict = (f: FallbackFit, x: number[]) => {
  const p = fallbackParts(f, x);
  return p.base + p.crowd + p.genres.reduce((s, g) => s + g.value, 0);
};

// ---------------------------------------------------------------------------------------------
// A trained model = encoder + (ridge | fallback)
// ---------------------------------------------------------------------------------------------
export class Predictor {
  constructor(
    readonly kind: ModelKind,
    readonly encoder: Encoder,
    readonly ridge: RidgeFit | null,
    readonly fallback: FallbackFit | null,
  ) {}

  predict(movie: Movie, filmYear: number | null = null): Prediction {
    const x = this.encoder.row(movie, filmYear);
    const parts: Part[] = [];
    let raw: number;
    if (this.kind === "personal" && this.ridge) {
      const f = this.ridge;
      raw = ridgePredict(f, x);
      f.columns.forEach((c, j) => {
        const v = ridgeContrib(f, x, j);
        if (c === "tmdb_vote") parts.push({ kind: "crowd", value: v, tmdb: movie.vote });
        else if (c === "director_te") {
          const top = [...this.encoder.devs("director", movie.directors)].sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0];
          parts.push({ kind: "director", value: v, label: top?.key });
        } else if (c === "cast_te") {
          const top = [...this.encoder.devs("cast", movie.cast)].sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0];
          parts.push({ kind: "cast", value: v, label: top?.key });
        } else if (c.startsWith("genre_")) parts.push({ kind: "genre", value: v, label: c.slice(6) });
        else if (c.startsWith("country_")) parts.push({ kind: "country", value: v, label: c.slice(8) });
        else if (c === "decade") parts.push({ kind: "decade", value: v });
        else if (c === "runtime") parts.push({ kind: "runtime", value: v });
        else if (c === "log_popularity") parts.push({ kind: "popularity", value: v });
        else if (c === "english") parts.push({ kind: "language", value: v });
      });
    } else {
      const f = this.fallback!;
      const p = fallbackParts(f, x);
      raw = p.base + p.crowd + p.genres.reduce((s, g) => s + g.value, 0);
      parts.push({ kind: "crowd", value: p.crowd, tmdb: movie.vote });
      for (const g of p.genres) parts.push({ kind: "genre", value: g.value, label: g.col.slice(6) });
    }
    parts.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { value: clip(raw), parts };
  }
}

/** Trains one model kind on all the samples (no cross-validation). */
export function trainFixed(samples: Sample[], kind: ModelKind): Predictor {
  const enc = new Encoder();
  const X = enc.fitTransform(samples);
  const y = samples.map((s) => s.rating);
  return kind === "personal"
    ? new Predictor("personal", enc, fitRidge(enc.columns, X, y), null)
    : new Predictor("fallback", enc, null, fitFallback(enc.columns, X, y));
}

// ---------------------------------------------------------------------------------------------
// Cross-validation on the user's own ratings
// ---------------------------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Fold = number[]; // indices of the test films

/** Repeated shuffled K-fold: returns the list of test-index folds. */
export function makeFolds(n: number, k = 5, repeats = 4, seed = 42): Fold[] {
  const folds: Fold[] = [];
  const kk = Math.max(2, Math.min(k, n));
  for (let r = 0; r < repeats; r++) {
    const rnd = mulberry32(seed + r);
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (let f = 0; f < kk; f++) folds.push(idx.filter((_, i) => i % kk === f));
  }
  return folds;
}

export interface CvResult {
  mae: number;
  /** Share (0–1) of predictions within half a star of the real rating. */
  within: number;
  foldMae: number[];
}

/** Evaluates the given model kinds on exactly the same folds. Features are rebuilt inside each fold. */
export function crossValidate(
  samples: Sample[],
  kinds: ModelKind[],
  opts: { folds?: Fold[]; onFold?: (done: number, total: number) => void } = {},
): Record<ModelKind, CvResult> {
  const n = samples.length;
  const folds = opts.folds ?? makeFolds(n);
  const acc: Record<string, { mae: number[]; within: number[] }> = {};
  for (const k of kinds) acc[k] = { mae: [], within: [] };
  folds.forEach((test, fi) => {
    const isTest = new Set(test);
    const train = samples.filter((_, i) => !isTest.has(i));
    const testS = test.map((i) => samples[i]);
    const enc = new Encoder();
    const Xtr = enc.fitTransform(train);
    const Xte = testS.map((s) => enc.row(s.movie, s.filmYear));
    const ytr = train.map((s) => s.rating);
    for (const k of kinds) {
      const preds =
        k === "personal"
          ? (() => {
              const f = fitRidge(enc.columns, Xtr, ytr);
              return Xte.map((x) => clip(ridgePredict(f, x)));
            })()
          : (() => {
              const f = fitFallback(enc.columns, Xtr, ytr);
              return Xte.map((x) => clip(fallbackPredict(f, x)));
            })();
      const errs = preds.map((p, i) => Math.abs(p - testS[i].rating));
      acc[k].mae.push(mean(errs));
      acc[k].within.push(mean(errs.map((e) => (e <= 0.5 + 1e-9 ? 1 : 0))));
    }
    opts.onFold?.(fi + 1, folds.length);
  });
  const out = {} as Record<ModelKind, CvResult>;
  for (const k of kinds) out[k] = { mae: mean(acc[k].mae), within: mean(acc[k].within), foldMae: acc[k].mae };
  return out;
}

export interface TrainedModel {
  predictor: Predictor;
  kind: ModelKind;
  n: number;
  /** Cross-validated error of the model in use. null if there are too few ratings to estimate it. */
  cv: CvResult | null;
  /** Both candidates, when both were evaluated (≥ MIN_PERSONAL ratings). */
  compared: { personal: CvResult; fallback: CvResult } | null;
}

/**
 * Picks and trains the model for one user:
 *  - fewer than 30 ratings → always the fallback;
 *  - 30 or more → cross-validate both; use the personal one if its MAE is ≤ the fallback's, else the fallback.
 */
export function trainBest(samples: Sample[], opts: { onProgress?: (p: number) => void } = {}): TrainedModel {
  const n = samples.length;
  const canCv = n >= 6;
  const onFold = (done: number, total: number) => opts.onProgress?.(0.05 + 0.85 * (done / total));
  opts.onProgress?.(0.02);
  let kind: ModelKind = "fallback";
  let cv: CvResult | null = null;
  let compared: TrainedModel["compared"] = null;
  if (n >= MIN_PERSONAL) {
    const r = crossValidate(samples, ["fallback", "personal"], { onFold });
    compared = { personal: r.personal, fallback: r.fallback };
    kind = r.personal.mae <= r.fallback.mae ? "personal" : "fallback";
    cv = r[kind];
  } else if (canCv) {
    cv = crossValidate(samples, ["fallback"], { onFold }).fallback;
  }
  const predictor = trainFixed(samples, kind);
  opts.onProgress?.(1);
  return { predictor, kind, n, cv, compared };
}
