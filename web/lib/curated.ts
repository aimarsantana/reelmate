export interface Curated {
  title: string;
  year: number;
  genres: number[]; // TMDB genre ids
}

/** ~65 very well-known films, varied by genre, decade and language. Posters come from TMDB at runtime. */
export const CURATED: Curated[] = [
  { title: "The Godfather", year: 1972, genres: [18, 80] },
  { title: "Pulp Fiction", year: 1994, genres: [80, 53] },
  { title: "The Shawshank Redemption", year: 1994, genres: [18, 80] },
  { title: "Forrest Gump", year: 1994, genres: [35, 18, 10749] },
  { title: "Titanic", year: 1997, genres: [18, 10749] },
  { title: "The Matrix", year: 1999, genres: [28, 878] },
  { title: "Gladiator", year: 2000, genres: [28, 12, 18] },
  { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, genres: [12, 14, 28] },
  { title: "Spirited Away", year: 2001, genres: [16, 14, 10751] },
  { title: "Amélie", year: 2001, genres: [35, 10749] },
  { title: "City of God", year: 2002, genres: [80, 18] },
  { title: "Finding Nemo", year: 2003, genres: [16, 10751, 12] },
  { title: "Kill Bill: Vol. 1", year: 2003, genres: [28, 80] },
  { title: "Oldboy", year: 2003, genres: [9648, 53, 28] },
  { title: "Pan's Labyrinth", year: 2006, genres: [14, 18, 10752] },
  { title: "The Dark Knight", year: 2008, genres: [18, 28, 80, 53] },
  { title: "WALL·E", year: 2008, genres: [16, 878, 10751] },
  { title: "Up", year: 2009, genres: [16, 12, 35, 10751] },
  { title: "Inception", year: 2010, genres: [28, 878, 12] },
  { title: "The Social Network", year: 2010, genres: [18] },
  { title: "Django Unchained", year: 2012, genres: [18, 37] },
  { title: "Interstellar", year: 2014, genres: [12, 18, 878] },
  { title: "Whiplash", year: 2014, genres: [18, 10402] },
  { title: "Mad Max: Fury Road", year: 2015, genres: [28, 12, 878] },
  { title: "La La Land", year: 2016, genres: [35, 18, 10402, 10749] },
  { title: "Your Name.", year: 2016, genres: [16, 10749, 18, 14] },
  { title: "Get Out", year: 2017, genres: [27, 9648, 53] },
  { title: "Coco", year: 2017, genres: [16, 10751, 14, 10402] },
  { title: "Roma", year: 2018, genres: [18] },
  { title: "Hereditary", year: 2018, genres: [27, 9648] },
  { title: "Bohemian Rhapsody", year: 2018, genres: [10402, 18] },
  { title: "Free Solo", year: 2018, genres: [99] },
  { title: "Parasite", year: 2019, genres: [35, 53, 18] },
  { title: "Joker", year: 2019, genres: [80, 53, 18] },
  { title: "Avengers: Endgame", year: 2019, genres: [12, 878, 28] },
  { title: "Knives Out", year: 2019, genres: [35, 80, 9648] },
  { title: "1917", year: 2019, genres: [10752, 18, 28] },
  { title: "Dune", year: 2021, genres: [878, 12] },
  { title: "Everything Everywhere All at Once", year: 2022, genres: [28, 12, 878] },
  { title: "Top Gun: Maverick", year: 2022, genres: [28, 18] },
  { title: "Oppenheimer", year: 2023, genres: [18, 36] },
  { title: "Barbie", year: 2023, genres: [35, 12, 14] },
  { title: "Casablanca", year: 1942, genres: [18, 10749, 10752] },
  { title: "Seven Samurai", year: 1954, genres: [28, 18] },
  { title: "Psycho", year: 1960, genres: [27, 9648, 53] },
  { title: "The Good, the Bad and the Ugly", year: 1966, genres: [37] },
  { title: "2001: A Space Odyssey", year: 1968, genres: [878, 9648] },
  { title: "Star Wars", year: 1977, genres: [12, 28, 878] },
  { title: "Alien", year: 1979, genres: [27, 878] },
  { title: "The Shining", year: 1980, genres: [27, 53] },
  { title: "Blade Runner", year: 1982, genres: [878, 18, 53] },
  { title: "Back to the Future", year: 1985, genres: [12, 35, 878] },
  { title: "Grave of the Fireflies", year: 1988, genres: [16, 18, 10752] },
  { title: "Cinema Paradiso", year: 1988, genres: [18, 10749] },
  { title: "Unforgiven", year: 1992, genres: [37, 18] },
  { title: "Jurassic Park", year: 1993, genres: [12, 878] },
  { title: "Schindler's List", year: 1993, genres: [18, 36, 10752] },
  { title: "The Lion King", year: 1994, genres: [16, 10751, 18] },
  { title: "Se7en", year: 1995, genres: [80, 9648, 53] },
  { title: "Toy Story", year: 1995, genres: [16, 35, 10751] },
  { title: "Life Is Beautiful", year: 1997, genres: [35, 18, 10752] },
  { title: "Saving Private Ryan", year: 1998, genres: [18, 36, 10752] },
  { title: "Fight Club", year: 1999, genres: [18] },
  { title: "The Sixth Sense", year: 1999, genres: [9648, 53] },
  { title: "Amores perros", year: 2000, genres: [18, 53] },
  { title: "Shrek", year: 2001, genres: [16, 35, 14, 10751] },
  { title: "Pride & Prejudice", year: 2005, genres: [18, 10749] },
  { title: "Superbad", year: 2007, genres: [35] },
  { title: "Man on Wire", year: 2008, genres: [99] },
  { title: "The Hangover", year: 2009, genres: [35] },
  { title: "The Conjuring", year: 2013, genres: [27, 9648, 53] },
  { title: "Citizenfour", year: 2014, genres: [99] },
];

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Orders the curated list for a user: films matching more of the chosen genres first
 * (shuffled inside each score), but always mixing in a couple of non-matching ones
 * early on so the result isn't a single-genre bubble.
 */
export function orderFor(genres: number[]): number[] {
  const scored = CURATED.map((c, i) => ({ i, s: c.genres.filter((g) => genres.includes(g)).length }));
  const matched = shuffle(scored.filter((x) => x.s > 0)).sort((a, b) => b.s - a.s);
  const rest = shuffle(scored.filter((x) => x.s === 0));
  const out: number[] = [];
  let m = 0;
  let r = 0;
  // pattern: 3 matched, 1 other
  while (m < matched.length || r < rest.length) {
    for (let k = 0; k < 3 && m < matched.length; k++) out.push(matched[m++].i);
    if (r < rest.length) out.push(rest[r++].i);
    else if (m >= matched.length) break;
  }
  return out;
}
