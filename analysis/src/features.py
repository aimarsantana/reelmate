"""Feature engineering and cross-validation helpers for the rating model.

The key design rule: *everything that learns from the ratings* (target encoding of
directors/actors, the global mean C, imputation values, which genre/country columns
exist) is fitted on the training fold only. See ``FeatureBuilder``.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.model_selection import RepeatedKFold

DATA = Path(__file__).resolve().parents[1] / "data"

# Same constants as the web app (web/lib/stats.ts, PRIOR_M) and its TypeScript port (web/lib/model.ts).
PRIOR_M = {"director": 3.0, "cast": 3.0}
MIN_GENRE = 5  # a genre column exists only if >= 5 training films have it
MIN_COUNTRY = 8  # same for countries
MIN_VOTES = 50  # used only by the EDA / "you vs. the world" view, not by the model
TMDB_C = 6.5  # global TMDB average (0-10), the prior of the Bayesian adjustment
VOTE_M = 500.0  # prior weight in votes: adjusted = (v*R + m*C) / (v + m)


def adjusted_vote(vote: float, votes: float, m: float = VOTE_M) -> float:
    """Bayesian-shrunk TMDB average (0-10). Few votes -> pulled towards the global mean C."""
    return (votes * vote + m * TMDB_C) / (votes + m) if votes + m > 0 else TMDB_C


def load_dataset(path: Path | None = None, split: str = "rated") -> pd.DataFrame:
    rows = json.loads((path or DATA / "films.json").read_text(encoding="utf-8"))
    df = pd.DataFrame(rows)
    return df[(df["split"] == split) & (df["status"] != "notfound")].reset_index(drop=True)


class FeatureBuilder:
    """Turns raw film rows into a numeric feature table.

    ``fit(train)`` learns everything from the training fold. ``transform(df)`` is used for
    unseen films. ``fit_transform(train)`` returns the training features computed with
    **leave-one-out target encoding**: when encoding a training film, its own rating is
    removed from the director/actor statistics. Without that, the encoding of a film that
    is the only one by its director would simply *be* its own rating (target leakage).
    """

    def __init__(self, vote_m: float = VOTE_M):
        self.vote_m = vote_m

    def fit(self, train: pd.DataFrame) -> "FeatureBuilder":
        y = train["rating"].to_numpy(float)
        self.C = float(y.mean())
        gcount: dict[int, int] = {}
        ccount: dict[str, int] = {}
        for gs, cs in zip(train["genres"], train["countries"]):
            for g in set(gs):
                gcount[g] = gcount.get(g, 0) + 1
            for c in set(cs):
                ccount[c] = ccount.get(c, 0) + 1
        self.genres = sorted(g for g, k in gcount.items() if k >= MIN_GENRE)
        self.countries = sorted(c for c, k in ccount.items() if k >= MIN_COUNTRY)
        rt = train["runtime"].dropna()
        self.runtime_median = float(np.median(rt)) if len(rt) else 100.0
        # sum of ratings and count per director / actor, on the training fold only
        self.stats: dict[str, dict[str, list[float]]] = {"director": {}, "cast": {}}
        for kind, col in (("director", "directors"), ("cast", "cast")):
            for r, keys in zip(y, train[col]):
                for k in set(keys):
                    s = self.stats[kind].setdefault(k, [0.0, 0])
                    s[0] += r
                    s[1] += 1
        return self

    # --- target encoding -------------------------------------------------------------
    def _dev(self, kind: str, key: str, own: float | None) -> float:
        """Bayesian-smoothed deviation of one director/actor from the global mean C.

        (n*mean + m*C)/(n+m) - C  ==  (sum - n*C)/(n+m).  ``own`` removes the film's own rating (LOO).
        """
        s, n = self.stats[kind].get(key, (0.0, 0))
        if own is not None:
            s, n = s - own, n - 1
        return (s - n * self.C) / (n + PRIOR_M[kind])

    def encode(self, kind: str, keys: list[str], own: float | None) -> float:
        keys = list(set(keys))
        return float(np.mean([self._dev(kind, k, own) for k in keys])) if keys else 0.0

    # --- numeric table -------------------------------------------------------------
    def _transform(self, df: pd.DataFrame, loo: bool) -> pd.DataFrame:
        rows = []
        for _, f in df.iterrows():
            own = float(f["rating"]) if loo else None
            year = f["year"] if pd.notna(f["year"]) else f["year_lb"]
            row: dict[str, float] = {
                "decade": (np.floor(year / 10) * 10 - 1900) / 10,
                "runtime": f["runtime"] if pd.notna(f["runtime"]) else self.runtime_median,
                "log_popularity": float(np.log1p(f["popularity"])),
                "tmdb_vote": adjusted_vote(f["vote"], f["votes"], self.vote_m) / 2,
                "english": float(f["lang"] == "en"),
                "director_te": self.encode("director", f["directors"], own),
                "cast_te": self.encode("cast", f["cast"], own),
            }
            for g in self.genres:
                row[f"genre_{g}"] = float(g in f["genres"])
            for c in self.countries:
                row[f"country_{c}"] = float(c in f["countries"])
            rows.append(row)
        return pd.DataFrame(rows)

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._transform(df, loo=False)

    def fit_transform(self, train: pd.DataFrame) -> pd.DataFrame:
        return self.fit(train)._transform(train, loo=True)


# ---------------------------------------------------------------------------------------
# Baselines (same fit/predict interface as scikit-learn, but they read raw feature columns)
# ---------------------------------------------------------------------------------------
class MeanBaseline(BaseEstimator, RegressorMixin):
    """(a) Always predict the user's average rating."""

    def fit(self, X, y):
        self.mean_ = float(np.mean(y))
        return self

    def predict(self, X):
        return np.full(len(X), self.mean_)


class TmdbDeviationBaseline(BaseEstimator, RegressorMixin):
    """(b) User's average + how far the film is from the TMDB average (slope fixed at 1)."""

    def fit(self, X, y):
        self.mean_ = float(np.mean(y))
        self.tmdb_mean_ = float(X["tmdb_vote"].mean())
        return self

    def predict(self, X):
        return self.mean_ + (X["tmdb_vote"].to_numpy() - self.tmdb_mean_)


def clip(p):
    return np.clip(p, 0.5, 5.0)


def metrics(y, p) -> dict[str, float]:
    p = clip(np.asarray(p))
    e = p - np.asarray(y)
    return {
        "MAE": float(np.abs(e).mean()),
        "RMSE": float(np.sqrt((e**2).mean())),
        "within_0.5": float((np.abs(e) <= 0.5 + 1e-9).mean() * 100),
    }


def make_splits(n: int, n_splits: int = 5, n_repeats: int = 10, seed: int = 42):
    """One list of (train_idx, test_idx, repeat) shared by *all* models."""
    rkf = RepeatedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=seed)
    return [(tr, te, i // n_splits) for i, (tr, te) in enumerate(rkf.split(np.arange(n)))]


def cross_validate(df: pd.DataFrame, models: dict, splits, vote_m: float = VOTE_M):
    """Evaluate every model on exactly the same folds; features are rebuilt inside each fold."""
    y = df["rating"].to_numpy(float)
    rows, oof = [], {name: [[] for _ in range(len(df))] for name in models}
    for fold, (tr, te, rep) in enumerate(splits):
        fb = FeatureBuilder(vote_m)
        Xtr = fb.fit_transform(df.iloc[tr])  # LOO target encoding on the training fold
        Xte = fb.transform(df.iloc[te])  # test films never touched the encoding
        for name, make in models.items():
            m = make().fit(Xtr, y[tr])
            p = clip(m.predict(Xte))
            rows.append({"model": name, "fold": fold, "repeat": rep, **metrics(y[te], p)})
            for i, v in zip(te, p):
                oof[name][i].append(v)
    res = pd.DataFrame(rows)
    oof_mean = {k: np.array([np.mean(v) for v in vs]) for k, vs in oof.items()}
    return res, oof_mean
