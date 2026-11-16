import { pool, resolve } from "@/lib/server/tmdb";
import type { Enriched, LookupItem } from "@/lib/types";

const MAX_ITEMS = 25;

function clean(raw: unknown): LookupItem[] | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { items?: unknown }).items)) return null;
  const items = (raw as { items: unknown[] }).items;
  if (items.length > MAX_ITEMS) return null;
  const out: LookupItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") return null;
    const { k, title, year, tmdbId } = it as Record<string, unknown>;
    if (typeof k !== "string" || typeof title !== "string" || !title.trim() || title.length > 200) return null;
    const y = typeof year === "number" && Number.isInteger(year) && year > 1850 && year < 2100 ? year : null;
    const id = typeof tmdbId === "number" && Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : undefined;
    out.push({ k: k.slice(0, 300), title: title.trim(), year: y, tmdbId: id });
  }
  return out;
}

/** Only titles and years arrive here; the API key never leaves the server. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const items = clean(body);
  if (!items) return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const results = await pool(items, 5, async (it) => {
      try {
        return [it.k, await resolve(it)] as const;
      } catch (e) {
        if (e instanceof Error && e.message.includes("TMDB_API_KEY")) throw e;
        return [it.k, { status: "notfound" } as Enriched] as const;
      }
    });
    return Response.json({ results: Object.fromEntries(results) });
  } catch {
    return Response.json({ error: "tmdb_unavailable" }, { status: 502 });
  }
}
