import { searchMovies } from "@/lib/server/tmdb";

/** Only the text typed in the search box reaches this route; the API key never leaves the server. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    return Response.json({ results: await searchMovies(q) });
  } catch {
    return Response.json({ error: "tmdb_unavailable" }, { status: 502 });
  }
}
