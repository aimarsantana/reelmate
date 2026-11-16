import type { Prediction, Sample } from "./model";
import { Engine, type PredictItem, type TrainInfo } from "./modelEngine";

export interface ModelHandle {
  info: TrainInfo;
  predict: (items: PredictItem[]) => Promise<Prediction[]>;
  dispose: () => void;
}

/**
 * Trains the rating model without blocking the UI: in a Web Worker when available,
 * otherwise (very old browsers) on the main thread in a timeout.
 */
export function trainModel(samples: Sample[], onProgress: (p: number) => void): { promise: Promise<ModelHandle>; cancel: () => void } {
  let worker: Worker | null = null;
  let cancelled = false;
  const promise = new Promise<ModelHandle>((resolve, reject) => {
    if (typeof Worker === "undefined") {
      setTimeout(() => {
        if (cancelled) return;
        try {
          const engine = new Engine();
          const info = engine.train(samples, onProgress);
          resolve({ info, predict: async (items) => engine.predict(items), dispose: () => {} });
        } catch (e) {
          reject(e);
        }
      }, 30);
      return;
    }
    worker = new Worker(new URL("./model.worker.ts", import.meta.url));
    const w = worker;
    let seq = 0;
    const pending = new Map<number, { ok: (r: Prediction[]) => void; fail: (e: Error) => void }>();
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "progress") onProgress(m.p);
      else if (m.type === "trained")
        resolve({
          info: m.info,
          predict: (items) =>
            new Promise((ok, fail) => {
              const id = ++seq;
              pending.set(id, { ok, fail });
              w.postMessage({ type: "predict", id, items });
            }),
          dispose: () => w.terminate(),
        });
      else if (m.type === "predicted") pending.get(m.id)?.ok(m.results);
      else if (m.type === "error") (m.id === -1 ? reject : pending.get(m.id)?.fail)?.(new Error(m.message));
    };
    w.onerror = () => reject(new Error("worker_failed"));
    w.postMessage({ type: "train", samples });
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
    },
  };
}
