import type { Film } from "./types";

/** Lowercase, no accents, only letters and digits. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function filmKey(f: Pick<Film, "title" | "year" | "tmdbId">): string {
  return f.tmdbId ? `id:${f.tmdbId}` : `t:${norm(f.title)}|${f.year ?? ""}`;
}

export function posterUrl(path: string | null | undefined, size = "w342"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
