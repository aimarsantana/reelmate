"""Build the modelling dataset: Letterboxd export (.zip) + TMDB metadata.

Usage (from the repo root or from analysis/):
    python analysis/src/build_dataset.py [path/to/letterboxd-export.zip]

* Reads ratings.csv, watchlist.csv and likes/films.csv from the Letterboxd export.
* Looks every film up on TMDB (same matching rules as web/lib/server/tmdb.ts).
* Reads the TMDB key from web/.env.local (TMDB_API_KEY); the key is never written anywhere.
* Writes analysis/data/films.json (ignored by git: regenerate it with this script)
  and caches raw TMDB responses in analysis/data/tmdb_cache/.
"""

from __future__ import annotations

import csv
import glob
import hashlib
import io
import json
import re
import sys
import time
import unicodedata
import zipfile
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "analysis" / "data"
CACHE = DATA / "tmdb_cache"
BASE = "https://api.themoviedb.org/3"


def norm(s: str) -> str:
    """Lowercase, no accents, only letters and digits (same as web/lib/keys.ts)."""
    s = unicodedata.normalize("NFD", s)
    s = re.sub(r"[̀-ͯ]", "", s).lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "", s)


def read_zip(path: Path) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    with zipfile.ZipFile(path) as z:
        for name in ("ratings.csv", "watchlist.csv", "likes/films.csv"):
            if name in z.namelist():
                text = z.read(name).decode("utf-8-sig")
                out[name] = list(csv.DictReader(io.StringIO(text)))
    return out


class Tmdb:
    def __init__(self, key: str):
        self.key = key
        self.session = requests.Session()
        CACHE.mkdir(parents=True, exist_ok=True)

    def get(self, path: str, **params):
        params = {"language": "en-US", **params}
        tag = hashlib.sha1((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()
        f = CACHE / f"{tag}.json"
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))
        for attempt in range(4):
            r = self.session.get(BASE + path, params={**params, "api_key": self.key}, timeout=30)
            if r.status_code == 404:
                data = None
                break
            if r.status_code == 429:
                time.sleep(min(float(r.headers.get("retry-after", 1)), 5))
                continue
            r.raise_for_status()
            data = r.json()
            break
        else:
            raise RuntimeError(f"TMDB failed for {path}")
        f.write_text(json.dumps(data), encoding="utf-8")  # raw API key is NOT part of the cache
        return data

    def details(self, tmdb_id: int) -> dict | None:
        d = self.get(f"/movie/{tmdb_id}", append_to_response="credits")
        if not d:
            return None
        crew = (d.get("credits") or {}).get("crew") or []
        cast = sorted((d.get("credits") or {}).get("cast") or [], key=lambda c: c["order"])
        year = d["release_date"][:4] if d.get("release_date") else None
        return {
            "tmdb_id": d["id"],
            "tmdb_title": d["title"],
            "year": int(year) if year else None,
            "genres": [g["id"] for g in d.get("genres", [])],
            "directors": list(dict.fromkeys(c["name"] for c in crew if c["job"] == "Director")),
            "cast": [c["name"] for c in cast[:5]],
            "runtime": d.get("runtime") or None,
            "countries": [c["iso_3166_1"] for c in d.get("production_countries", [])],
            "lang": d.get("original_language"),
            "vote": d.get("vote_average") or 0.0,
            "votes": d.get("vote_count") or 0,
            "popularity": d.get("popularity") or 0.0,
            "poster": d.get("poster_path"),
        }

    def match(self, title: str, year: int | None) -> tuple[str, dict | None]:
        """Same strategy as the web app: exact year first, then any year within ±1."""
        attempts = ([{"query": title, "year": str(year)}] if year else []) + [{"query": title}]
        for params in attempts:
            res = self.get("/search/movie", include_adult="false", **params) or {"results": []}
            cands = []
            for r in res["results"]:
                y = int(r["release_date"][:4]) if r.get("release_date") else None
                if year is None or (y is not None and abs(y - year) <= 1):
                    cands.append((r, y))
            if not cands:
                continue

            def score(c):
                r, y = c
                same = norm(r["title"]) == norm(title) or norm(r["original_title"]) == norm(title)
                return (100 if same else 0) + (10 if year and y == year else 0) + min(r.get("popularity", 0), 9) / 10

            cands.sort(key=score, reverse=True)
            best = cands[0][0]
            exact = norm(best["title"]) == norm(title) or norm(best["original_title"]) == norm(title)
            movie = self.details(best["id"])
            if movie:
                return ("ok" if exact else "doubtful"), movie
        return "notfound", None


def main() -> None:
    zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(sorted(glob.glob(str(ROOT / "letterboxd-*.zip")))[-1])
    key = dotenv_values(ROOT / "web" / ".env.local").get("TMDB_API_KEY")
    if not key:
        sys.exit("TMDB_API_KEY not found in web/.env.local")
    tables = read_zip(zip_path)
    liked = {(r["Name"], r["Year"]) for r in tables.get("likes/films.csv", [])}
    tmdb = Tmdb(key)

    rows = []
    todo = [("rated", r) for r in tables["ratings.csv"]] + [("watchlist", r) for r in tables.get("watchlist.csv", [])]
    for i, (split, r) in enumerate(todo, 1):
        title, year = r["Name"].strip(), int(r["Year"]) if r.get("Year") else None
        status, movie = tmdb.match(title, year)
        rows.append(
            {
                "split": split,
                "title": title,
                "year_lb": year,
                "rating": float(r["Rating"]) if split == "rated" else None,
                "liked": (r["Name"], r["Year"]) in liked,
                "status": status,
                **(movie or {}),
            }
        )
        if i % 50 == 0:
            print(f"{i}/{len(todo)}")
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "films.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter

    print(Counter((r["split"], r["status"]) for r in rows))
    print(f"Wrote {DATA / 'films.json'}")


if __name__ == "__main__":
    main()
