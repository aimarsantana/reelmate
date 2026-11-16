"""Export the Python reference results used by the TypeScript equivalence test.

Writes web/lib/__fixtures__/python-reference.json. It contains only fold indices, metrics and
predictions (no titles, no TMDB data), so it is safe to commit. The TypeScript test
(web/lib/model.test.ts) re-runs the same folds with the TypeScript model and compares.

Row order = rated films found on TMDB, in the order of analysis/data/films.json.
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import FeatureBuilder, clip, load_dataset, make_splits, metrics  # noqa: E402
from models import PartialRidge, TmdbGenreFallback  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "web" / "lib" / "__fixtures__" / "python-reference.json"

df = load_dataset()
y = df["rating"].to_numpy(float)
splits = make_splits(len(df), n_splits=5, n_repeats=10, seed=42)

ref = {"n": len(df), "folds": [], "ridge": {"mae": [], "within": []}, "fallback": {"mae": [], "within": []}}
oof = {"ridge": np.zeros(len(df)), "fallback": np.zeros(len(df))}
alphas = []
for tr, te, rep in splits:
    fb = FeatureBuilder()
    Xtr, Xte = fb.fit_transform(df.iloc[tr]), fb.transform(df.iloc[te])
    for name, model in (("ridge", PartialRidge()), ("fallback", TmdbGenreFallback())):
        m = model.fit(Xtr, y[tr])
        p = clip(m.predict(Xte))
        mt = metrics(y[te], p)
        ref[name]["mae"].append(mt["MAE"])
        ref[name]["within"].append(mt["within_0.5"])
        if rep == 0:
            oof[name][te] = p
        if name == "ridge":
            alphas.append(m.alpha_)
    ref["folds"].append({"test": [int(i) for i in te], "repeat": rep})

ref["ridge"]["meanMae"] = float(np.mean(ref["ridge"]["mae"]))
ref["fallback"]["meanMae"] = float(np.mean(ref["fallback"]["mae"]))
ref["ridge"]["alphas"] = alphas
ref["ridge"]["oofRep0"] = [round(float(v), 6) for v in oof["ridge"]]
ref["fallback"]["oofRep0"] = [round(float(v), 6) for v in oof["fallback"]]

full = FeatureBuilder()
Xf = full.fit_transform(df)
fm = PartialRidge().fit(Xf, y)
ref["full"] = {"alpha": fm.alpha_, "intercept": fm.intercept_, "columns": list(Xf.columns), "coefStd": [float(c) for c in fm.coef_std_]}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(ref), encoding="utf-8")
print(f"wrote {OUT}  ridge MAE {ref['ridge']['meanMae']:.4f}  fallback MAE {ref['fallback']['meanMae']:.4f}  alpha(full) {fm.alpha_:.1f}")
