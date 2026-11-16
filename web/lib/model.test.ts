import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  Encoder,
  MIN_PERSONAL,
  adjustedVote,
  clip,
  crossValidate,
  fitFallback,
  fitRidge,
  fallbackPredict,
  makeFolds,
  ridgePredict,
  trainBest,
  trainFixed,
  type Sample,
} from "./model";
import type { Movie } from "./types";
import ref from "./__fixtures__/python-reference.json";

/* ---------- Equivalence with the Python research (analysis/) ---------- */
// The dataset (raw TMDB data) is not committed: regenerate it with analysis/src/build_dataset.py.
const DATA = path.resolve(__dirname, "../../analysis/data/films.json");

interface Row {
  split: string;
  status: string;
  year_lb: number | null;
  rating: number;
  tmdb_id: number;
  tmdb_title: string;
  year: number | null;
  genres: number[];
  directors: string[];
  cast: string[];
  runtime: number | null;
  countries: string[];
  lang: string | null;
  vote: number;
  votes: number;
  popularity: number;
  poster: string | null;
}

function loadSamples(): Sample[] {
  const rows = (JSON.parse(readFileSync(DATA, "utf-8")) as Row[]).filter((r) => r.split === "rated" && r.status !== "notfound");
  return rows.map((r) => ({
    rating: r.rating,
    filmYear: r.year_lb,
    movie: {
      id: r.tmdb_id,
      title: r.tmdb_title,
      year: r.year,
      genres: r.genres,
      directors: r.directors,
      cast: r.cast,
      runtime: r.runtime,
      countries: r.countries,
      lang: r.lang,
      vote: r.vote,
      votes: r.votes,
      popularity: r.popularity,
      poster: r.poster,
    },
  }));
}

describe.skipIf(!existsSync(DATA))("TypeScript model ≡ Python model (same 50 folds)", () => {
  const samples = existsSync(DATA) ? loadSamples() : [];
  const folds = ref.folds.map((f) => f.test);

  it("uses the same dataset as the Python run", () => {
    expect(samples.length).toBe(ref.n);
  });

  it("gets the same MAE on every fold (Ridge and fallback)", () => {
    const r = crossValidate(samples, ["personal", "fallback"], { folds });
    // Mean over 50 folds: should match to ~1e-6; allow 0.002★ ("approximately the same MAE").
    expect(Math.abs(r.personal.mae - ref.ridge.meanMae)).toBeLessThan(0.002);
    expect(Math.abs(r.fallback.mae - ref.fallback.meanMae)).toBeLessThan(0.002);
    r.personal.foldMae.forEach((m, i) => expect(Math.abs(m - ref.ridge.mae[i])).toBeLessThan(0.002));
    console.log(
      `TS Ridge MAE ${r.personal.mae.toFixed(4)} (Python ${ref.ridge.meanMae.toFixed(4)}) · TS fallback ${r.fallback.mae.toFixed(4)} (Python ${ref.fallback.meanMae.toFixed(4)})`,
    );
  });

  it("predicts the same out-of-fold ratings as Python (first repetition)", () => {
    const rep0 = ref.folds.filter((f) => f.repeat === 0);
    for (const kind of ["ridge", "fallback"] as const) {
      const oof = ref[kind].oofRep0;
      let maxDiff = 0;
      for (const f of rep0) {
        const test = new Set(f.test);
        const train = samples.filter((_, i) => !test.has(i));
        const enc = new Encoder();
        const X = enc.fitTransform(train);
        const y = train.map((s) => s.rating);
        const fit = kind === "ridge" ? fitRidge(enc.columns, X, y) : fitFallback(enc.columns, X, y);
        for (const i of f.test) {
          const x = enc.row(samples[i].movie, samples[i].filmYear);
          const p = clip(kind === "ridge" ? ridgePredict(fit as ReturnType<typeof fitRidge>, x) : fallbackPredict(fit as ReturnType<typeof fitFallback>, x));
          maxDiff = Math.max(maxDiff, Math.abs(p - oof[i]));
        }
      }
      expect(maxDiff).toBeLessThan(1e-4);
    }
  });

  it("learns the same full-data Ridge (alpha and coefficients)", () => {
    const enc = new Encoder();
    const X = enc.fitTransform(samples);
    const fit = fitRidge(enc.columns, X, samples.map((s) => s.rating));
    expect(enc.columns).toEqual(ref.full.columns);
    expect(fit.alpha).toBeCloseTo(ref.full.alpha, 6);
    fit.coefStd.forEach((c, j) => expect(Math.abs(c - ref.full.coefStd[j])).toBeLessThan(1e-6));
  });
});

/* ---------- Behaviour tests with synthetic data (always run) ---------- */
function movie(i: number, over: Partial<Movie> = {}): Movie {
  return {
    id: i,
    title: `Film ${i}`,
    year: 1990 + (i % 30),
    genres: [i % 2 ? 18 : 35],
    directors: [`Director ${i % 7}`],
    cast: [`Actor ${i % 11}`, `Actor ${(i + 3) % 11}`],
    runtime: 90 + (i % 40),
    countries: ["US"],
    lang: "en",
    vote: 5 + (i % 5),
    votes: 1000,
    popularity: 10 + i,
    poster: null,
    ...over,
  };
}
const synth = (n: number): Sample[] =>
  Array.from({ length: n }, (_, i) => ({ movie: movie(i), filmYear: null, rating: Math.min(5, Math.max(0.5, 1 + (5 + (i % 5)) / 2 + (i % 2 ? 0.5 : 0) - 1)) }));

describe("model behaviour", () => {
  it("target encoding never contains the film's own rating (leave-one-out)", () => {
    // One director with a single film rated 5: its own encoding must be 0 ("no information"), not positive.
    const s = synth(40);
    s[0] = { ...s[0], movie: movie(0, { directors: ["Only Once"] }), rating: 5 };
    const enc = new Encoder();
    const X = enc.fitTransform(s);
    expect(X[0][enc.columns.indexOf("director_te")]).toBe(0);
    // ...while a *new* film by that director is encoded with the (shrunk) positive effect.
    const fresh = enc.row(movie(999, { directors: ["Only Once"] }), null)[enc.columns.indexOf("director_te")];
    expect(fresh).toBeGreaterThan(0);
    expect(fresh).toBeLessThan(5 - enc.C); // Bayesian shrinkage: far from "this director = 5"
  });

  it("shrinks TMDB scores towards the global mean according to the number of votes", () => {
    expect(adjustedVote(10, 1)).toBeCloseTo(6.5, 1); // a perfect score from one vote is almost "no information"
    expect(adjustedVote(8, 100000)).toBeCloseTo(8, 1); // lots of votes: the score is kept
    expect(adjustedVote(8, 500)).toBeCloseTo(7.25, 6); // (500·8 + 500·6.5) / 1000
    expect(adjustedVote(3, 0)).toBe(6.5);
  });

  it("folds partition the data in every repetition", () => {
    const folds = makeFolds(23, 5, 3, 1);
    expect(folds).toHaveLength(15);
    for (let r = 0; r < 3; r++) {
      const all = folds.slice(r * 5, r * 5 + 5).flat().sort((a, b) => a - b);
      expect(all).toEqual(Array.from({ length: 23 }, (_, i) => i));
    }
  });

  it("uses the fallback below 30 ratings and decides by cross-validation from 30 on (personal if its MAE ≤ the fallback's)", () => {
    const small = trainBest(synth(MIN_PERSONAL - 1));
    expect(small.kind).toBe("fallback");
    expect(small.compared).toBeNull();
    const big = trainBest(synth(MIN_PERSONAL + 20));
    expect(big.compared).not.toBeNull();
    expect(["personal", "fallback"]).toContain(big.kind);
    const c = big.compared!;
    expect(big.kind).toBe(c.personal.mae <= c.fallback.mae ? "personal" : "fallback");
    expect(big.cv).not.toBeNull();
  });

  it("explains a prediction with parts that add up to it (when not clipped)", () => {
    const s = synth(60);
    for (const kind of ["personal", "fallback"] as const) {
      const p = trainFixed(s, kind);
      const pred = p.predict(movie(5));
      const base = kind === "personal" ? p.ridge!.yMean : p.fallback!.mean;
      const sum = base + pred.parts.reduce((a, x) => a + x.value, 0);
      expect(pred.value).toBeCloseTo(clip(sum), 6);
    }
  });
});
