"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { parseZip, profileFromRss, ZipError, type RssEntry } from "@/lib/parse";
import type { Profile } from "@/lib/types";
import { PrivacyBadge } from "./Chrome";

function Back({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <button onClick={onBack} className="mb-4 text-sm text-muted hover:text-fg">
      ← {t.back}
    </button>
  );
}

export function RssPanel({ onDone, onBack }: { onDone: (p: Profile) => void; onBack: () => void }) {
  const { t } = useI18n();
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const name = user.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) return setError(t.rssInvalid);
    setBusy(true);
    try {
      const res = await fetch(`/api/letterboxd?user=${encodeURIComponent(name)}`);
      if (res.status === 404) return setError(t.rssNotFound);
      if (!res.ok) return setError(t.rssUnreachable);
      const data = (await res.json()) as { username: string; entries: RssEntry[] };
      const profile = profileFromRss(data.username, data.entries);
      if (!profile.rated.length) {
        setInfo(t.rssFound(data.entries.length, 0));
        return setError(t.rssEmpty);
      }
      onDone(profile);
    } catch {
      setError(t.rssUnreachable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-xl px-4 sm:px-6" aria-labelledby="rss-title">
      <Back onBack={onBack} />
      <h2 id="rss-title" className="text-4xl sm:text-5xl">
        {t.rssTitle}
      </h2>
      <p className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm text-muted">{t.rssWarn}</p>
      <form onSubmit={submit} className="mt-5">
        <label htmlFor="lb-user" className="text-sm font-semibold">
          {t.rssLabel}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-h-11 flex-1 items-center rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
            <span className="text-muted">letterboxd.com/</span>
            <input
              id="lb-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={t.rssPlaceholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none"
            />
          </div>
          <button className="btn btn-primary" disabled={busy || !user.trim()}>
            {busy ? t.rssLoading : t.rssGo}
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted">{t.rssOnly}</p>
      <div aria-live="polite" className="mt-4 space-y-1 text-sm">
        {info && <p className="text-muted">{info}</p>}
        {error && <p className="text-red">{error}</p>}
      </div>
      <div className="mt-6">
        <PrivacyBadge />
      </div>
    </section>
  );
}

export function ZipPanel({ onDone, onBack }: { onDone: (p: Profile) => void; onBack: () => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onDone(await parseZip(file));
    } catch (e) {
      const code = e instanceof ZipError ? e.message : "";
      setError(code === "no_files" ? t.zipNoFiles : code === "empty" ? t.zipEmpty : t.zipNotZip);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-xl px-4 sm:px-6" aria-labelledby="zip-title">
      <Back onBack={onBack} />
      <h2 id="zip-title" className="text-4xl sm:text-5xl">
        {t.zipTitle}
      </h2>
      <div className="ticket mt-4 p-5">
        <h3 className="text-2xl text-accent">{t.zipStepsTitle}</h3>
        <ol className="mt-3 space-y-2 text-sm">
          {t.zipSteps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={`mt-5 rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? "border-accent bg-accent/10" : "border-line bg-surface"}`}
      >
        <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" id="zip-file" onChange={(e) => handle(e.target.files?.[0])} />
        <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? t.zipReading : drag ? t.zipDropActive : t.zipDrop}
        </button>
        <p className="mt-3 text-xs text-muted">{t.zipOnlyReads}</p>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-red">
        {error}
      </p>
      <div className="mt-6">
        <PrivacyBadge long />
      </div>
    </section>
  );
}
