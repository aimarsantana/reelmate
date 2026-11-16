"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CURATED, orderFor } from "@/lib/curated";
import { enrichAll } from "@/lib/enrich";
import { filmKey, posterUrl } from "@/lib/keys";
import { genreName, PICKABLE_GENRES } from "@/lib/genres";
import { useI18n } from "@/lib/i18n";
import { lsGet, lsSet } from "@/lib/storage";
import type { Film, Profile } from "@/lib/types";
import { StarRating } from "./Stars";

const GOAL = 15;
const MIN = 10;
const FIRST_BATCH = 18;
const MORE = 10;

interface Saved {
  genres: number[];
  order: number[];
  answers: Record<number, number>; // 0 = not seen
  pos: number;
  shown: number;
}

const EMPTY: Saved = { genres: [], order: [], answers: {}, pos: 0, shown: FIRST_BATCH };

const asFilm = (i: number): Film => ({ title: CURATED[i].title, year: CURATED[i].year });

export function QuickStart({ onDone, onBack }: { onDone: (p: Profile) => void; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [s, setS] = useState<Saved>(() => lsGet<Saved>("quick", EMPTY));
  const [posters, setPosters] = useState<Record<string, string | null>>({});

  useEffect(() => lsSet("quick", s), [s]);

  const step = s.order.length ? "rate" : "genres";
  const ratedCount = Object.values(s.answers).filter((v) => v > 0).length;
  const end = Math.min(s.shown, s.order.length);
  const current = s.pos < end ? s.order[s.pos] : null;

  // Prefetch posters for the cards about to be shown (cached in IndexedDB for the analysis later).
  useEffect(() => {
    if (step !== "rate") return;
    const upcoming = s.order.slice(s.pos, Math.min(s.pos + 4, end)).filter((i) => !(filmKey(asFilm(i)) in posters));
    if (!upcoming.length) return;
    let cancelled = false;
    enrichAll(upcoming.map(asFilm))
      .then((map) => {
        if (cancelled) return;
        setPosters((p) => {
          const n = { ...p };
          for (const i of upcoming) n[filmKey(asFilm(i))] = map.get(filmKey(asFilm(i)))?.movie?.poster ?? null;
          return n;
        });
      })
      .catch(() => {
        if (!cancelled)
          setPosters((p) => {
            const n = { ...p };
            for (const i of upcoming) n[filmKey(asFilm(i))] = null;
            return n;
          });
      });
    return () => {
      cancelled = true;
    };
  }, [step, s.pos, s.order, end, posters]);

  const toggleGenre = (g: number) =>
    setS((x) => {
      const has = x.genres.includes(g);
      if (!has && x.genres.length >= 4) return x;
      return { ...x, genres: has ? x.genres.filter((y) => y !== g) : [...x.genres, g] };
    });

  const start = () => setS((x) => ({ ...x, order: orderFor(x.genres), pos: 0, answers: {}, shown: FIRST_BATCH }));

  const answer = (v: number) => {
    if (current === null) return;
    setS((x) => ({ ...x, answers: { ...x.answers, [current]: v }, pos: x.pos + 1 }));
  };

  const undo = () =>
    setS((x) => {
      if (x.pos === 0) return x;
      const prev = x.order[x.pos - 1];
      const answers = { ...x.answers };
      delete answers[prev];
      return { ...x, pos: x.pos - 1, answers };
    });

  const finish = () => {
    const rated: Film[] = Object.entries(s.answers)
      .filter(([, v]) => v > 0)
      .map(([i, v]) => ({ ...asFilm(Number(i)), rating: v }));
    onDone({ source: "quick", rated, watched: rated.map((f) => ({ title: f.title, year: f.year })), watchlist: [], createdAt: Date.now() });
  };

  if (step === "genres") {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 sm:px-6" aria-labelledby="q-title">
        <button onClick={onBack} className="mb-4 text-sm text-muted hover:text-fg">
          ← {t.back}
        </button>
        <h2 id="q-title" className="text-4xl sm:text-5xl">
          {t.qGenresTitle}
        </h2>
        <p className="mt-2 text-muted">{t.qGenresSub}</p>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={t.qGenresTitle}>
          {PICKABLE_GENRES.map((g) => {
            const on = s.genres.includes(g);
            const locked = !on && s.genres.length >= 4;
            return (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                aria-pressed={on}
                disabled={locked}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
                  on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-muted"
                } ${locked ? "opacity-40" : ""}`}
              >
                {genreName(g, lang)}
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex items-center gap-4">
          <button className="btn btn-primary" disabled={s.genres.length < 2} onClick={start}>
            {t.qStart} →
          </button>
          <span className="text-sm text-muted">{t.qSelected(s.genres.length)}</span>
        </div>
      </section>
    );
  }

  const pct = Math.min(100, (ratedCount / GOAL) * 100);
  const canFinish = ratedCount >= MIN;

  return (
    <section className="mx-auto w-full max-w-md px-4 sm:px-6" aria-labelledby="q-title">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <button onClick={() => setS(EMPTY)} className="hover:text-fg">
          ← {t.back}
        </button>
        <button onClick={undo} disabled={s.pos === 0} className="hover:text-fg disabled:opacity-40">
          ↶ {t.qUndo}
        </button>
      </div>
      <h2 id="q-title" className="sr-only">
        {t.qRateTitle}
      </h2>

      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{t.qProgress(ratedCount, GOAL)}</span>
        <span className="text-muted">{canFinish ? "✓" : t.qUnlock}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={GOAL}
        aria-valuenow={Math.min(ratedCount, GOAL)}
        className="mb-5 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <motion.div className="h-full bg-accent" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <AnimatePresence mode="wait">
        {current !== null ? (
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.18 }}
            className="ticket overflow-hidden"
          >
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[260px] overflow-hidden bg-surface-2 sm:max-w-[300px]">
              {posters[filmKey(asFilm(current))] ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote TMDB poster, tiny, no optimisation needed
                <img src={posterUrl(posters[filmKey(asFilm(current))])!} alt={`Poster: ${CURATED[current].title}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <span className="font-display text-4xl leading-tight">{CURATED[current].title}</span>
                </div>
              )}
            </div>
            <div className="p-5 text-center">
              <h3 className="text-3xl leading-tight">{CURATED[current].title}</h3>
              <p className="mt-1 text-sm text-muted">
                {CURATED[current].year} · {CURATED[current].genres.slice(0, 3).map((g) => genreName(g, lang)).join(" · ")}
              </p>
              <div className="mt-4">
                <StarRating key={current} onChange={answer} />
              </div>
              <button onClick={() => answer(0)} className="btn btn-ghost mt-4 w-full">
                {t.qNotSeen}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ticket p-6 text-center">
            <p className="text-lg">{s.shown < s.order.length ? t.qEndOfBatch : t.qNoMore}</p>
            {s.shown < s.order.length && (
              <button className="btn btn-ghost mt-4 w-full" onClick={() => setS((x) => ({ ...x, shown: x.shown + MORE }))}>
                {t.qMore}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex flex-col gap-3">
        {current !== null && s.shown < s.order.length && s.pos >= end - 3 && (
          <button className="btn btn-ghost" onClick={() => setS((x) => ({ ...x, shown: x.shown + MORE }))}>
            {t.qMore}
          </button>
        )}
        <button className="btn btn-primary" disabled={!canFinish} onClick={finish}>
          {t.qSeen} →
        </button>
      </div>
    </section>
  );
}
