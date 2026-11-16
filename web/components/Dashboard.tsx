"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { genreName } from "@/lib/genres";
import { posterUrl } from "@/lib/keys";
import { useI18n } from "@/lib/i18n";
import { computeStats, MIN_RATED, type Dim, type Group, type Opinion } from "@/lib/stats";
import type { Enriched, Profile } from "@/lib/types";
import { ShareCard } from "./ShareCard";
import { ModelNote, NextToWatch, PredictSearch, useRatingModel } from "./Predictor";

type DimKey = "directors" | "actors" | "genres" | "decades" | "countries";

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="mt-10"
    >
      <h2 className="text-4xl sm:text-5xl">{title}</h2>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket p-4 text-center">
      <div className="font-display text-5xl leading-none text-accent">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-muted">{label}</div>
    </div>
  );
}

function BarList({ items, label, value, max, detail }: { items: Group[]; label: (g: Group) => string; value: (g: Group) => number; max: number; detail: (g: Group) => string }) {
  return (
    <ol className="space-y-2">
      {items.map((g, i) => (
        <li key={g.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">
              <span className="mr-2 text-muted">{i + 1}</span>
              {label(g)}
            </span>
            <span className="shrink-0 text-muted">{detail(g)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (value(g) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function OpinionRow({ o, num, t }: { o: Opinion; num: (n: number, d?: number) => string; t: ReturnType<typeof useI18n>["t"] }) {
  const src = posterUrl(o.poster, "w92");
  return (
    <li className="flex items-center gap-3">
      <div className="h-[60px] w-10 shrink-0 overflow-hidden rounded bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote TMDB thumbnail */}
        {src && <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {o.title} <span className="text-muted">{o.year}</span>
        </p>
        <p className="text-sm text-muted">
          {t.yourRating} <b className="text-accent">{num(o.rating, 1)}</b> · {t.worldRating} {num(o.world, 1)}
        </p>
      </div>
      <span className={`shrink-0 font-display text-2xl ${o.diff > 0 ? "text-accent" : "text-red"}`}>
        {o.diff > 0 ? "+" : ""}
        {num(o.diff, 1)}
      </span>
    </li>
  );
}

export function Dashboard({
  profile,
  enr,
  onNew,
  onDelete,
  onRateMore,
}: {
  profile: Profile;
  enr: Map<string, Enriched>;
  onNew: () => void;
  onDelete: () => void;
  onRateMore?: () => void;
}) {
  const { t, lang, num } = useI18n();
  const stats = useMemo(() => computeStats(profile, enr), [profile, enr]);
  const model = useRatingModel(profile, enr);
  const [dim, setDim] = useState<DimKey>("directors");
  const [showReport, setShowReport] = useState(false);

  const regionNames = useMemo(() => new Intl.DisplayNames([lang], { type: "region" }), [lang]);
  const labelFor = (d: DimKey) => (g: Group) =>
    d === "genres" ? genreName(g.key, lang) : d === "decades" ? `${g.key}s` : d === "countries" ? (regionNames.of(g.key) ?? g.key) : g.key;

  const sourceLabel =
    profile.source === "quick" ? t.fromQuick : profile.source === "rss" ? t.fromRss(profile.username ?? "") : profile.source === "demo" ? t.fromDemo : t.fromZip;

  const dims: DimKey[] = ["directors", "actors", "genres", "decades", "countries"];
  const current: Dim = stats[dim];
  const minFor = MIN_RATED[dim];
  const tone =
    stats.tone === "generous"
      ? t.toneGenerous(num(Math.abs(stats.toneDelta ?? 0), 1))
      : stats.tone === "harsh"
        ? t.toneHarsh(num(Math.abs(stats.toneDelta ?? 0), 1))
        : stats.tone === "balanced"
          ? t.toneBalanced
          : t.toneUnknown;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl sm:text-7xl">{t.dnaTitle}</h1>
          <p className="text-muted">{sourceLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className="btn btn-ghost" onClick={() => setShowReport(true)}>
            {t.matchReport}
            {stats.report.length > 0 && <span className="rounded-full bg-red px-2 text-xs text-white">{stats.report.length}</span>}
          </button>
          <button className="btn btn-ghost" onClick={onNew}>
            {t.newAnalysis}
          </button>
          <button className="btn btn-ghost" onClick={onDelete}>
            {t.deleteData}
          </button>
        </div>
      </div>

      {stats.matchedRated < 20 && (
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">{t.lowData(stats.matchedRated)}</p>
      )}

      {/* 1. Summary */}
      <Section title={t.sumTitle}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t.watched} value={String(stats.watchedCount)} />
          <Tile label={t.rated} value={String(stats.ratedCount)} />
          <Tile label={t.avgRating} value={stats.avg ? num(stats.avg, 2) : "—"} />
          <Tile label={t.liked} value={profile.source === "zip" || profile.source === "demo" ? String(stats.likedCount) : "—"} />
        </div>
        <div className="ticket mt-4 p-4">
          <h3 className="text-2xl">{t.distTitle}</h3>
          <div className="mt-2 h-48" role="img" aria-label={t.distTitle}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dist} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#2c2836" />
                <XAxis dataKey="rating" tick={{ fill: "#a9a2b3", fontSize: 12 }} tickFormatter={(v: number) => num(v, 1)} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#a9a2b3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(242,177,52,0.08)" }} contentStyle={{ background: "#1d1a25", border: "1px solid #2c2836", borderRadius: 10 }} labelStyle={{ color: "#f4efe4" }} itemStyle={{ color: "#f2b134" }} labelFormatter={(v) => `${num(Number(v), 1)} ★`} formatter={(v) => [String(v), t.rated]} />
                <Bar dataKey="count" fill="#f2b134" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 font-medium">{tone}</p>
        </div>
      </Section>

      {/* 2. Taste */}
      <Section title={t.tasteTitle} sub={t.tasteSub}>
        {!stats.enough.dims ? (
          <Note>{t.notEnough}</Note>
        ) : (
          <>
            <div role="tablist" className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1">
              {dims.map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={dim === d}
                  onClick={() => setDim(d)}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${dim === d ? "border-accent bg-accent text-accent-ink" : "border-line hover:border-muted"}`}
                >
                  {t[d]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <div className="ticket min-w-0 p-4">
                <h3 className="text-2xl">
                  {t.byRating} <span className="text-sm text-muted">· {t.minNote(minFor)}</span>
                </h3>
                <p className="text-xs text-muted">
                  {t.bayesNote}{" "}
                  <span tabIndex={0} title={t.bayesTip} aria-label={t.bayesTip} className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-muted text-[10px]">
                    ?
                  </span>
                </p>
                <div className="mt-3">
                  {current.byRating.length ? (
                    <BarList items={current.byRating} label={labelFor(dim)} value={(g) => g.avg} max={5} detail={(g) => `${num(g.avg, 1)} ★ · ${t.filmsN(g.rated)}`} />
                  ) : (
                    <Note>{t.notEnough}</Note>
                  )}
                </div>
              </div>
              <div className="ticket min-w-0 p-4">
                <h3 className="text-2xl">{t.mostWatched}</h3>
                <div className="mt-3">
                  {current.byCount.length ? (
                    <BarList items={current.byCount} label={labelFor(dim)} value={(g) => g.n} max={current.byCount[0].n} detail={(g) => t.filmsN(g.n)} />
                  ) : (
                    <Note>{t.notEnough}</Note>
                  )}
                </div>
              </div>
            </div>
            {dim === "decades" && stats.decadeSeries.length > 1 && (
              <div className="ticket mt-4 p-4">
                <h3 className="text-2xl">{t.decadeChart}</h3>
                <div className="mt-2 h-48" role="img" aria-label={t.decadeChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.decadeSeries} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#2c2836" />
                      <XAxis dataKey="decade" tick={{ fill: "#a9a2b3", fontSize: 12 }} tickFormatter={(v: number) => `${v}s`} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 5]} tick={{ fill: "#a9a2b3", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "rgba(242,177,52,0.08)" }} contentStyle={{ background: "#1d1a25", border: "1px solid #2c2836", borderRadius: 10 }} labelStyle={{ color: "#f4efe4" }} itemStyle={{ color: "#f2b134" }} labelFormatter={(v) => `${v}s`} formatter={(v) => [`${num(Number(v), 1)} ★`, t.avgRating]} />
                      <Bar dataKey="avg" fill="#f2b134" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* 3. You vs. the world */}
      <Section title={t.worldTitle} sub={t.worldSub}>
        {!stats.enough.world ? (
          <Note>{t.worldNone}</Note>
        ) : (
          <>
            {stats.controversial && (
              <div className="ticket mb-4 border-red/50 p-4">
                <p className="text-xs uppercase tracking-widest text-red">{t.controversial}</p>
                <ul className="mt-2">
                  <OpinionRow o={stats.controversial} num={num} t={t} />
                </ul>
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <div className="ticket min-w-0 p-4">
                <h3 className="text-2xl text-accent">{t.worldUp}</h3>
                <ul className="mt-3 space-y-3">{stats.up.length ? stats.up.map((o) => <OpinionRow key={o.title + o.year} o={o} num={num} t={t} />) : <Note>{t.noneBeyond}</Note>}</ul>
              </div>
              <div className="ticket min-w-0 p-4">
                <h3 className="text-2xl text-red">{t.worldDown}</h3>
                <ul className="mt-3 space-y-3">{stats.down.length ? stats.down.map((o) => <OpinionRow key={o.title + o.year} o={o} num={num} t={t} />) : <Note>{t.noneBeyond}</Note>}</ul>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* 4. Quirks */}
      <Section title={t.quirksTitle} sub={t.quirksSub}>
        {!stats.enough.quirks ? (
          <Note>{t.quirksNone}</Note>
        ) : (
          <ul className="space-y-3">
            {stats.quirks.map((q) => {
              const [a, b] = t.quirkGroup[q.kind];
              const d = num(Math.abs(q.diff), 1);
              return (
                <li key={q.kind} className="ticket min-w-0 p-4">
                  <p className="text-xs uppercase tracking-widest text-muted">{t.quirkDim[q.kind]}</p>
                  <p className={`mt-1 ${q.notable ? "text-lg font-semibold" : "text-muted"}`}>
                    {q.notable ? (q.diff > 0 ? t.quirkLine(d, a[0], b[1]) : t.quirkLine(d, b[0], a[1])) : t.quirkNeutral(t.quirkDim[q.kind], d)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 5. How many stars would I give it? */}
      <Section title={t.predTitle} sub={t.predSub}>
        <PredictSearch model={model} onRateMore={onRateMore} />
      </Section>

      {/* 6. Watchlist (zip only) */}
      {(profile.source === "zip" || profile.source === "demo") && (
        <Section title={t.wlTitle}>
          {stats.watchlist ? (
            <div className="ticket min-w-0 p-4">
              <p className="font-display text-5xl text-accent">{stats.watchlist.count}</p>
              <p className="text-muted">{t.wlCount(stats.watchlist.count)}</p>
              {stats.watchlist.genres.length > 0 && (
                <>
                  <h3 className="mt-4 text-2xl">{t.wlGenres}</h3>
                  <div className="mt-3">
                    <BarList
                      items={stats.watchlist.genres.map((g) => ({ key: g.key, n: g.n, avg: 0, rated: 0, adj: 0 }))}
                      label={(g) => genreName(g.key, lang)}
                      value={(g) => g.n}
                      max={stats.watchlist.genres[0].n}
                      detail={(g) => t.filmsN(g.n)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <Note>{t.wlOnlyZip}</Note>
          )}
        </Section>
      )}

      {/* 7. Watchlist ranked by predicted rating */}
      {(profile.source === "zip" || profile.source === "demo") && stats.watchlist && (
        <Section title={t.nextTitle} sub={t.nextSub}>
          <NextToWatch profile={profile} enr={enr} model={model} />
          <ModelNote model={model} onRateMore={onRateMore} />
        </Section>
      )}

      {/* 8. Share card */}
      <Section title={t.cardTitle} sub={t.cardSub}>
        <ShareCard stats={stats} />
      </Section>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t.reportTitle} onClick={() => setShowReport(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-3xl">{t.reportTitle}</h2>
              <button className="btn btn-ghost" onClick={() => setShowReport(false)} autoFocus>
                {t.close}
              </button>
            </div>
            {stats.report.length === 0 ? (
              <p className="mt-4 text-muted">{t.reportNone}</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {stats.report.map((r, i) => (
                  <li key={i} className="border-b border-line pb-2">
                    <p className="font-medium">
                      {r.title} <span className="text-muted">{r.year}</span>
                    </p>
                    <p className={r.status === "notfound" ? "text-red" : "text-accent"}>
                      {r.status === "notfound" ? t.reportNotFound : t.reportDoubtful}
                      {r.matched && <span className="text-muted"> · {t.reportAs(r.matched)}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
