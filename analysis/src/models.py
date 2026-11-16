"""Model zoo used in the notebook (and mirrored, for the light ones, in web/lib/model.ts)."""

from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import MeanBaseline, TmdbDeviationBaseline

ALPHAS = np.logspace(-1, 3, 20)  # same grid as the web app
GENRE_PRIOR_M = 5.0


FREE_SCALE = 10.0  # multiplying a standardised column by 10 divides its ridge penalty by 100 (~ unpenalised)


class PartialRidge(BaseEstimator, RegressorMixin):
    """Ridge regression where the TMDB-score slope is (almost) not shrunk.

    All features are standardised; the penalty alpha is picked by efficient leave-one-out
    *inside the training data* (``RidgeCV``). The TMDB score is the single strongest and
    most reliable predictor, so we do not want the penalty to shrink it together with the
    noisy genre/country dummies. This is the model that is re-implemented in TypeScript.
    """

    free = "tmdb_vote"

    def __init__(self, free_scale=FREE_SCALE):
        self.free_scale = free_scale

    def fit(self, X, y):
        self.columns_ = list(X.columns)
        self.scaler_ = StandardScaler().fit(X)
        self._i = self.columns_.index(self.free)
        self.ridge_ = RidgeCV(alphas=ALPHAS).fit(self._z(X), y)
        self.alpha_ = float(self.ridge_.alpha_)
        self.intercept_ = float(self.ridge_.intercept_)
        coef = self.ridge_.coef_.copy()
        coef[self._i] *= self.free_scale
        self.coef_std_ = coef  # effect (in stars) of +1 standard deviation of each feature
        return self

    def _z(self, X):
        z = self.scaler_.transform(X)
        z[:, self._i] *= self.free_scale
        return z

    def predict(self, X):
        return self.ridge_.predict(self._z(X))


def ridge():
    return PartialRidge()


def knn():
    grid = {"n_neighbors": [5, 10, 15, 25, 40]}
    return make_pipeline(
        StandardScaler(),
        GridSearchCV(KNeighborsRegressor(weights="distance"), grid, cv=5, scoring="neg_mean_absolute_error"),
    )


def random_forest():
    return RandomForestRegressor(n_estimators=300, min_samples_leaf=3, max_features=0.4, random_state=0, n_jobs=-1)


def gradient_boosting():
    return HistGradientBoostingRegressor(
        max_iter=150, learning_rate=0.04, max_depth=3, min_samples_leaf=10, l2_regularization=1.0, random_state=0
    )


class TmdbGenreFallback(BaseEstimator, RegressorMixin):
    """Light model for users with very few ratings (< 30).

    prediction = user mean + (TMDB score - mean TMDB score of the user's films)
                 + average Bayesian-shrunk genre residual

    The genre residual of genre g is  sum(residuals of the user's films in g) / (n_g + 5),
    where residual = rating - (baseline b prediction). Only genre columns present in X are used.
    """

    def fit(self, X, y):
        y = np.asarray(y, float)
        self.mean_ = float(y.mean())
        self.vote_mean_ = float(X["tmdb_vote"].mean())
        resid = y - (self.mean_ + X["tmdb_vote"].to_numpy() - self.vote_mean_)
        self.genre_dev_ = {}
        for col in X.columns:
            if col.startswith("genre_"):
                m = X[col].to_numpy() > 0
                self.genre_dev_[col] = float(resid[m].sum() / (m.sum() + GENRE_PRIOR_M))
        return self

    def predict(self, X):
        base = self.mean_ + X["tmdb_vote"].to_numpy() - self.vote_mean_
        cols = list(self.genre_dev_)
        if not cols:
            return base
        G = X[cols].to_numpy()
        dev = np.array([self.genre_dev_[c] for c in cols])
        k = G.sum(axis=1)
        adj = np.where(k > 0, G @ dev / np.maximum(k, 1), 0.0)
        return base + adj


BASELINES = {"Baseline A: my mean": MeanBaseline, "Baseline B: mean + TMDB deviation": TmdbDeviationBaseline}
MODELS = {
    "Light fallback (TMDB + genres)": TmdbGenreFallback,
    "Ridge": ridge,
    "k-NN": knn,
    "Random Forest": random_forest,
    "Gradient Boosting": gradient_boosting,
}


SCALE_GRID = [1.0, 3.0, 10.0, 30.0, 100.0]  # candidate "how unpenalised is the TMDB slope" settings


M_GRID = [0.0, 100.0, 250.0, 500.0, 1000.0, 2500.0]  # candidate prior weights (votes) for the TMDB adjustment


def nested_cv(df, splits, kind="ridge", inner_splits=5, seed=0):
    """Nested cross-validation.

    Outer loop = the shared evaluation folds. Inside every outer training set an *inner* 5-fold
    CV chooses the hyper-parameters (features are rebuilt in every inner fold):
      * kind="ridge":    the TMDB vote prior m (M_GRID) and the TMDB-slope scale (SCALE_GRID);
                         alpha is picked by RidgeCV's own leave-one-out in every fit.
      * kind="fallback": the TMDB vote prior m only.
    The outer test fold is used once, to score the configuration chosen without it.
    """
    import pandas as pd
    from sklearn.model_selection import KFold
    from features import FeatureBuilder, clip, metrics

    y = df["rating"].to_numpy(float)
    grid = [(m, sc) for m in M_GRID for sc in (SCALE_GRID if kind == "ridge" else [None])]
    make = lambda sc: PartialRidge(sc) if kind == "ridge" else TmdbGenreFallback()
    name = "Ridge (nested CV)" if kind == "ridge" else "Light fallback (nested CV)"
    rows, oof, chosen = [], {}, []
    for fold, (tr, te, rep) in enumerate(splits):
        dtr = df.iloc[tr].reset_index(drop=True)
        ytr = y[tr]
        inner = {g: [] for g in grid}
        for itr, ival in KFold(inner_splits, shuffle=True, random_state=seed + fold).split(dtr):
            for m in M_GRID:
                fb = FeatureBuilder(m)
                Xi, Xv = fb.fit_transform(dtr.iloc[itr]), fb.transform(dtr.iloc[ival])
                for sc in (SCALE_GRID if kind == "ridge" else [None]):
                    p = clip(make(sc).fit(Xi, ytr[itr]).predict(Xv))
                    inner[(m, sc)].append(np.abs(p - ytr[ival]).mean())
        best = min(grid, key=lambda g: np.mean(inner[g]))
        chosen.append(best)
        fb = FeatureBuilder(best[0])
        Xtr, Xte = fb.fit_transform(df.iloc[tr]), fb.transform(df.iloc[te])
        p = clip(make(best[1]).fit(Xtr, y[tr]).predict(Xte))
        rows.append({"model": name, "fold": fold, "repeat": rep, **metrics(y[te], p)})
        for i, v in zip(te, p):
            oof.setdefault(i, []).append(v)
    return pd.DataFrame(rows), np.array([np.mean(oof[i]) for i in range(len(df))]), chosen
