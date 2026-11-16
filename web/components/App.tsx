"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { enrichAll } from "@/lib/enrich";
import { useI18n } from "@/lib/i18n";
import { loadDemo } from "@/lib/parse";
import { clearAll, loadProfile, saveProfile } from "@/lib/storage";
import type { Enriched, Profile } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { Footer, Header, Logo, PrivacyBadge } from "./Chrome";
import { RssPanel, ZipPanel } from "./ImportPanels";
import { QuickStart } from "./QuickStart";

type View =
  | { name: "home" }
  | { name: "quick" }
  | { name: "rss" }
  | { name: "zip" }
  | { name: "loading"; profile: Profile }
  | { name: "dashboard"; profile: Profile; enr: Map<string, Enriched> };

export function App() {
  const { t } = useI18n();
  const [view, setView] = useState<View>({ name: "home" });
  const [saved, setSaved] = useState<Profile | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    loadProfile().then((p) => alive && setSaved(p));
    return () => {
      alive = false;
    };
  }, []);

  const analyse = useCallback(async (profile: Profile) => {
    setError(false);
    setProgress({ done: 0, total: 0 });
    setView({ name: "loading", profile });
    window.scrollTo({ top: 0 });
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const films = [...profile.rated, ...profile.watched, ...profile.watchlist];
      const enr = await enrichAll(films, { signal: ctl.signal, onProgress: (done, total) => setProgress({ done, total }) });
      await saveProfile(profile);
      setSaved(profile);
      setView({ name: "dashboard", profile, enr });
    } catch {
      if (!ctl.signal.aborted) setError(true);
    }
  }, []);

  const goHome = () => {
    abort.current?.abort();
    setView({ name: "home" });
  };

  const example = async () => {
    const p = await loadDemo();
    void analyse(p);
  };

  const wipe = async () => {
    if (!window.confirm(t.deleteConfirm)) return;
    abort.current?.abort();
    await clearAll();
    setSaved(null);
    setView({ name: "home" });
  };

  return (
    <>
      <Header onHome={goHome} />
      <main className="flex-1" id="main">
        {view.name === "home" && <Home onPick={(n) => setView(n === "quick" ? { name: "quick" } : n === "rss" ? { name: "rss" } : { name: "zip" })} onExample={example} saved={saved} onContinue={() => saved && analyse(saved)} onWipe={wipe} />}
        {view.name === "quick" && <QuickStart onDone={analyse} onBack={goHome} />}
        {view.name === "rss" && <RssPanel onDone={analyse} onBack={goHome} />}
        {view.name === "zip" && <ZipPanel onDone={analyse} onBack={goHome} />}
        {view.name === "loading" && (
          <section className="mx-auto flex max-w-md flex-col items-center px-4 pt-16 text-center" aria-live="polite">
            <Logo size={72} spin={!error} />
            <h2 className="mt-6 text-4xl">{t.loadingTitle}</h2>
            {error ? (
              <>
                <p className="mt-3 text-red">{t.loadError}</p>
                <div className="mt-4 flex gap-3">
                  <button className="btn btn-primary" onClick={() => analyse(view.profile)}>
                    {t.retry}
                  </button>
                  <button className="btn btn-ghost" onClick={goHome}>
                    {t.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-muted">{t.loadingSub(progress.done, progress.total)}</p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total || 1}
                  aria-valuenow={progress.done}
                  className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2"
                >
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 3}%` }} />
                </div>
                <p className="mt-4 text-xs text-muted">{t.loadingNote}</p>
              </>
            )}
          </section>
        )}
        {view.name === "dashboard" && <Dashboard profile={view.profile} enr={view.enr} onNew={goHome} onDelete={wipe} onRateMore={view.profile.source === "quick" ? () => setView({ name: "quick" }) : undefined} />}
      </main>
      <Footer />
    </>
  );
}

function Home({
  onPick,
  onExample,
  saved,
  onContinue,
  onWipe,
}: {
  onPick: (n: "quick" | "rss" | "zip") => void;
  onExample: () => void;
  saved: Profile | null;
  onContinue: () => void;
  onWipe: () => void;
}) {
  const { t } = useI18n();
  const options = [
    { id: "quick" as const, title: t.opt1Title, desc: t.opt1Desc, badge: t.fastest, primary: true, step: "1" },
    { id: "rss" as const, title: t.opt2Title, desc: t.opt2Desc, step: "2" },
    { id: "zip" as const, title: t.opt3Title, desc: t.opt3Desc, badge: t.fullest, step: "3" },
  ];
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="pt-6 text-center sm:pt-12">
        <h1 className="text-balance text-6xl leading-[0.95] sm:text-8xl">{t.tagline}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t.heroSub}</p>
        <div className="mx-auto mt-5 max-w-xl text-left">
          <PrivacyBadge />
        </div>
      </motion.div>

      {saved && (
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-3">
          <button className="btn btn-primary" onClick={onContinue}>
            {t.continueLast}
          </button>
          <button className="btn btn-ghost" onClick={onWipe}>
            {t.deleteData}
          </button>
        </div>
      )}

      <h2 className="mt-12 text-3xl text-muted">{t.chooseWay}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {options.map((o, i) => (
          <motion.button
            key={o.id}
            onClick={() => onPick(o.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            whileHover={{ y: -4 }}
            className={`ticket group p-5 text-left transition-colors hover:border-accent ${o.primary ? "border-accent/60 bg-accent/5 md:-translate-y-1" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-5xl leading-none text-accent">{o.step}</span>
              {o.badge && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">{o.badge}</span>}
            </div>
            <h3 className="mt-3 text-3xl leading-tight">{o.title}</h3>
            <p className="mt-2 text-sm text-muted">{o.desc}</p>
            <span className="mt-4 inline-block font-semibold text-accent transition group-hover:translate-x-1">→</span>
          </motion.button>
        ))}
      </div>

      <p className="mt-8 text-center">
        <button onClick={onExample} className="font-semibold text-accent underline underline-offset-4 hover:text-fg">
          {t.seeExample}
        </button>
        <span className="ml-2 text-sm text-muted">· {t.exampleNote}</span>
      </p>
    </div>
  );
}
