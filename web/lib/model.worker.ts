/// <reference lib="webworker" />
import { Engine, type PredictItem } from "./modelEngine";
import type { Sample } from "./model";

type In = { type: "train"; samples: Sample[] } | { type: "predict"; id: number; items: PredictItem[] };

const engine = new Engine();
const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent<In>) => void) | null };

ctx.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === "train") {
      const info = engine.train(msg.samples, (p) => ctx.postMessage({ type: "progress", p }));
      ctx.postMessage({ type: "trained", info });
    } else {
      ctx.postMessage({ type: "predicted", id: msg.id, results: engine.predict(msg.items) });
    }
  } catch (err) {
    ctx.postMessage({ type: "error", id: msg.type === "predict" ? msg.id : -1, message: String(err) });
  }
};
