"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { enrichAll } from "@/lib/enrich";
import { genreName } from "@/lib/genres";
import { useI18n } from "@/lib/i18n";
import { filmKey, posterUrl } from "@/lib/keys";
import { LOW_VOTES, type Part, type Prediction, type Sample } from "@/lib/model";
import type { ModelHandle } from "@/lib/modelClient";
import { trainModel } from "@/lib/modelClient";
import type { PredictItem, TrainInfo } from "@/lib/modelEngine";
import type { Enriched, Movie, Profile } from "@/lib/types";
import { StaticStars } from "./Stars";

/** Smallest number of rated films for which we try to predict at all. */
const MIN_FOR_MODEL = 6;
const MIN_PERSONAL = 30;

export interface RatingModel {
  status: "training" | "ready" | "toofew" | "error";
  progress: number;
  info: TrainInfo | null;
  handle: ModelHandle | null;
  /** movie id → the user's own rating */
  ratedById: Map<number, number>;
}

/** Trains the model in a Web Worker whenever the user's ratings change. */
export function useRatingModel(profile: Profile, enr: Map<string, Enriched>): RatingModel {
  const { samples, ratedById } = useMemo(() => {
    const samples: Sample[] = [];
    const ratedById = new Map<number, number>();
    for (const f of profile.rated) {
      const m = enr.get(filmKey(f))?.movie;
      if (!f.rating || !m || ratedById.has(m.id)) continue;
      ratedById.set(m.id, f.rating);
      samples.push({ movie: m, filmYear: f.year, rating: f.rating });
    }
    return { samples, ratedById };
  }, [profile, enr]);

  const [done, setDone] = useState<{ samples: Sample[]; handle: ModelHandle | null; error: boolean } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (samples.length < MIN_FOR_MODEL) return;
    let alive = true;
    let handle: ModelHandle | null = null;
    const { promise, cancel } = trainModel(samples, (p) => alive && setProgress(p));
    promise
      .then((h) => {
        if (!alive) return h.dispose();
        handle = h;
        setDone({ samples, handle: h, error: false });
      })
      .catch(() => alive && setDone({ samples, handle: null, error: true }));
    return () => {
      alive = false;
      cancel();
      handle?.dispose();
    };
  }, [samples]);

  const current = done && done.samples === samples ? done : null;
  const status: RatingModel["status"] =
    samples.length < MIN_FOR_MODEL ? "toofew" : current ? (current.error ? "error" : "ready") : "training";
  return { status, progress, info: current?.handle?.info ?? null, handle: current?.handle ?? null, ratedById };
}

/** Plain-language description of the model in use and how accurate it is. */
export function ModelNote({ model, onRateMore }: { model: RatingModel; onRateMore?: () => void }) {
  const { t, num } = useI18n();
  const info = model.info;
  if (!info) return null;
  const cv = info.cv;
  return (
    <div className="mt-4 space-y-1 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
      <p className="font-semibold">{info.kind === "personal" ? t.predModelPersonal(info.n) : t.predModelSimple}</p>
      <p className="text-muted">{cv ? t.predAccuracy(num(cv.mae, 1), Math.round(cv.within * 10)) : t.predAccuracyNone}</p>
      {info.compared && (
        <p className="text-xs text-muted">
          {t.predCompared(num(info.compared.personal.mae, 2), num(info.compared.fallback.mae, 2))} {info.kind === "personal" ? t.predWhyPersonal : t.predWhySimple}
        </p>
      )}
      {info.n < MIN_PERSONAL && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <p className="font-medium text-accent">{t.predMore}</p>
          {onRateMore && (
            <button className="btn btn-primary" onClick={onRateMore}>
              {t.predRateMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MINUS = "−";

function useReason() {
  const { t, lang, num } = useI18n();
  const regions = useMemo(() => new Intl.DisplayNames([lang], { type: "region" }), [lang]);
  return (p: Part): { sign: string; amount: string; text: string } => {
    const text =
      p.kind === "crowd"
        ? t.reasonCrowd(num((p.tmdb ?? 0) , 1))
        : p.kind === "director"
          ? t.reasonDirector(p.label ?? "")
          : p.kind === "cast"
            ? t.reasonCast(p.label ?? "")
            : p.kind === "genre"
              ? t.reasonGenre(genreName(p.label ?? "", lang).toLowerCase())
              : p.kind === "decade"
                ? t.reasonDecade
                : p.kind === "runtime"
                  ? t.reasonRuntime
                  : p.kind === "popularity"
                    ? t.reasonPopularity
                    : p.kind === "language"
                      ? t.reasonLanguage
                      : t.reasonCountry(regions.of(p.label ?? "") ?? p.label ?? "");
    return { sign: p.value >= 0 ? "+" : MINUS, amount: num(Math.abs(p.value), 1), text };
  };
}

/**
 * Parts big enough to show (≥ 0.05★), strongest first. The TMDB score usually dominates, so if it would
 * take every slot we keep the strongest other effect (genre, director…) so reasons are varied.
 */
function topParts(pred: Prediction, n: number): Part[] {
  const big = pred.parts.filter((p) => Math.abs(p.value) >= 0.05);
  const out = big.slice(0, n);
  const other = big.find((p) => p.kind !== "crowd");
  if (n > 1 && other && !out.includes(other)) out[n - 1] = other;
  return out;
}

const lowVotes = (m: Movie) => m.votes < LOW_VOTES;

function LowVotes() {
  const { t } = useI18n();
  return <p className="text-xs font-medium text-red">⚠ {t.predLowVotes}</p>;
}

function Poster({ path, w, h, size }: { path: string | null; w: number; h: number; size: string }) {
  const src = posterUrl(path, size);
  return (
    <div className="shrink-0 overflow-hidden rounded bg-surface-2" style={{ width: w, height: h }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote TMDB poster */}
      {src && <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />}
    </div>
  );
}

interface Hit {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
}

export function PredictSearch({ model, onRateMore }: { model: RatingModel; onRateMore?: () => void }) {
  const { t, num } = useI18n();
  const reason = useReason();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [picked, setPicked] = useState<{ movie: Movie; pred: Prediction | null; failed?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctl = useRef<AbortController | null>(null);

  if (model.status === "toofew") return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t.predTooFew}</p>;
  if (model.status === "error") return <p className="text-red">{t.predTrainError}</p>;
  if (model.status === "training")
    return (
      <div aria-live="polite">
        <p className="text-muted">{t.predTraining}</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(model.progress * 100)} className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(3, model.progress * 100)}%` }} />
        </div>
      </div>
    );

  const search = (text: string) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setSearching(true);
    setSearchError(false);
    fetch(`/api/tmdb/search?q=${encodeURIComponent(text)}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("search_failed"))))
      .then((d: { results: Hit[] }) => {
        setHits(d.results);
        setSearching(false);
      })
      .catch(() => {
        if (c.signal.aborted) return;
        setSearchError(true);
        setSearching(false);
      });
  };

  const onChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      ctl.current?.abort();
      setHits(null);
      setSearching(false);
      return;
    }
    timer.current = setTimeout(() => search(v.trim()), 350);
  };

  const choose = async (h: Hit) => {
    setHits(null);
    setQ(`${h.title}${h.year ? ` (${h.year})` : ""}`);
    setPicked({ movie: { id: h.id, title: h.title, year: h.year, genres: [], directors: [], cast: [], runtime: null, countries: [], lang: null, vote: 0, votes: 0, popularity: 0, poster: h.poster }, pred: null });
    try {
      const film = { title: h.title, year: h.year, tmdbId: h.id };
      const movie = (await enrichAll([film])).get(filmKey(film))?.movie;
      if (!movie || !model.handle) throw new Error("no_movie");
      const [pred] = await model.handle.predict([{ movie, filmYear: movie.year, excludeId: model.ratedById.has(movie.id) ? movie.id : undefined }]);
      setPicked({ movie, pred });
    } catch {
      setPicked((p) => (p ? { ...p, failed: true } : p));
    }
  };

  const real = picked ? model.ratedById.get(picked.movie.id) : undefined;
  const mae = model.info?.cv?.mae;
  const shown = picked?.pred ? topParts(picked.pred, 3) : [];

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.predSearch}
          aria-label={t.predSearch}
          autoComplete="off"
          maxLength={100}
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-accent"
        />
        {(searching || hits || searchError) && (
          <ul className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-xl" role="listbox">
            {searching && <li className="p-3 text-sm text-muted">{t.predSearching}</li>}
            {searchError && <li className="p-3 text-sm text-red">{t.predSearchError}</li>}
            {!searching && hits && hits.length === 0 && <li className="p-3 text-sm text-muted">{t.predNoResults}</li>}
            {!searching &&
              hits?.map((h) => (
                <li key={h.id} role="option" aria-selected={false}>
                  <button className="flex w-full items-center gap-3 p-2 text-left hover:bg-surface-2" onClick={() => choose(h)}>
                    <Poster path={h.poster} w={32} h={48} size="w92" />
                    <span className="min-w-0 truncate font-medium">
                      {h.title} <span className="text-muted">{h.year}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {picked && (
        <div className="ticket mt-4 flex flex-col gap-4 p-4 sm:flex-row">
          <Poster path={picked.movie.poster} w={120} h={180} size="w185" />
          <div className="min-w-0 flex-1">
            <h3 className="text-3xl leading-tight">
              {picked.movie.title} <span className="text-muted">{picked.movie.year}</span>
            </h3>
            {!picked.pred ? (
              <p className="mt-2 text-muted">{picked.failed ? t.predSearchError : t.predLoading}</p>
            ) : (
              <>
                <p className="mt-3 text-xs uppercase tracking-widest text-muted">{t.predYouWould}</p>
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-6xl leading-none text-accent">{num(picked.pred.value, 1)}</span>
                  <span className="text-2xl">
                    <StaticStars value={Math.round(picked.pred.value * 2) / 2} />
                  </span>
                  {mae !== undefined && <span className="text-lg text-muted">±{num(mae, 1)}</span>}
                </p>
                {lowVotes(picked.movie) && <LowVotes />}
                {real !== undefined && (
                  <p className="mt-2 rounded-lg bg-accent/10 p-2 text-sm font-medium">
                    {t.predAlready(num(picked.pred.value, 1), num(real, 1))}
                    <span className="block text-xs font-normal text-muted">{t.predAlreadyNote}</span>
                  </p>
                )}
                {shown.length > 0 && (
                  <>
                    <h4 className="mt-4 text-xl">{t.predReasons}</h4>
                    <ul className="mt-1 space-y-1">
                      {shown.map((p, i) => {
                        const r = reason(p);
                        return (
                          <li key={i} className="flex gap-2">
                            <b className={`w-12 shrink-0 text-right font-display text-xl ${p.value >= 0 ? "text-accent" : "text-red"}`}>
                              {r.sign}
                              {r.amount}
                            </b>
                            <span>{r.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <ModelNote model={model} onRateMore={onRateMore} />
    </div>
  );
}

interface Ranked {
  movie: Movie;
  pred: Prediction;
}

export function NextToWatch({ profile, enr, model }: { profile: Profile; enr: Map<string, Enriched>; model: RatingModel }) {
  const { t, num } = useI18n();
  const reason = useReason();
  const [rows, setRows] = useState<Ranked[] | null>(null);
  const [all, setAll] = useState(false);

  const items = useMemo(() => {
    const seen = new Set<number>();
    const out: PredictItem[] = [];
    for (const f of profile.watchlist) {
      const m = enr.get(filmKey(f))?.movie;
      if (!m || seen.has(m.id) || model.ratedById.has(m.id)) continue;
      seen.add(m.id);
      out.push({ movie: m, filmYear: f.year });
    }
    return out;
  }, [profile, enr, model.ratedById]);

  useEffect(() => {
    if (model.status !== "ready" || !model.handle) return;
    let alive = true;
    model.handle
      .predict(items)
      .then((preds) => {
        if (!alive) return;
        // Films with very few TMDB votes are never ranked above the reliable ones just because of a noisy score.
        const key = (r: Ranked) => (lowVotes(r.movie) ? 0 : 1);
        setRows(items.map((it, i) => ({ movie: it.movie, pred: preds[i] })).sort((a, b) => key(b) - key(a) || b.pred.value - a.pred.value));
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [model.status, model.handle, items]);

  if (model.status === "toofew") return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t.predTooFew}</p>;
  if (model.status === "error") return <p className="text-red">{t.predTrainError}</p>;
  if (model.status === "training" || rows === null) return <p className="text-muted">{t.predTraining}</p>;
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{t.nextNone}</p>;

  const visible = all ? rows : rows.slice(0, 10);
  return (
    <div>
      <ol className="space-y-3">
        {visible.map((r, i) => {
          const whys = topParts(r.pred, 2).map((p) => ({ p, ...reason(p) }));
          return (
            <li key={r.movie.id} className="ticket flex items-center gap-3 p-3">
              <span className="w-6 shrink-0 text-center font-display text-2xl text-muted">{i + 1}</span>
              <Poster path={r.movie.poster} w={48} h={72} size="w92" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {r.movie.title} <span className="text-muted">{r.movie.year}</span>
                </p>
                {whys.map((w, k) => (
                  <p key={k} className="text-sm text-muted">
                    <b className={w.p.value >= 0 ? "text-accent" : "text-red"}>
                      {w.sign}
                      {w.amount}
                    </b>{" "}
                    {w.text}
                  </p>
                ))}
                {lowVotes(r.movie) && <LowVotes />}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-4xl leading-none text-accent">{num(r.pred.value, 1)}</div>
                <div className="text-sm">
                  <StaticStars value={Math.round(r.pred.value * 2) / 2} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length > 10 && (
        <button className="btn btn-ghost mt-4" onClick={() => setAll((v) => !v)}>
          {all ? t.nextShowLess : t.nextShowAll(rows.length)}
        </button>
      )}
    </div>
  );
}
