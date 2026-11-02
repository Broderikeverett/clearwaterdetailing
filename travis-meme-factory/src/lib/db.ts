/** Tiny promise wrapper around IndexedDB. Falls back to in-memory storage if IDB is unavailable. */
const DB_NAME = 'travis-meme-factory';
const DB_VERSION = 1;
export const STORES = ['memes', 'collections', 'photos', 'leaderboard', 'kv'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<string, Map<string, unknown>> = {};
export let usingMemoryFallback = false;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) throw new Error('no idb');
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        usingMemoryFallback = true;
        resolve(null);
      };
      req.onblocked = () => {
        usingMemoryFallback = true;
        resolve(null);
      };
    } catch {
      usingMemoryFallback = true;
      resolve(null);
    }
  });
  // Ask the browser not to evict our memes when storage gets tight.
  navigator.storage?.persist?.().catch(() => {});
  return dbPromise;
}

const mem = (store: StoreName) => (memory[store] ??= new Map());

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error('memory'));
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? new Error('IndexedDB transaction failed'));
        t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted (storage full?)'));
      }),
  );
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  if (!db) return [...mem(store).values()] as T[];
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem(store).get(key) as T | undefined;
  return tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export async function put<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await open();
  if (!db) {
    mem(store).set(key, value);
    return;
  }
  await tx(store, 'readwrite', (s) => s.put(value, key));
}

export async function del(store: StoreName, key: string): Promise<void> {
  const db = await open();
  if (!db) {
    mem(store).delete(key);
    return;
  }
  await tx(store, 'readwrite', (s) => s.delete(key));
}
