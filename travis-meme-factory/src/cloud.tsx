import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meme } from './types';

/*
 * Shared, group-wide state when the app runs as a published claude.ai Artifact:
 *  - lore:   stories about Travis that feed the AI roaster
 *  - wall:   memes posted for the whole group
 *  - battle: the shared Elo leaderboard
 *  - sample: Claude itself, for roasts written from the lore
 * Outside claude.ai (npm run dev, a plain static host) every capability resolves
 * null and the app falls back to on-device storage + offline jokes.
 */

/* ---- minimal typings for the runtime we use ---- */
type Unsub = () => void;
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface QuerySnap { docs: DocSnap[]; metadata?: { fromCache?: boolean } }
interface DocRef { id: string; set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; get(): Promise<DocSnap> }
interface Query { orderBy(f: string, dir?: 'asc' | 'desc'): Query; limit(n: number): Query; onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code?: string; message?: string }) => void): Unsub }
interface Coll extends Query { doc(id?: string): DocRef }
interface DB { collection(path: string): Coll; doc(path: string): DocRef }
type SampleFn = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};
interface Downloads { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }
interface UserCap { id(): Promise<string>; isOwner(): boolean; profiles(ids: string[]): Promise<Record<string, { name?: string }>> }
interface ClaudeRuntime { use(name: string): Promise<unknown> }

const runtime = (): ClaudeRuntime | null => (typeof window !== 'undefined' && (window as unknown as { claude?: ClaudeRuntime }).claude?.use ? (window as unknown as { claude: ClaudeRuntime }).claude : null);
export const inArtifact = () => runtime() !== null;

const useCap = <T,>(name: string): Promise<T | null> => {
  const rt = runtime();
  if (!rt) return Promise.resolve(null);
  return rt.use(name).then((x) => (x ?? null) as T | null, () => null);
};

/** Save a file: platform download prompt inside claude.ai, plain <a download> elsewhere. */
export async function saveFile(blob: Blob, filename: string): Promise<'saved' | 'declined' | 'fallback'> {
  const dl = await useCap<Downloads>('downloads');
  if (dl) {
    try {
      await dl.save({ filename, data: blob });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'declined' || code === 'cancelled' || code === 'not_granted') return 'declined';
      if (code !== 'unavailable') throw new Error((e as Error).message || 'Download failed');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'fallback';
}

/* ---- shared records ---- */
export interface LoreStory { id: string; text: string; by: string; createdAt: number }
export interface WallPost { id: string; title: string; image: string; meme?: Meme; by: string; createdAt: number }
export interface BattleEntry { id: string; memeId: string | null; title: string; thumbnail: string; meme?: Meme; rating: number; wins: number; losses: number; updatedAt: number }

export type Spice = 'spicy' | 'savage' | 'nuclear';

interface Cloud {
  /** 'local' = not on claude.ai; 'connecting'; 'live'; 'error' */
  status: 'local' | 'connecting' | 'live' | 'error';
  lore: LoreStory[];
  wall: WallPost[];
  battle: BattleEntry[];
  me: string;
  isOwner: boolean;
  names: Record<string, string>;
  ai: SampleFn | null;
  addLore: (text: string) => Promise<void>;
  deleteLore: (id: string) => Promise<void>;
  postToWall: (p: Omit<WallPost, 'id' | 'by' | 'createdAt'>) => Promise<void>;
  deleteWall: (id: string) => Promise<void>;
  putBattle: (e: BattleEntry) => Promise<void>;
  resetBattle: () => Promise<void>;
}

const Ctx = createContext<Cloud | null>(null);
export const useCloud = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud outside provider');
  return c;
};

/* local-only lore fallback so the Lore page still works in dev */
const LOCAL_LORE = 'tmf-local-lore';
const readLocalLore = (): LoreStory[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LORE) || '[]');
  } catch {
    return [];
  }
};
const writeLocalLore = (l: LoreStory[]) => {
  try {
    localStorage.setItem(LOCAL_LORE, JSON.stringify(l));
  } catch {
    /* storage blocked */
  }
};

/** Keep shared docs under the 256 KiB cap: drop embedded meme JSON that is too big. */
export const slimMeme = (m: Meme): Meme | undefined => {
  const { thumbnail: _t, ...rest } = m;
  void _t;
  const json = JSON.stringify(rest);
  return json.length < 120_000 ? (rest as Meme) : undefined;
};

export function CloudProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Cloud['status']>(runtime() ? 'connecting' : 'local');
  const [lore, setLore] = useState<LoreStory[]>(() => (runtime() ? [] : readLocalLore()));
  const [wall, setWall] = useState<WallPost[]>([]);
  const [battle, setBattle] = useState<BattleEntry[]>([]);
  const [me, setMe] = useState('local');
  const [isOwner, setIsOwner] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<SampleFn | null>(null);
  const dbRef = useRef<DB | null>(null);
  const userRef = useRef<UserCap | null>(null);

  useEffect(() => {
    if (!runtime()) return;
    let unsubs: Unsub[] = [];
    let alive = true;
    useCap<SampleFn>('sample').then((s) => alive && s && setAi(() => s));
    useCap<UserCap>('user').then(async (u) => {
      if (!alive || !u) return;
      userRef.current = u;
      setIsOwner(u.isOwner());
      setMe(await u.id().catch(() => 'anon'));
    });
    const timer = setTimeout(() => alive && setStatus((s) => (s === 'connecting' ? 'error' : s)), 10_000);
    useCap<DB>('db').then((db) => {
      if (!alive) return;
      if (!db) {
        clearTimeout(timer);
        setStatus('error');
        return;
      }
      dbRef.current = db;
      const onErr = () => setStatus('error');
      const live = (s: QuerySnap) => {
        if (!s.metadata?.fromCache) {
          clearTimeout(timer);
          setStatus('live');
        }
      };
      const rows = <T,>(s: QuerySnap) => s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
      unsubs = [
        db.collection('lore').orderBy('createdAt', 'desc').limit(500).onSnapshot((s) => { live(s); setLore(rows<LoreStory>(s)); }, onErr),
        db.collection('wall').orderBy('createdAt', 'desc').limit(200).onSnapshot((s) => { live(s); setWall(rows<WallPost>(s)); }, onErr),
        db.collection('battle').orderBy('rating', 'desc').limit(300).onSnapshot((s) => { live(s); setBattle(rows<BattleEntry>(s)); }, onErr),
      ];
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, []);

  // resolve display names for whoever wrote lore / wall posts
  const authorKey = [...new Set([...lore.map((l) => l.by), ...wall.map((w) => w.by)])].sort().join(',');
  useEffect(() => {
    const u = userRef.current;
    if (!u || !authorKey) return;
    u.profiles(authorKey.split(',')).then((ps) => {
      const n: Record<string, string> = {};
      for (const [id, p] of Object.entries(ps)) n[id] = p?.name || 'Someone';
      setNames(n);
    }, () => {});
  }, [authorKey, me]);

  const need = () => {
    if (!dbRef.current) throw new Error('Shared storage is not connected yet. Give it a few seconds and try again.');
    return dbRef.current;
  };

  const addLore = useCallback(async (text: string) => {
    const story: Omit<LoreStory, 'id'> = { text: text.trim().slice(0, 1500), by: me, createdAt: Date.now() };
    if (!dbRef.current) {
      const next = [{ ...story, id: 'l' + Date.now() }, ...readLocalLore()];
      writeLocalLore(next);
      setLore(next);
      return;
    }
    await need().collection('lore').doc().set(story);
  }, [me]);

  const deleteLore = useCallback(async (id: string) => {
    if (!dbRef.current) {
      const next = readLocalLore().filter((l) => l.id !== id);
      writeLocalLore(next);
      setLore(next);
      return;
    }
    await need().doc('lore/' + id).delete();
  }, []);

  const postToWall = useCallback(async (p: Omit<WallPost, 'id' | 'by' | 'createdAt'>) => {
    const doc: Record<string, unknown> = { title: p.title.slice(0, 80), image: p.image, by: me, createdAt: Date.now() };
    if (p.meme) doc.meme = p.meme;
    await need().collection('wall').doc().set(doc);
  }, [me]);

  const deleteWall = useCallback(async (id: string) => {
    await need().doc('wall/' + id).delete();
  }, []);

  const putBattle = useCallback(async (e: BattleEntry) => {
    const { id, ...rest } = e;
    const doc: Record<string, unknown> = { ...rest };
    if (!e.meme) delete doc.meme;
    await need().doc('battle/' + id).set(doc);
  }, []);

  const resetBattle = useCallback(async () => {
    const db = need();
    for (const b of battle) await db.doc('battle/' + b.id).delete();
  }, [battle]);

  const value = useMemo<Cloud>(
    () => ({ status, lore, wall, battle, me, isOwner, names, ai, addLore, deleteLore, postToWall, deleteWall, putBattle, resetBattle }),
    [status, lore, wall, battle, me, isOwner, names, ai, addLore, deleteLore, postToWall, deleteWall, putBattle, resetBattle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- AI roasting ---------------- */

const SPICE_RULES: Record<Spice, string> = {
  spicy: 'Tone: cheeky and sharp, PG-13. Mild swearing is fine.',
  savage: 'Tone: a brutal comedy roast. Mean, cutting, no hedging, no "just kidding". Swearing is fine.',
  nuclear:
    'Tone: maximum-damage roast-battle mode, like a Comedy Central roast. Merciless, crude, R-rated language welcome. Go straight for the jugular on his decisions, habits, ego, love life, job, intelligence and the specific stories.',
};

const GUARDRAILS =
  'Hard limits (never cross, at any spice level): no jokes about race, ethnicity, religion, sexual orientation, gender identity, disability or real medical conditions; no threats, violence, or self-harm jokes; nothing sexual or explicit about him; no real last names, addresses, schools or employers beyond what is in the stories; never invent crimes. Roast what he DOES and the stories, not who he is born as.';

export function roastPrompt(opts: { stories: string[]; category: string; spice: Spice; count: number }) {
  const lore = opts.stories.length
    ? opts.stories.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '(no stories yet — invent plausible generic Travis behavior)';
  return `You write captions for a private meme app a group of friends uses to roast their friend Travis. Travis is in on it; this is a consensual friend-group roast.

${SPICE_RULES[opts.spice]}
${GUARDRAILS}

TRAVIS LORE (true stories his friends submitted — reference the specifics: names of places, objects, what he said):
${lore}

Write ${opts.count} different meme captions in the category "${opts.category}". Each must be punchy (under 25 words), specific to the lore where possible, and sound like a meme caption, not an essay. Vary the formats: one-liners, "Travis when...", fake quotes, headlines, comparisons.

Reply with only a JSON array of strings.`;
}

export function aiMemePrompt(opts: { stories: string[]; spice: Spice; templates: { id: string; name: string; boxes: string[] }[]; count: number }) {
  const lore = opts.stories.length ? opts.stories.map((s, i) => `${i + 1}. ${s}`).join('\n') : '(no stories yet)';
  const tpl = opts.templates.map((t) => `- ${t.id} (${t.name}): ${t.boxes.length} text boxes → ${t.boxes.map((b, i) => `[${i}] ${b}`).join(' | ')}`).join('\n');
  return `You design memes for a private app a group of friends uses to roast their friend Travis (he is in on it).

${SPICE_RULES[opts.spice]}
${GUARDRAILS}

TRAVIS LORE:
${lore}

TEMPLATES (fill EVERY text box of the template you pick, in order, keeping each box short — under 12 words; the box descriptions show what the format expects):
${tpl}

Create ${opts.count} memes, each built on a different story where possible, using the template whose format fits the joke best. Use each template at most once.

Reply with only a JSON array like:
[{"templateId": "drake", "captions": ["...", "..."], "title": "short funny title"}]`;
}

export function aiErrorCopy(code?: string): string {
  switch (code) {
    case 'not_granted':
      return 'You declined letting this page use Claude. Reload the page to be asked again.';
    case 'rate_limited':
      return 'Too many roasts too fast. Wait a minute and try again.';
    case 'refused':
      return 'Claude refused that one. Drop the spice a level or tweak the stories.';
    case 'invalid_json':
    case 'empty_completion':
      return 'Claude fumbled the format. Hit generate again.';
    case 'cancelled':
      return 'Stopped.';
    case 'sampling_disabled':
    case 'capability_disabled':
      return 'AI is turned off for this page or account.';
    default:
      return 'Claude could not be reached. Try again in a moment.';
  }
}
