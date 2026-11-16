import { trainBest, trainFixed, type CvResult, type ModelKind, type Prediction, type Sample, type TrainedModel } from "./model";
import type { Movie } from "./types";

export interface TrainInfo {
  kind: ModelKind;
  n: number;
  cv: Pick<CvResult, "mae" | "within"> | null;
  compared: { personal: Pick<CvResult, "mae" | "within">; fallback: Pick<CvResult, "mae" | "within"> } | null;
}

export interface PredictItem {
  movie: Movie;
  filmYear: number | null;
  /** The user already rated this film: predict it with a model that has NOT seen that rating. */
  excludeId?: number;
}

const slim = (c: CvResult) => ({ mae: c.mae, within: c.within });

/** The stateful part, shared by the Web Worker and the main-thread fallback. */
export class Engine {
  private samples: Sample[] = [];
  private model: TrainedModel | null = null;
  private loo = new Map<number, ReturnType<typeof trainFixed>>();

  train(samples: Sample[], onProgress?: (p: number) => void): TrainInfo {
    this.samples = samples;
    this.loo.clear();
    this.model = trainBest(samples, { onProgress });
    const m = this.model;
    return {
      kind: m.kind,
      n: m.n,
      cv: m.cv ? slim(m.cv) : null,
      compared: m.compared ? { personal: slim(m.compared.personal), fallback: slim(m.compared.fallback) } : null,
    };
  }

  predict(items: PredictItem[]): Prediction[] {
    const m = this.model;
    if (!m) throw new Error("model_not_trained");
    return items.map((it) => {
      if (it.excludeId === undefined) return m.predictor.predict(it.movie, it.filmYear);
      let p = this.loo.get(it.excludeId);
      if (!p) {
        p = trainFixed(this.samples.filter((s) => s.movie.id !== it.excludeId), m.kind);
        this.loo.set(it.excludeId, p);
      }
      return p.predict(it.movie, it.filmYear);
    });
  }
}
