import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Collection, LeaderboardEntry, Meme, Photo } from './types';
import * as db from './lib/db';
import { thumbnail } from './lib/memes';
import { uid } from './lib/random';

export interface Toast {
  id: string;
  text: string;
  kind: 'ok' | 'err' | 'info';
}

export interface CustomTemplate extends Photo {
  name: string;
}

interface Store {
  ready: boolean;
  memes: Meme[];
  collections: Collection[];
  photos: Photo[];
  customTemplates: CustomTemplate[];
  leaderboard: LeaderboardEntry[];
  saveMeme: (m: Meme) => Promise<Meme>;
  deleteMeme: (id: string) => Promise<void>;
  addCollection: (name: string, emoji?: string) => Promise<Collection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addPhoto: (p: Omit<Photo, 'id' | 'createdAt'>) => Promise<Photo>;
  deletePhoto: (id: string) => Promise<void>;
  addCustomTemplate: (p: Omit<CustomTemplate, 'id' | 'createdAt'>) => Promise<void>;
  deleteCustomTemplate: (id: string) => Promise<void>;
  upsertLeaderboard: (e: LeaderboardEntry) => Promise<void>;
  resetLeaderboard: () => Promise<void>;
  toast: (text: string, kind?: Toast['kind']) => void;
  toasts: Toast[];
  /** meme handed to the editor (from templates, random button, saved, etc.) */
  draft: Meme | null;
  openInEditor: (m: Meme) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

const byNewest = <T extends { updatedAt?: number; createdAt: number }>(a: T, b: T) =>
  (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);

export function StoreProvider({ children, navigate }: { children: ReactNode; navigate: (route: string) => void }) {
  const [ready, setReady] = useState(false);
  const [memes, setMemes] = useState<Meme[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draft, setDraft] = useState<Meme | null>(null);
  const navRef = useRef(navigate);
  navRef.current = navigate;

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = uid('toast');
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 5500 : 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [m, c, p, lb, ct] = await Promise.all([
          db.getAll<Meme>('memes'),
          db.getAll<Collection>('collections'),
          db.getAll<Photo>('photos'),
          db.getAll<LeaderboardEntry>('leaderboard'),
          db.getAll<CustomTemplate>('kv').then((rows) => rows.filter((r) => r && (r as CustomTemplate).src)),
        ]);
        setMemes(m.sort(byNewest));
        setCollections(c.sort((a, b) => a.createdAt - b.createdAt));
        setPhotos(p.sort(byNewest));
        setLeaderboard(lb);
        setCustomTemplates(ct.sort(byNewest));
        if (db.usingMemoryFallback) toast("Storage is blocked in this browser, so memes won't survive a refresh.", 'err');
      } catch (e) {
        toast('Could not load your saved memes: ' + (e as Error).message, 'err');
      } finally {
        setReady(true);
      }
    })();
  }, [toast]);

  const guard = useCallback(
    async <T,>(fn: () => Promise<T>, msg: string): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        const err = e as Error;
        toast(`${msg}: ${/quota/i.test(err.message) ? 'storage is full — delete some memes' : err.message}`, 'err');
        throw e;
      }
    },
    [toast],
  );

  const saveMeme = useCallback(
    (m: Meme) =>
      guard(async () => {
        const saved: Meme = { ...m, updatedAt: Date.now(), thumbnail: await thumbnail(m) };
        await db.put('memes', saved.id, saved);
        setMemes((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
        return saved;
      }, "Couldn't save"),
    [guard],
  );

  const deleteMeme = useCallback(
    (id: string) =>
      guard(async () => {
        await db.del('memes', id);
        setMemes((list) => list.filter((x) => x.id !== id));
      }, "Couldn't delete"),
    [guard],
  );

  const addCollection = useCallback(
    (name: string, emoji = '📁') =>
      guard(async () => {
        const c: Collection = { id: uid('c'), name: name.trim() || 'Untitled', emoji, createdAt: Date.now() };
        await db.put('collections', c.id, c);
        setCollections((l) => [...l, c]);
        return c;
      }, "Couldn't create collection"),
    [guard],
  );

  const renameCollection = useCallback(
    (id: string, name: string) =>
      guard(async () => {
        const c = collections.find((x) => x.id === id);
        if (!c) return;
        const next = { ...c, name };
        await db.put('collections', id, next);
        setCollections((l) => l.map((x) => (x.id === id ? next : x)));
      }, "Couldn't rename"),
    [guard, collections],
  );

  const deleteCollection = useCallback(
    (id: string) =>
      guard(async () => {
        await db.del('collections', id);
        // memes stay, they just become uncategorized
        const affected = memes.filter((m) => m.collectionId === id);
        await Promise.all(affected.map((m) => db.put('memes', m.id, { ...m, collectionId: null })));
        setMemes((l) => l.map((m) => (m.collectionId === id ? { ...m, collectionId: null } : m)));
        setCollections((l) => l.filter((x) => x.id !== id));
      }, "Couldn't delete collection"),
    [guard, memes],
  );

  const addPhoto = useCallback(
    (p: Omit<Photo, 'id' | 'createdAt'>) =>
      guard(async () => {
        const ph: Photo = { ...p, id: uid('p'), createdAt: Date.now() };
        await db.put('photos', ph.id, ph);
        setPhotos((l) => [ph, ...l]);
        return ph;
      }, "Couldn't save photo"),
    [guard],
  );

  const deletePhoto = useCallback(
    (id: string) =>
      guard(async () => {
        await db.del('photos', id);
        setPhotos((l) => l.filter((x) => x.id !== id));
      }, "Couldn't delete photo"),
    [guard],
  );

  const addCustomTemplate = useCallback(
    (p: Omit<CustomTemplate, 'id' | 'createdAt'>) =>
      guard(async () => {
        const t: CustomTemplate = { ...p, id: uid('ct'), createdAt: Date.now() };
        await db.put('kv', t.id, t);
        setCustomTemplates((l) => [t, ...l]);
      }, "Couldn't save template"),
    [guard],
  );

  const deleteCustomTemplate = useCallback(
    (id: string) =>
      guard(async () => {
        await db.del('kv', id);
        setCustomTemplates((l) => l.filter((x) => x.id !== id));
      }, "Couldn't delete template"),
    [guard],
  );

  const upsertLeaderboard = useCallback(
    (e: LeaderboardEntry) =>
      guard(async () => {
        await db.put('leaderboard', e.id, e);
        setLeaderboard((l) => [e, ...l.filter((x) => x.id !== e.id)]);
      }, "Couldn't record vote"),
    [guard],
  );

  const resetLeaderboard = useCallback(
    () =>
      guard(async () => {
        await Promise.all(leaderboard.map((e) => db.del('leaderboard', e.id)));
        setLeaderboard([]);
      }, "Couldn't reset"),
    [guard, leaderboard],
  );

  const openInEditor = useCallback((m: Meme) => {
    setDraft(m);
    navRef.current('create');
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready, memes, collections, photos, customTemplates, leaderboard,
      saveMeme, deleteMeme, addCollection, renameCollection, deleteCollection,
      addPhoto, deletePhoto, addCustomTemplate, deleteCustomTemplate,
      upsertLeaderboard, resetLeaderboard, toast, toasts, draft, openInEditor,
    }),
    [ready, memes, collections, photos, customTemplates, leaderboard, saveMeme, deleteMeme, addCollection, renameCollection,
      deleteCollection, addPhoto, deletePhoto, addCustomTemplate, deleteCustomTemplate, upsertLeaderboard, resetLeaderboard,
      toast, toasts, draft, openInEditor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
