import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry, Meme } from '../types';
import { useStore } from '../store';
import { slimMeme, useCloud } from '../cloud';
import { MemePreview } from '../components/MemePreview';
import { Empty, PageHead, Spinner } from '../components/ui';
import { ask } from '../components/ask';
import { randomMeme, thumbnail } from '../lib/memes';
import { pick } from '../lib/random';

interface Contestant {
  entryId: string;
  memeId: string | null;
  title: string;
  meme?: Meme;
  /** image-only contestants (wall posts too big to carry their meme JSON) */
  image?: string;
}

const K = 32;
const expected = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

const TRASH_TALK = [
  'Two memes enter. One leaves. Travis loses either way.',
  'Vote with your heart. Or your spleen.',
  'Democracy, but stupider.',
  'Pick the one Travis would hate more.',
  'Somewhere, Travis just felt a disturbance.',
];

export function Battle() {
  const store = useStore();
  const cloud = useCloud();
  const shared = cloud.status === 'live';
  const board: LeaderboardEntry[] = shared ? cloud.battle : store.leaderboard;
  const [pair, setPair] = useState<[Contestant, Contestant] | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [talk, setTalk] = useState(TRASH_TALK[0]);

  const contestant = useCallback(
    (exclude: string | null): Contestant => {
      for (let i = 0; i < 8; i++) {
        const r = Math.random();
        if (cloud.wall.length && r < 0.4) {
          const w = pick(cloud.wall);
          if ('wall:' + w.id !== exclude) return { entryId: 'wall:' + w.id, memeId: null, title: w.title, meme: w.meme, image: w.meme ? undefined : w.image };
        } else if (store.memes.length && r < 0.65) {
          const m = pick(store.memes);
          if ('saved:' + m.id !== exclude) return { entryId: 'saved:' + m.id, memeId: m.id, title: m.title, meme: m };
        } else if (r < 0.8) {
          const gens = board.filter((e) => e.id.startsWith('gen:') && e.meme);
          if (gens.length) {
            const e = pick(gens);
            if (e.id !== exclude) return { entryId: e.id, memeId: null, title: e.title, meme: e.meme };
          }
        }
      }
      const m = randomMeme(store.photos, store.customTemplates);
      return { entryId: 'gen:' + m.id, memeId: null, title: m.title, meme: m };
    },
    [cloud.wall, store.memes, store.photos, store.customTemplates, board],
  );

  const next = useCallback(() => {
    const a = contestant(null);
    const b = contestant(a.entryId);
    setPair([a, b]);
    setTalk(pick(TRASH_TALK));
  }, [contestant]);

  useEffect(() => {
    if (store.ready && !pair) next();
  }, [store.ready, pair, next]);

  const vote = async (winner: 0 | 1) => {
    if (!pair) return;
    setVoting(winner);
    try {
      const [w, l] = winner === 0 ? pair : [pair[1], pair[0]];
      const find = (c: Contestant) => board.find((e) => e.id === c.entryId);
      const ew = find(w);
      const el = find(l);
      const rw = ew?.rating ?? 1000;
      const rl = el?.rating ?? 1000;
      const delta = K * (1 - expected(rw, rl));
      const mk = async (c: Contestant, prev: LeaderboardEntry | undefined, rating: number, won: boolean): Promise<LeaderboardEntry> => ({
        id: c.entryId,
        memeId: c.memeId,
        // shared docs cap at 256 KB, so only small memes travel with their entry
        meme: c.meme ? (shared ? slimMeme(c.meme) : c.meme) : undefined,
        title: c.title,
        thumbnail: prev?.thumbnail ?? c.image ?? (c.meme ? await thumbnail(c.meme, 320) : ''),
        rating: Math.round(rating),
        wins: (prev?.wins ?? 0) + (won ? 1 : 0),
        losses: (prev?.losses ?? 0) + (won ? 0 : 1),
        updatedAt: Date.now(),
      });
      const a = await mk(w, ew, rw + delta, true);
      const b = await mk(l, el, rl - delta, false);
      if (shared) {
        await cloud.putBattle(a);
        await cloud.putBattle(b);
      } else {
        await store.upsertLeaderboard(a);
        await store.upsertLeaderboard(b);
      }
      store.toast(pick(['Justice served.', 'The people have spoken.', 'Brutal. Correct, but brutal.', 'Travis felt that one.']));
      next();
    } catch (e) {
      store.toast("Vote didn't stick: " + (e as Error).message, 'err');
    } finally {
      setVoting(null);
    }
  };

  const ranked = [...board].sort((a, b) => b.rating - a.rating || b.wins - a.wins);

  return (
    <div className="page">
      <PageHead
        kicker={shared ? 'Meme Battle · shared with the group' : 'Meme Battle Arena'}
        title={<>⚔️ Which is <span className="grad">funnier?</span></>}
        sub={talk}
      />
      {!pair ? (
        <Spinner label="Summoning gladiators…" />
      ) : (
        <div className="battle">
          {pair.map((c, i) => [
            i === 1 && <div key="vs" className="battle__vs">VS</div>,
            <button key={c.entryId + i} className={`battle__card ${voting === i ? 'is-winner' : ''}`} onClick={() => vote(i as 0 | 1)} disabled={voting !== null}>
              {c.meme ? <MemePreview meme={c.meme} maxWidth={700} /> : <img className="battle__img" src={c.image} alt={c.title} />}
              <span className="battle__label">
                {c.entryId.startsWith('wall:') ? '🧱 ' : c.memeId ? '💾 ' : '🎲 '}
                {c.title}
              </span>
              <span className="battle__vote">👑 This one</span>
            </button>,
          ])}
        </div>
      )}
      <div className="row center">
        <button className="btn" onClick={next} disabled={voting !== null}>
          🤷 Both mid, skip
        </button>
      </div>

      <section className="card leaderboard">
        <div className="card__head">
          <h2>🏆 {shared ? 'Group leaderboard' : 'Leaderboard'}</h2>
          {ranked.length > 0 && (!shared || cloud.isOwner) && (
            <button
              className="chip chip--danger"
              onClick={async () => {
                if (!(await ask.confirm('Wipe the leaderboard for everyone?', { ok: 'Wipe it', danger: true }))) return;
                try {
                  if (shared) await cloud.resetBattle();
                  else await store.resetLeaderboard();
                } catch (e) {
                  store.toast((e as Error).message, 'err');
                }
              }}
            >
              Reset
            </button>
          )}
        </div>
        {ranked.length === 0 ? (
          <Empty emoji="🥇" title="No champions yet">
            <p className="muted">Vote above to crown the funniest Travis meme.</p>
          </Empty>
        ) : (
          <ol className="lb">
            {ranked.slice(0, 15).map((e, i) => (
              <li key={e.id} className="lb__row">
                <span className="lb__rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                {e.thumbnail ? <img src={e.thumbnail} alt="" className="lb__thumb" /> : <span className="lb__thumb" />}
                <span className="lb__title">
                  {e.title}
                  <small className="muted">
                    {e.wins}W · {e.losses}L · {e.id.startsWith('wall:') ? 'wall' : e.memeId ? 'saved' : 'arena-born'}
                  </small>
                </span>
                <span className="lb__rating">{e.rating}</span>
                {e.meme && (
                  <button className="icon-btn" title="Open in editor" onClick={() => store.openInEditor(e.meme!)}>
                    ✏️
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
