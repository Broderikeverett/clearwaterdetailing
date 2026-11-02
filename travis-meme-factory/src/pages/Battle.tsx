import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry, Meme } from '../types';
import { useStore } from '../store';
import { MemePreview } from '../components/MemePreview';
import { Empty, PageHead, Spinner } from '../components/ui';
import { randomMeme, thumbnail } from '../lib/memes';
import { pick } from '../lib/random';

interface Contestant {
  entryId: string;
  memeId: string | null;
  meme: Meme;
}

const K = 32;
const expected = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

const TRASH_TALK = [
  'Choose wisely. Travis is watching. (He is not.)',
  'Two memes enter. One meme leaves.',
  'This is the most important decision of your life.',
  'Vote with your heart. Or your spleen.',
  'Democracy, but stupider.',
];

export function Battle() {
  const store = useStore();
  const { memes, leaderboard, photos, customTemplates } = store;
  const [pair, setPair] = useState<[Contestant, Contestant] | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [talk, setTalk] = useState(TRASH_TALK[0]);

  const contestant = useCallback(
    (exclude: string | null): Contestant => {
      for (let i = 0; i < 6; i++) {
        const r = Math.random();
        if (memes.length && r < 0.55) {
          const m = pick(memes);
          if ('saved:' + m.id !== exclude) return { entryId: 'saved:' + m.id, memeId: m.id, meme: m };
        } else if (r < 0.75) {
          const gens = leaderboard.filter((e) => !e.memeId);
          if (gens.length) {
            const e = pick(gens);
            if (e.id !== exclude) return { entryId: e.id, memeId: null, meme: e.meme };
          }
        }
      }
      const m = randomMeme(photos, customTemplates);
      return { entryId: 'gen:' + m.id, memeId: null, meme: m };
    },
    [memes, leaderboard, photos, customTemplates],
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
      const find = (c: Contestant) => leaderboard.find((e) => e.id === c.entryId);
      const ew = find(w);
      const el = find(l);
      const rw = ew?.rating ?? 1000;
      const rl = el?.rating ?? 1000;
      const exp = expected(rw, rl);
      const now = Date.now();
      const mk = async (c: Contestant, prev: LeaderboardEntry | undefined, rating: number, won: boolean): Promise<LeaderboardEntry> => ({
        id: c.entryId,
        memeId: c.memeId,
        meme: c.meme,
        title: c.meme.title,
        thumbnail: prev?.thumbnail ?? c.meme.thumbnail ?? (await thumbnail(c.meme, 320)),
        rating: Math.round(rating),
        wins: (prev?.wins ?? 0) + (won ? 1 : 0),
        losses: (prev?.losses ?? 0) + (won ? 0 : 1),
        updatedAt: now,
      });
      await store.upsertLeaderboard(await mk(w, ew, rw + K * (1 - exp), true));
      await store.upsertLeaderboard(await mk(l, el, rl - K * (1 - exp), false));
      store.toast(pick(['Justice served.', 'The people have spoken.', 'Brutal. Correct, but brutal.', 'Travis felt that one.']));
      next();
    } catch {
      /* toasted by store */
    } finally {
      setVoting(null);
    }
  };

  const ranked = [...leaderboard].sort((a, b) => b.rating - a.rating || b.wins - a.wins);

  return (
    <div className="page">
      <PageHead kicker="Meme Battle Arena" title={<>⚔️ Which is <span className="grad">funnier?</span></>} sub={talk} />
      {!pair ? (
        <Spinner label="Summoning gladiators…" />
      ) : (
        <div className="battle">
          {pair.map((c, i) => [
            i === 1 && <div key="vs" className="battle__vs">VS</div>,
            <button key={c.entryId + i} className={`battle__card ${voting === i ? 'is-winner' : ''}`} onClick={() => vote(i as 0 | 1)} disabled={voting !== null}>
              <MemePreview meme={c.meme} maxWidth={700} />
              <span className="battle__label">
                {c.memeId ? '💾 ' : '🎲 '}
                {c.meme.title}
              </span>
              <span className="battle__vote">👑 This one</span>
            </button>,
          ])}
        </div>
      )}
      <div className="row center">
        <button className="btn" onClick={next} disabled={voting !== null}>
          🤷 Both mid — skip
        </button>
      </div>

      <section className="card leaderboard">
        <div className="card__head">
          <h2>🏆 Leaderboard</h2>
          {ranked.length > 0 && (
            <button className="chip chip--danger" onClick={() => confirm('Wipe the leaderboard? History will forget.') && store.resetLeaderboard()}>
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
                <img src={e.thumbnail} alt="" className="lb__thumb" />
                <span className="lb__title">
                  {e.title}
                  <small className="muted">
                    {e.wins}W · {e.losses}L {e.memeId ? '· saved' : '· arena-born'}
                  </small>
                </span>
                <span className="lb__rating">{e.rating}</span>
                <button className="icon-btn" title="Open in editor" onClick={() => store.openInEditor(e.meme)}>
                  ✏️
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
