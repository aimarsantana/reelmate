import type { Enriched, Profile } from "./types";

/* Everything here lives in the user's own browser (IndexedDB). Nothing goes to a server. */

const DB = "reelmate";
const VERSION = 1;
const CACHE_PREFIX = "v1:";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("enriched")) db.createObjectStore("enriched");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function safe<T>(fallback: T, fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  try {
    if (typeof indexedDB === "undefined") return fallback;
    const db = await open();
    try {
      return await fn(db);
    } finally {
      db.close();
    }
  } catch {
    return fallback;
  }
}

export const saveProfile = (p: Profile) =>
  safe<void>(undefined, async (db) => {
    await wrap(db.transaction("kv", "readwrite").objectStore("kv").put(p, "profile"));
  });

export const loadProfile = () =>
  safe<Profile | null>(null, async (db) => {
    const v = await wrap(db.transaction("kv").objectStore("kv").get("profile"));
    return (v as Profile | undefined) ?? null;
  });

export const getCached = (keys: string[]) =>
  safe<Record<string, Enriched>>({}, async (db) => {
    const store = db.transaction("enriched").objectStore("enriched");
    const out: Record<string, Enriched> = {};
    await Promise.all(
      keys.map(async (k) => {
        const v = (await wrap(store.get(CACHE_PREFIX + k))) as Enriched | undefined;
        if (v) out[k] = v;
      }),
    );
    return out;
  });

export const putCached = (entries: Record<string, Enriched>) =>
  safe<void>(undefined, async (db) => {
    const tx = db.transaction("enriched", "readwrite");
    const store = tx.objectStore("enriched");
    for (const [k, v] of Object.entries(entries)) store.put(v, CACHE_PREFIX + k);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });

/** "Borrar mis datos": wipes IndexedDB and every localStorage key the app owns. */
export async function clearAll() {
  await safe<void>(undefined, async (db) => {
    const tx = db.transaction(["kv", "enriched"], "readwrite");
    tx.objectStore("kv").clear();
    tx.objectStore("enriched").clear();
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("reelmate:")) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem("reelmate:" + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem("reelmate:" + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
