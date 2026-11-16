"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QuirkKind } from "./stats";

export type Lang = "es" | "en";

const es = {
  tagline: "Descubre cómo son de verdad tus gustos de cine.",
  heroSub: "Tu ADN de cine: qué directores, géneros y décadas te enamoran, y en qué discrepas con el resto del mundo.",
  privacyBadge: "No guardamos tus datos en ningún servidor",
  privacyLong:
    "Tu archivo se lee y se procesa en tu navegador; nunca se sube ni se guarda en ningún servidor. Solo viajan títulos y años (para buscarlos en TMDB) y, si usas la opción 2, tu nombre de usuario para leer el RSS público. No hay base de datos.",
  chooseWay: "Elige cómo empezar",
  fastest: "Más rápida",
  fullest: "Más completa",
  opt1Title: "Empieza en 1 minuto",
  opt1Desc: "Sin cuenta ni archivos. Elige tus géneros y puntúa unas 15 películas muy conocidas.",
  opt2Title: "Usa tu usuario de Letterboxd",
  opt2Desc: "Leemos el RSS público de tu diario (las ~50 últimas entradas).",
  opt3Title: "Análisis completo",
  opt3Desc: "Sube tu exportación .zip de Letterboxd y analiza todo tu historial.",
  seeExample: "Ver un ejemplo",
  exampleNote: "Carga un perfil real de ejemplo",
  continueLast: "Continuar con tu último análisis",
  deleteData: "Borrar mis datos",
  deleteConfirm: "¿Borrar todos los datos guardados en este navegador?",
  deleted: "Datos borrados.",
  back: "Volver",
  next: "Siguiente",
  language: "Idioma",

  // quick start
  qGenresTitle: "¿Qué géneros te gustan?",
  qGenresSub: "Elige entre 2 y 4. Las películas que verás darán prioridad a estos géneros.",
  qSelected: (n: number) => `${n} de 4 elegidos`,
  qStart: "Empezar a puntuar",
  qRateTitle: "Puntúa estas películas",
  qProgress: (n: number, goal: number) => `${n} de ${goal} puntuadas`,
  qUnlock: "Con 10 puntuaciones ya puedes ver tu resultado",
  qSeen: "Ver mi ADN de cine",
  qNotSeen: "No la he visto",
  qUndo: "Deshacer",
  qMore: "Ver más películas",
  qNoMore: "Ya has visto todas las películas de la lista.",
  qEndOfBatch: "¿Seguimos? Cuantas más puntúes, más fino sale el resultado.",
  qStars: (n: number) => `${n} ${n === 1 ? "estrella" : "estrellas"}`,
  qRated: "Puntuada",

  // rss
  rssTitle: "Usa tu usuario de Letterboxd",
  rssLabel: "Nombre de usuario",
  rssPlaceholder: "p. ej. negriii",
  rssGo: "Leer mi RSS",
  rssWarn:
    "Ojo: el RSS oficial solo trae las ~50 últimas entradas de tu DIARIO. Si puntúas películas sin registrarlas en el diario, no aparecerán. En ese caso, prueba “Empieza en 1 minuto” o el análisis completo con el .zip.",
  rssOnly: "Tu nombre de usuario solo se usa para leer tu RSS público; no se guarda. Solo leemos tu RSS público. No accedemos a ninguna otra página de Letterboxd.",
  rssLoading: "Leyendo tu RSS…",
  rssInvalid: "Ese nombre de usuario no parece válido.",
  rssNotFound: "No hemos encontrado ese usuario en Letterboxd. Revisa el nombre.",
  rssUnreachable: "No hemos podido leer el RSS ahora mismo. Inténtalo de nuevo en un rato.",
  rssEmpty:
    "Tu RSS no trae entradas puntuadas. Seguramente puntúas sin registrar en el diario. Prueba “Empieza en 1 minuto” o sube tu exportación .zip.",
  rssFound: (n: number, r: number) => `${n} entradas leídas, ${r} con nota.`,

  // zip
  zipTitle: "Análisis completo con tu exportación",
  zipStepsTitle: "Cómo exportar tus datos",
  zipSteps: [
    "Entra en letterboxd.com e inicia sesión desde el ordenador.",
    "Ve a Settings → Data.",
    "Pulsa “Export your data” y descarga el .zip.",
    "Suéltalo aquí abajo (sin descomprimir).",
  ],
  zipDrop: "Arrastra tu .zip aquí o pulsa para elegirlo",
  zipDropActive: "Suéltalo para analizarlo",
  zipReading: "Leyendo tu archivo en el navegador…",
  zipOnlyReads: "Solo se leen ratings, watched, watchlist y likes/films. Perfil, comentarios y reseñas se ignoran.",
  zipNotZip: "Eso no parece un .zip válido.",
  zipNoFiles: "No encuentro ratings.csv ni watched.csv dentro del .zip. ¿Es la exportación de Letterboxd?",
  zipEmpty: "El .zip no contiene películas puntuadas ni vistas.",

  // loading
  loadingTitle: "Buscando tus películas en TMDB",
  loadingSub: (d: number, t: number) => `${d} de ${t}`,
  loadingNote: "Solo se envían títulos y años. Las respuestas se guardan en tu navegador para no repetirlo.",
  loadError: "No hemos podido consultar TMDB. Comprueba tu conexión e inténtalo de nuevo.",
  retry: "Reintentar",
  cancel: "Cancelar",

  // dashboard
  dnaTitle: "Tu ADN de cine",
  fromQuick: "Basado en tus puntuaciones rápidas",
  fromRss: (u: string) => `Basado en el diario de @${u} (últimas entradas)`,
  fromZip: "Basado en tu exportación completa",
  fromDemo: "Perfil de ejemplo",
  newAnalysis: "Nuevo análisis",
  matchReport: "Informe de coincidencias",
  reportTitle: "Películas no encontradas o dudosas",
  reportNone: "Todas las películas se han encontrado sin dudas.",
  reportNotFound: "No encontrada",
  reportDoubtful: "Dudosa",
  reportAs: (m: string) => `Emparejada con ${m}`,
  close: "Cerrar",
  lowData: (n: number) =>
    `Tenemos pocos datos (${n} películas puntuadas y reconocidas), así que hemos simplificado algunas secciones. Con más puntuaciones el retrato mejora.`,

  sumTitle: "Resumen",
  watched: "Vistas",
  rated: "Puntuadas",
  avgRating: "Nota media",
  liked: "Con ♥",
  distTitle: "Cómo puntúas",
  toneGenerous: (d: string) => `Eres generoso: le pones de media ${d} puntos más que el público en TMDB.`,
  toneHarsh: (d: string) => `Eres exigente: le pones de media ${d} puntos menos que el público en TMDB.`,
  toneBalanced: "Vas a la par del público: tu nota media coincide con la de TMDB.",
  toneUnknown: "Necesitamos más películas reconocidas para decirte si eres generoso o duro.",

  tasteTitle: "Lo que te enamora",
  tasteSub: "Ordenado por tu nota media (con un mínimo de películas para que sea fiable), no por cuántas has visto.",
  mostWatched: "Lo que más ves",
  directors: "Directores",
  actors: "Actores y actrices",
  genres: "Géneros",
  decades: "Décadas",
  countries: "Países",
  byRating: "Mejor valorados",
  byCount: "Más vistos",
  bayesNote: "Ordenado por media bayesiana",
  bayesTip:
    "Corrige la media según cuántas películas tiene cada grupo: con pocas películas se acerca a tu nota media global, así un 5 en 3 películas no gana a un 4,5 en 20. Aquí ves la media real.",
  filmsN: (n: number) => `${n} ${n === 1 ? "película" : "películas"}`,
  minNote: (n: number) => `mín. ${n}`,
  notEnough: "Todavía no hay suficientes películas para este apartado.",
  decadeChart: "Tu nota media por década",

  worldTitle: "Tú contra el mundo",
  worldSub: "Tu nota frente a la media de TMDB (0,5–5).",
  worldUp: "Te gustan más que a la gente",
  worldDown: "Te gustan menos que a la gente",
  yourRating: "Tú",
  worldRating: "TMDB",
  controversial: "Tu opinión más polémica",
  worldNone: "Aún no hay suficientes películas con datos de TMDB para compararte con el mundo.",
  noneBeyond: "Ninguna se aleja lo bastante.",

  quirksTitle: "Tus manías",
  quirksSub: "¿Puntúas distinto según la duración, la época, el idioma o la fama de la película?",
  quirkNeutral: (dim: string, d: string) => `En ${dim} no tienes manías claras (diferencia de ${d}).`,
  quirkDim: { length: "duración", era: "época", language: "idioma", popularity: "popularidad" } as Record<QuirkKind, string>,
  quirkGroup: {
    length: [["de más de 2 horas", "de más de 2 horas"], ["de 2 horas o menos", "de 2 horas o menos"]],
    era: [["anteriores al año 2000", "anteriores al año 2000"], ["del 2000 en adelante", "del 2000 en adelante"]],
    language: [["en inglés", "en inglés"], ["en otros idiomas", "en otros idiomas"]],
    popularity: [["muy conocidas", "muy conocidas"], ["menos conocidas", "menos conocidas"]],
  } as QuirkGroups,
  quirkLine: (d: string, hi: string, lo: string) =>
    `Le pones de media ${d} puntos más a las películas ${hi} que a las películas ${lo}.`,
  quirksNone: "Hacen falta más películas puntuadas para detectar tus manías.",

  wlTitle: "Tu watchlist",
  wlCount: (n: number) => `Tienes ${n} películas pendientes.`,
  wlGenres: "Géneros que más esperan en tu lista",
  wlOnlyZip: "La watchlist solo está disponible con la exportación .zip de Letterboxd.",

  cardTitle: "Tu ficha técnica",
  cardSub: "Descárgala y compártela.",
  cardDownload: "Descargar imagen",
  cardMaking: "Creando imagen…",
  cardDirector: "Director",
  cardGenre: "Género",
  cardDecade: "Década",
  cardAvg: "Nota media",
  cardHot: "Opinión polémica",
  cardUnknown: "—",
  cardFilms: (n: number) => `${n} películas puntuadas`,
  cardYouVs: (y: string, w: string) => `Tú ${y} · TMDB ${w}`,

  predTitle: "¿Cuánto le pondría yo?",
  predSub: "Busca cualquier película y te digo qué nota le pondrías, y por qué.",
  predSearch: "Busca una película…",
  predSearching: "Buscando…",
  predNoResults: "No encuentro nada con ese título.",
  predSearchError: "No se pudo buscar ahora mismo. Inténtalo de nuevo.",
  predTraining: "Entrenando tu modelo en este navegador…",
  predTrainError: "No se pudo entrenar el modelo.",
  predTooFew: "Necesito al menos 6 películas puntuadas (y encontradas en TMDB) para predecir tus notas.",
  predLoading: "Calculando…",
  predYouWould: "Le pondrías",
  predReasons: "Por qué",
  predAlready: (pred: string, real: string) => `El modelo habría dicho ${pred}; tú le diste ${real}.`,
  predAlreadyNote: "Esta predicción se hace sin usar tu nota de esa película.",
  predModelPersonal: (n: number) => `Modelo personal, entrenado con tus ${n} notas.`,
  predModelSimple: "Modelo sencillo: la nota de TMDB ajustada a tu media y a tus géneros.",
  predAccuracy: (mae: string, k: number) => `Acierto estimado: ±${mae} estrellas, a medio punto en ${k} de cada 10 películas.`,
  predAccuracyNone: "Todavía no puedo estimar cuánto acierta.",
  predCompared: (p: string, f: string) => `Hemos probado los dos con tus propias notas (error medio: personal ±${p}, sencillo ±${f}).`,
  predWhyPersonal: "Usamos el personal porque falla igual o menos que el sencillo.",
  predLowVotes: "Pocas valoraciones en TMDB: predicción menos fiable",
  predWhySimple: "Usamos el sencillo porque falla menos.",
  predMore: "Puntúa más películas para afinar tus predicciones",
  predRateMore: "Seguir puntuando",
  reasonCrowd: (tmdb: string) => `por su nota en TMDB (${tmdb})`,
  reasonDirector: (n: string) => `porque es de ${n}`,
  reasonCast: (n: string) => `por ${n} en el reparto`,
  reasonGenre: (g: string) => `por ser de género ${g}`,
  reasonDecade: "por su época",
  reasonRuntime: "por su duración",
  reasonPopularity: "por lo conocida que es",
  reasonLanguage: "por su idioma original",
  reasonCountry: (c: string) => `por su país (${c})`,
  nextTitle: "Lo próximo que deberías ver",
  nextSub: "Tu watchlist ordenada por la nota que le pondrías.",
  nextShowAll: (n: number) => `Ver las ${n} películas`,
  nextShowLess: "Ver menos",
  nextNone: "No hay películas de tu watchlist con datos suficientes.",
  tmdbAttribution: "Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB.",
  footerBy: "Hecho por",
  sectionHidden: "Sección oculta por falta de datos",
};

type QuirkGroups = Record<QuirkKind, [[string, string], [string, string]]>;

type Dict = typeof es;

const en: Dict = {
  tagline: "Find out what your film taste is really like.",
  heroSub: "Your Film DNA: which directors, genres and decades you fall for, and where you disagree with everyone else.",
  privacyBadge: "We don't store your data on any server",
  privacyLong:
    "Your file is read and processed in your browser; it is never uploaded or stored on any server. Only titles and years travel (to look them up on TMDB) and, with option 2, your username to read the public RSS. There is no database.",
  chooseWay: "Choose how to start",
  fastest: "Fastest",
  fullest: "Most complete",
  opt1Title: "Start in 1 minute",
  opt1Desc: "No account, no files. Pick your genres and rate about 15 very well-known films.",
  opt2Title: "Use your Letterboxd username",
  opt2Desc: "We read the public RSS of your diary (the latest ~50 entries).",
  opt3Title: "Full analysis",
  opt3Desc: "Upload your Letterboxd .zip export and analyse your whole history.",
  seeExample: "See an example",
  exampleNote: "Loads a real sample profile",
  continueLast: "Continue with your last analysis",
  deleteData: "Delete my data",
  deleteConfirm: "Delete all data stored in this browser?",
  deleted: "Data deleted.",
  back: "Back",
  next: "Next",
  language: "Language",

  qGenresTitle: "Which genres do you like?",
  qGenresSub: "Pick 2 to 4. The films you'll see prioritise these genres.",
  qSelected: (n: number) => `${n} of 4 selected`,
  qStart: "Start rating",
  qRateTitle: "Rate these films",
  qProgress: (n: number, goal: number) => `${n} of ${goal} rated`,
  qUnlock: "With 10 ratings you can already see your result",
  qSeen: "See my Film DNA",
  qNotSeen: "Haven't seen it",
  qUndo: "Undo",
  qMore: "Show more films",
  qNoMore: "You've gone through the whole list.",
  qEndOfBatch: "Keep going? The more you rate, the sharper the result.",
  qStars: (n: number) => `${n} ${n === 1 ? "star" : "stars"}`,
  qRated: "Rated",

  rssTitle: "Use your Letterboxd username",
  rssLabel: "Username",
  rssPlaceholder: "e.g. negriii",
  rssGo: "Read my RSS",
  rssWarn:
    "Heads-up: the official RSS only carries your latest ~50 DIARY entries. If you rate films without logging them in your diary, they won't show up. In that case, try “Start in 1 minute” or the full analysis with the .zip.",
  rssOnly: "Your username is only used to read your public RSS; it is not stored. We only read your public RSS. We don't access any other Letterboxd page.",
  rssLoading: "Reading your RSS…",
  rssInvalid: "That username doesn't look valid.",
  rssNotFound: "We couldn't find that user on Letterboxd. Check the spelling.",
  rssUnreachable: "We couldn't read the RSS right now. Please try again in a while.",
  rssEmpty:
    "Your RSS has no rated entries. You probably rate without logging in the diary. Try “Start in 1 minute” or upload your .zip export.",
  rssFound: (n: number, r: number) => `${n} entries read, ${r} with a rating.`,

  zipTitle: "Full analysis with your export",
  zipStepsTitle: "How to export your data",
  zipSteps: [
    "Go to letterboxd.com and sign in from a computer.",
    "Open Settings → Data.",
    "Click “Export your data” and download the .zip.",
    "Drop it below (don't unzip it).",
  ],
  zipDrop: "Drag your .zip here or tap to choose it",
  zipDropActive: "Drop it to analyse it",
  zipReading: "Reading your file in the browser…",
  zipOnlyReads: "Only ratings, watched, watchlist and likes/films are read. Profile, comments and reviews are ignored.",
  zipNotZip: "That doesn't look like a valid .zip.",
  zipNoFiles: "I can't find ratings.csv or watched.csv inside the .zip. Is it the Letterboxd export?",
  zipEmpty: "The .zip contains no rated or watched films.",

  loadingTitle: "Looking up your films on TMDB",
  loadingSub: (d: number, t: number) => `${d} of ${t}`,
  loadingNote: "Only titles and years are sent. Responses are cached in your browser so we don't repeat this.",
  loadError: "We couldn't reach TMDB. Check your connection and try again.",
  retry: "Retry",
  cancel: "Cancel",

  dnaTitle: "Your Film DNA",
  fromQuick: "Based on your quick ratings",
  fromRss: (u: string) => `Based on the diary of @${u} (latest entries)`,
  fromZip: "Based on your full export",
  fromDemo: "Sample profile",
  newAnalysis: "New analysis",
  matchReport: "Match report",
  reportTitle: "Films not found or uncertain",
  reportNone: "Every film was matched with no doubts.",
  reportNotFound: "Not found",
  reportDoubtful: "Uncertain",
  reportAs: (m: string) => `Matched with ${m}`,
  close: "Close",
  lowData: (n: number) =>
    `We have little data (${n} rated and recognised films), so some sections are simplified. More ratings make the picture better.`,

  sumTitle: "Summary",
  watched: "Watched",
  rated: "Rated",
  avgRating: "Average rating",
  liked: "Liked ♥",
  distTitle: "How you rate",
  toneGenerous: (d: string) => `You're generous: on average you rate ${d} points higher than the TMDB crowd.`,
  toneHarsh: (d: string) => `You're tough: on average you rate ${d} points lower than the TMDB crowd.`,
  toneBalanced: "You're in line with the crowd: your average matches TMDB's.",
  toneUnknown: "We need more recognised films to tell whether you're generous or tough.",

  tasteTitle: "What you fall for",
  tasteSub: "Sorted by your average rating (with a minimum number of films to be reliable), not by how many you've seen.",
  mostWatched: "What you watch most",
  directors: "Directors",
  actors: "Actors",
  genres: "Genres",
  decades: "Decades",
  countries: "Countries",
  byRating: "Best rated",
  byCount: "Most watched",
  bayesNote: "Sorted by Bayesian average",
  bayesTip:
    "Adjusts each average for how many films the group has: with few films it is pulled toward your overall average, so a 5 over 3 films does not beat a 4.5 over 20. The real average is what you see here.",
  filmsN: (n: number) => `${n} ${n === 1 ? "film" : "films"}`,
  minNote: (n: number) => `min. ${n}`,
  notEnough: "Not enough films for this section yet.",
  decadeChart: "Your average rating by decade",

  worldTitle: "You vs. the world",
  worldSub: "Your rating against the TMDB average (0.5–5).",
  worldUp: "You like them more than people do",
  worldDown: "You like them less than people do",
  yourRating: "You",
  worldRating: "TMDB",
  controversial: "Your hottest take",
  worldNone: "Not enough films with TMDB data yet to compare you with the world.",
  noneBeyond: "None strays far enough.",

  quirksTitle: "Your quirks",
  quirksSub: "Do you rate differently by length, era, language or how famous a film is?",
  quirkNeutral: (dim: string, d: string) => `When it comes to ${dim}, you have no clear quirk (difference of ${d}).`,
  quirkDim: { length: "length", era: "era", language: "language", popularity: "popularity" } as Record<QuirkKind, string>,
  quirkGroup: {
    length: [["films over 2 hours long", "longer ones"], ["films of 2 hours or less", "shorter ones"]],
    era: [["films made before 2000", "older ones"], ["films made in 2000 or later", "newer ones"]],
    language: [["English-language films", "English-language ones"], ["non-English films", "non-English ones"]],
    popularity: [["very well-known films", "better-known ones"], ["lesser-known films", "lesser-known ones"]],
  } as QuirkGroups,
  quirkLine: (d: string, hi: string, lo: string) => `On average you rate ${hi} ${d} points higher than ${lo}.`,
  quirksNone: "We need more rated films to spot your quirks.",

  wlTitle: "Your watchlist",
  wlCount: (n: number) => `You have ${n} films waiting.`,
  wlGenres: "Genres waiting the most in your list",
  wlOnlyZip: "The watchlist is only available with the Letterboxd .zip export.",

  cardTitle: "Your spec sheet",
  cardSub: "Download it and share it.",
  cardDownload: "Download image",
  cardMaking: "Creating image…",
  cardDirector: "Director",
  cardGenre: "Genre",
  cardDecade: "Decade",
  cardAvg: "Average rating",
  cardHot: "Hot take",
  cardUnknown: "—",
  cardFilms: (n: number) => `${n} rated films`,
  cardYouVs: (y: string, w: string) => `You ${y} · TMDB ${w}`,

  predTitle: "How many stars would I give it?",
  predSub: "Search any film and I'll tell you the rating you'd give it, and why.",
  predSearch: "Search for a film…",
  predSearching: "Searching…",
  predNoResults: "I can't find anything with that title.",
  predSearchError: "Search isn't available right now. Try again.",
  predTraining: "Training your model in this browser…",
  predTrainError: "The model could not be trained.",
  predTooFew: "I need at least 6 rated films (found on TMDB) to predict your ratings.",
  predLoading: "Calculating…",
  predYouWould: "You'd give it",
  predReasons: "Why",
  predAlready: (pred: string, real: string) => `The model would have said ${pred}; you gave it ${real}.`,
  predAlreadyNote: "This prediction is made without using your rating of that film.",
  predModelPersonal: (n: number) => `Personal model, trained on your ${n} ratings.`,
  predModelSimple: "Simple model: the TMDB score adjusted to your average and your genres.",
  predAccuracy: (mae: string, k: number) => `Estimated accuracy: ±${mae} stars, within half a star for ${k} out of 10 films.`,
  predAccuracyNone: "I can't estimate how accurate it is yet.",
  predCompared: (p: string, f: string) => `We tested both on your own ratings (average error: personal ±${p}, simple ±${f}).`,
  predWhyPersonal: "We use the personal one because it misses as much or less than the simple one.",
  predLowVotes: "Few ratings on TMDB: less reliable prediction",
  predWhySimple: "We use the simple one because it misses less.",
  predMore: "Rate more films to sharpen your predictions",
  predRateMore: "Keep rating",
  reasonCrowd: (tmdb: string) => `for its TMDB score (${tmdb})`,
  reasonDirector: (n: string) => `because it's by ${n}`,
  reasonCast: (n: string) => `for ${n} in the cast`,
  reasonGenre: (g: string) => `for being ${g}`,
  reasonDecade: "for its era",
  reasonRuntime: "for its length",
  reasonPopularity: "for how well known it is",
  reasonLanguage: "for its original language",
  reasonCountry: (c: string) => `for its country (${c})`,
  nextTitle: "What you should watch next",
  nextSub: "Your watchlist, ordered by the rating you'd give each film.",
  nextShowAll: (n: number) => `Show all ${n} films`,
  nextShowLess: "Show less",
  nextNone: "None of your watchlist films has enough data.",
  tmdbAttribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  footerBy: "Made by",
  sectionHidden: "Section hidden for lack of data",
};

const DICTS: Record<Lang, Dict> = { es, en };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  num: (n: number, digits?: number) => string;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("reelmate:lang");
    } catch {
      /* ignore */
    }
    const initial: Lang = saved === "en" || saved === "es" ? saved : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate language from browser after mount
    setLangState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("reelmate:lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const locale = lang === "es" ? "es-ES" : "en-US";
    return {
      lang,
      setLang,
      t: DICTS[lang],
      num: (n, digits = 1) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
