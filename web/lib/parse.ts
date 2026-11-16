import JSZip from "jszip";
import Papa from "papaparse";
import type { Film, Profile, Source } from "./types";
import { filmKey } from "./keys";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  return Papa.parse<Row>(text, { header: true, skipEmptyLines: true }).data;
}

function toFilms(rows: Row[], withRating = false): Film[] {
  const out: Film[] = [];
  for (const r of rows) {
    const title = (r.Name ?? "").trim();
    if (!title) continue;
    const y = parseInt(r.Year ?? "", 10);
    const film: Film = { title, year: Number.isFinite(y) ? y : null };
    if (withRating) {
      const rating = parseFloat(r.Rating ?? "");
      if (!(rating >= 0.5 && rating <= 5)) continue;
      film.rating = rating;
    }
    out.push(film);
  }
  return out;
}

export interface CsvTexts {
  ratings?: string;
  watched?: string;
  watchlist?: string;
  likes?: string;
}

export function buildProfile(csv: CsvTexts, source: Source): Profile {
  const rated = csv.ratings ? toFilms(parseCsv(csv.ratings), true) : [];
  const watched = csv.watched ? toFilms(parseCsv(csv.watched)) : [];
  const watchlist = csv.watchlist ? toFilms(parseCsv(csv.watchlist)) : [];
  const likes = new Set((csv.likes ? toFilms(parseCsv(csv.likes)) : []).map(filmKey));
  for (const f of rated) f.liked = likes.has(filmKey(f));
  return { source, rated, watched, watchlist, createdAt: Date.now() };
}

// Only these four files are ever opened. Everything else in the export is ignored.
const WANTED: Record<keyof CsvTexts, (p: string) => boolean> = {
  ratings: (p) => p === "ratings.csv",
  watched: (p) => p === "watched.csv",
  watchlist: (p) => p === "watchlist.csv",
  likes: (p) => p === "likes/films.csv",
};

export class ZipError extends Error {}

/** Reads the Letterboxd export entirely in the browser. */
export async function parseZip(file: File): Promise<Profile> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new ZipError("not_zip");
  }
  const texts: CsvTexts = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const parts = name.toLowerCase().split("/");
    if (parts.some((p) => p === "deleted" || p === "orphaned" || p === "__macosx")) continue;
    // Tolerate the export being wrapped in one extra folder.
    const rel = parts.length >= 2 && parts[parts.length - 2] === "likes" ? "likes/" + parts[parts.length - 1] : parts[parts.length - 1];
    for (const key of Object.keys(WANTED) as (keyof CsvTexts)[]) {
      if (!texts[key] && WANTED[key](rel)) texts[key] = await entry.async("string");
    }
  }
  if (!texts.ratings && !texts.watched) throw new ZipError("no_files");
  const profile = buildProfile(texts, "zip");
  if (!profile.rated.length && !profile.watched.length) throw new ZipError("empty");
  return profile;
}

export async function loadDemo(): Promise<Profile> {
  const get = async (f: string) => {
    const r = await fetch(`/demo/${f}`);
    return r.ok ? r.text() : undefined;
  };
  const [ratings, watched, watchlist, likes] = await Promise.all([
    get("ratings.csv"),
    get("watched.csv"),
    get("watchlist.csv"),
    get("likes-films.csv"),
  ]);
  return buildProfile({ ratings, watched, watchlist, likes }, "demo");
}

export interface RssEntry {
  title: string;
  year: number | null;
  rating?: number;
  rewatch: boolean;
  tmdbId?: number;
}

/** Builds a profile from RSS diary entries (newest first); keeps the latest rating per film. */
export function profileFromRss(username: string, entries: RssEntry[]): Profile {
  const seen = new Map<string, Film>();
  const watched = new Map<string, Film>();
  for (const e of entries) {
    const film: Film = { title: e.title, year: e.year, tmdbId: e.tmdbId, rating: e.rating };
    const k = filmKey(film);
    if (!watched.has(k)) watched.set(k, { title: e.title, year: e.year, tmdbId: e.tmdbId });
    if (e.rating && !seen.has(k)) seen.set(k, film);
  }
  return { source: "rss", username, rated: [...seen.values()], watched: [...watched.values()], watchlist: [], createdAt: Date.now() };
}
