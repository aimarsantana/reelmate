"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useI18n } from "@/lib/i18n";
import { genreName } from "@/lib/genres";
import type { Stats } from "@/lib/stats";
import { Logo } from "./Chrome";

const W = 540;
const H = 675;

export function ShareCard({ stats }: { stats: Stats }) {
  const { t, lang, num } = useI18n();
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dir = stats.directors.byRating[0];
  const genre = stats.genres.byRating[0];
  const dec = stats.decades.byRating[0];
  const hot = stats.controversial;
  const rows: [string, string][] = [
    [t.cardDirector, dir?.key ?? t.cardUnknown],
    [t.cardGenre, genre ? genreName(genre.key, lang) : t.cardUnknown],
    [t.cardDecade, dec ? `${dec.key}s` : t.cardUnknown],
    [t.cardAvg, stats.avg ? `${num(stats.avg, 2)} ★` : t.cardUnknown],
  ];

  const download = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      const url = await toPng(card.current, { pixelRatio: 2, cacheBust: true, style: { transform: "none" } });
      const a = document.createElement("a");
      a.href = url;
      a.download = "reelmate-ficha.png";
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={box} className="w-full max-w-[540px]" style={{ height: H * scale }}>
        <div
          ref={card}
          style={{
            width: W,
            height: H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "radial-gradient(600px 360px at 50% -40px, #3b2a09 0%, #0b0a0e 72%)",
            border: "2px solid #f2b134",
            borderRadius: 24,
            padding: 36,
            display: "flex",
            flexDirection: "column",
            color: "#f4efe4",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={40} />
            <span className="font-display" style={{ fontSize: 34, letterSpacing: 3 }}>
              REELMATE
            </span>
          </div>
          <div className="font-display" style={{ fontSize: 64, lineHeight: 1, marginTop: 22, color: "#f2b134" }}>
            {t.dnaTitle.toUpperCase()}
          </div>
          <div style={{ marginTop: 22, borderTop: "2px dashed #4a4254" }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "13px 0", borderBottom: "2px dashed #4a4254", gap: 12 }}>
                <span style={{ color: "#a9a2b3", fontSize: 15, textTransform: "uppercase", letterSpacing: 2 }}>{k}</span>
                <span className="font-display" style={{ fontSize: 34, textAlign: "right", lineHeight: 1.05 }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22, background: "#1d1a25", borderRadius: 16, padding: 18 }}>
            <div style={{ color: "#e5484d", fontSize: 14, textTransform: "uppercase", letterSpacing: 2 }}>{t.cardHot}</div>
            {hot ? (
              <>
                <div className="font-display" style={{ fontSize: 30, marginTop: 4, lineHeight: 1.1 }}>
                  {hot.title} {hot.year ? `(${hot.year})` : ""}
                </div>
                <div style={{ color: "#a9a2b3", fontSize: 16, marginTop: 4 }}>{t.cardYouVs(num(hot.rating, 1), num(hot.world, 1))}</div>
              </>
            ) : (
              <div style={{ marginTop: 4, fontSize: 24 }}>{t.cardUnknown}</div>
            )}
          </div>
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", color: "#a9a2b3", fontSize: 14 }}>
            <span>{t.cardFilms(stats.ratedCount)}</span>
            <span>reelmate</span>
          </div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={download} disabled={busy}>
        {busy ? t.cardMaking : `↓ ${t.cardDownload}`}
      </button>
    </div>
  );
}
