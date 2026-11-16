/** TMDB movie genre ids with ES/EN names. */
export const GENRES: Record<number, { es: string; en: string }> = {
  28: { es: "Acción", en: "Action" },
  12: { es: "Aventura", en: "Adventure" },
  16: { es: "Animación", en: "Animation" },
  35: { es: "Comedia", en: "Comedy" },
  80: { es: "Crimen", en: "Crime" },
  99: { es: "Documental", en: "Documentary" },
  18: { es: "Drama", en: "Drama" },
  10751: { es: "Familiar", en: "Family" },
  14: { es: "Fantasía", en: "Fantasy" },
  36: { es: "Historia", en: "History" },
  27: { es: "Terror", en: "Horror" },
  10402: { es: "Música", en: "Music" },
  9648: { es: "Misterio", en: "Mystery" },
  10749: { es: "Romance", en: "Romance" },
  878: { es: "Ciencia ficción", en: "Sci-Fi" },
  10770: { es: "Película de TV", en: "TV Movie" },
  53: { es: "Suspense", en: "Thriller" },
  10752: { es: "Bélica", en: "War" },
  37: { es: "Western", en: "Western" },
};

/** Genres offered in the quick-start picker. */
export const PICKABLE_GENRES = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];

export function genreName(id: number | string, lang: "es" | "en"): string {
  const g = GENRES[Number(id)];
  return g ? g[lang] : String(id);
}
