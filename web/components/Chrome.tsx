"use client";

import { useI18n, type Lang } from "@/lib/i18n";

export function Logo({ size = 32, spin = false }: { size?: number; spin?: boolean }) {
  const holes = [0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: 50 + Math.sin(r) * 24, y: 50 - Math.cos(r) * 24 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={spin ? "reel-spin" : undefined}>
      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="6" />
      {holes.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r="8.5" fill="var(--accent)" />
      ))}
      <circle cx="50" cy="50" r="6" fill="var(--accent)" />
    </svg>
  );
}

export function Header({ onHome }: { onHome?: () => void }) {
  const { lang, setLang, t } = useI18n();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      <button onClick={onHome} className="flex items-center gap-2" aria-label="Reelmate">
        <Logo />
        <span className="font-display text-3xl leading-none tracking-wider">REELMATE</span>
      </button>
      <div role="group" aria-label={t.language} className="flex rounded-full border border-line p-0.5 text-sm font-semibold">
        {(["es", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`min-h-9 min-w-11 rounded-full px-3 uppercase transition ${
              lang === l ? "bg-accent text-accent-ink" : "text-muted hover:text-fg"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto mt-16 flex w-full max-w-5xl flex-col items-center gap-3 border-t border-line px-4 py-8 text-center text-sm text-muted sm:px-6">
      <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" aria-label="TMDB">
        <svg width="120" height="16" viewBox="0 0 190 16" role="img" aria-label="TMDB">
          <rect width="190" height="16" rx="8" fill="#01b4e4" opacity="0.18" />
          <text x="95" y="12" textAnchor="middle" fontSize="11" fontWeight="700" fill="#90cea1" letterSpacing="2">
            THE MOVIE DB
          </text>
        </svg>
      </a>
      <p className="max-w-xl">{t.tmdbAttribution}</p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>
          {t.footerBy}{" "}
          <a href="https://github.com/aimarsantana" target="_blank" rel="noopener noreferrer" className="font-semibold text-fg underline underline-offset-4 hover:text-accent">
            Aimar
          </a>{" "}
          · Reelmate
        </span>
        <a href="https://www.linkedin.com/in/aimar-alejandro-64aa542bb" target="_blank" rel="noopener noreferrer" className="font-semibold text-fg underline underline-offset-4 hover:text-accent">
          LinkedIn
        </a>
      </p>
    </footer>
  );
}

export function PrivacyBadge({ long = false }: { long?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 018 0v3" />
        </svg>
        {t.privacyBadge}
      </p>
      {long && <p className="mt-2 text-muted">{t.privacyLong}</p>}
    </div>
  );
}
