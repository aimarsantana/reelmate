import type { NextRequest } from "next/server";

const USER_RE = /^[A-Za-z0-9_-]{1,40}$/;

interface RssEntry {
  title: string;
  year: number | null;
  rating?: number;
  rewatch: boolean;
  tmdbId?: number;
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  return m[1]
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

/** Parses only the public RSS feed. Nothing else on Letterboxd is read. */
function parseRss(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = tag(block, "letterboxd:filmTitle");
    if (!title) continue; // list items etc.
    const year = Number(tag(block, "letterboxd:filmYear"));
    const rating = Number(tag(block, "letterboxd:memberRating"));
    const tmdb = Number(tag(block, "tmdb:movieId"));
    entries.push({
      title,
      year: Number.isInteger(year) && year > 1850 ? year : null,
      rating: rating >= 0.5 && rating <= 5 ? rating : undefined,
      rewatch: tag(block, "letterboxd:rewatch") === "Yes",
      tmdbId: Number.isInteger(tmdb) && tmdb > 0 ? tmdb : undefined,
    });
  }
  return entries;
}

export async function GET(req: NextRequest) {
  const user = (req.nextUrl.searchParams.get("user") ?? "").trim().replace(/^@/, "");
  if (!USER_RE.test(user)) return Response.json({ error: "invalid_user" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`https://letterboxd.com/${encodeURIComponent(user)}/rss/`, {
      headers: { "User-Agent": "Reelmate/1.0 (personal film taste dashboard)", Accept: "application/rss+xml, text/xml" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return Response.json({ error: "unreachable" }, { status: 502 });
  }
  if (res.status === 404) return Response.json({ error: "not_found" }, { status: 404 });
  if (!res.ok) return Response.json({ error: "unreachable" }, { status: 502 });

  const entries = parseRss(await res.text());
  return Response.json({ username: user, entries });
}
