export type Source = "quick" | "rss" | "zip" | "demo";

/** A film as it comes from the user's data (before TMDB enrichment). */
export interface Film {
  title: string;
  year: number | null;
  rating?: number; // 0.5 – 5
  tmdbId?: number;
  liked?: boolean;
}

export interface Profile {
  source: Source;
  username?: string;
  rated: Film[];
  watched: Film[];
  watchlist: Film[];
  createdAt: number;
}

/** TMDB data for a film (only the fields we need). */
export interface Movie {
  id: number;
  title: string;
  year: number | null;
  genres: number[];
  directors: string[];
  cast: string[];
  runtime: number | null;
  countries: string[]; // ISO 3166-1
  lang: string | null; // ISO 639-1
  vote: number; // 0 – 10
  votes: number;
  popularity: number;
  poster: string | null; // path, e.g. /abc.jpg
}

export type MatchStatus = "ok" | "doubtful" | "notfound";

export interface Enriched {
  status: MatchStatus;
  movie?: Movie;
}

export interface LookupItem {
  k: string;
  title: string;
  year: number | null;
  tmdbId?: number;
}
