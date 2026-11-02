import { useMemo, useRef, useState } from 'react';
import type { Meme } from '../types';
import { useStore } from '../store';
import { MemePreview } from '../components/MemePreview';
import { Modal, Spinner } from '../components/ui';
import { downloadBlob, exportPNG, fileNameFor, randomMeme, readImageFile } from '../lib/memes';
import { LOADING_LINES, breakingNews, motdTitle } from '../lib/roasts';
import { pick, seeded, todayKey } from '../lib/random';

export function Home({ go }: { go: (r: string) => void }) {
  const store = useStore();
  const { memes, photos, customTemplates, toast } = store;
  const [chaos, setChaos] = useState<Meme | null>(null);
  const [rolling, setRolling] = useState(false);
  const [loadingLine, setLoadingLine] = useState('');
  const [reroll, setReroll] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);

  // Meme of the Day: deterministic per date (so it's the same all day), rerollable.
  const motd = useMemo(() => {
    const rng = seeded(todayKey() + ':' + reroll);
    const pool = memes.length ? memes : null;
    const meme = pool ? pool[Math.floor(rng() * pool.length)] : null;
    return { meme, title: motdTitle(rng) };
  }, [memes, reroll]);

  const headlines = useMemo(() => breakingNews(8), []);

  const makeStupid = () => {
    setRolling(true);
    setLoadingLine(pick(LOADING_LINES));
    // tiny dramatic pause, it's a meme factory not a bank
    setTimeout(() => {
      try {
        setChaos(randomMeme(photos, customTemplates));
      } catch (e) {
        toast('The chaos engine jammed: ' + (e as Error).message, 'err');
      } finally {
        setRolling(false);
      }
    }, 650);
  };

  return (
    <div className="page home">
      <div className="ticker" aria-hidden>
        <div className="ticker__inner">
          {[...headlines, ...headlines].map((h, i) => (
            <span key={i}>🚨 {h}</span>
          ))}
        </div>
      </div>

      <section className="hero">
        <span className="kicker">Est. today · 0 regrets</span>
        <h1 className="hero__title">
          TRAVIS <span className="grad">MEME</span> FACTORY
        </h1>
        <p className="hero__sub">The world's most advanced facility for making your friend Travis look ridiculous. Fully legal. Mostly.</p>

        <button className={`big-red ${rolling ? 'is-rolling' : ''}`} onClick={makeStupid} disabled={rolling}>
          {rolling ? (
            <>
              <span className="spinner spinner--inline" /> {loadingLine}
            </>
          ) : (
            <>MAKE TRAVIS LOOK STUPID</>
          )}
        </button>
        <p className="muted small">
          {photos.length
            ? `Using ${photos.length} Travis photo${photos.length > 1 ? 's' : ''} from the Photo Bank.`
            : 'Tip: add photos of Travis to the Photo Bank and the button will put his face in the memes.'}
        </p>
      </section>

      <section className="grid-2">
        <div className="card motd">
          <div className="card__head">
            <span className="kicker">🏆 Meme of the Day</span>
            {memes.length > 1 && (
              <button className="chip" onClick={() => setReroll((r) => r + 1)}>🎲 Reroll</button>
            )}
          </div>
          {motd.meme ? (
            <>
              <h2 className="motd__title">“{motd.title}”</h2>
              <div className="motd__frame">
                <MemePreview meme={motd.meme} maxWidth={700} />
              </div>
              <div className="row wrap">
                <button className="btn btn--sm" onClick={() => store.openInEditor(motd.meme!)}>✏️ Edit</button>
                <button className="btn btn--sm" onClick={() => go('battle')}>⚔️ Send to battle</button>
              </div>
            </>
          ) : (
            <div className="motd__empty">
              <div className="empty__emoji">🏛️</div>
              <h3>The museum is empty.</h3>
              <p className="muted">Save a meme and it might be crowned Meme of the Day.</p>
              <button className="btn btn--primary" onClick={() => go('create')}>Make the first one</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card__head">
            <span className="kicker">🧑 Travis Photo Bank</span>
            <span className="muted small">{photos.length} on file</span>
          </div>
          <p className="muted small">Upload pics of Travis once. The random button, templates, and news generator will use them.</p>
          <div className="photo-grid photo-grid--sm">
            {photos.slice(0, 11).map((p) => (
              <div key={p.id} className="photo-tile">
                <img src={p.src} alt="Travis" />
                <button className="photo-tile__x" aria-label="Delete photo" onClick={() => confirm('Remove this Travis from the bank?') && store.deletePhoto(p.id)}>
                  ✕
                </button>
              </div>
            ))}
            <button className="photo-tile photo-tile--add" onClick={() => photoInput.current?.click()}>
              ＋<span>Add Travis</span>
            </button>
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              let ok = 0;
              for (const f of files) {
                try {
                  await store.addPhoto(await readImageFile(f, 1200));
                  ok++;
                } catch (err) {
                  toast((err as Error).message, 'err');
                }
              }
              if (ok) toast(`${ok} Travis photo${ok > 1 ? 's' : ''} added. He has no idea.`);
            }}
          />
          <div className="quick-links">
            <button className="quick" onClick={() => go('create')}>🎨<span>Meme Studio</span></button>
            <button className="quick" onClick={() => go('roasts')}>🤖<span>Roast AI</span></button>
            <button className="quick" onClick={() => go('news')}>📺<span>Breaking News</span></button>
            <button className="quick" onClick={() => go('battle')}>⚔️<span>Meme Battle</span></button>
          </div>
        </div>
      </section>

      <ChaosModal meme={chaos} onClose={() => setChaos(null)} onAgain={makeStupid} rolling={rolling} />
    </div>
  );
}

export function ChaosModal({ meme, onClose, onAgain, rolling }: { meme: Meme | null; onClose: () => void; onAgain: () => void; rolling: boolean }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  if (!meme) return null;
  return (
    <Modal open={!!meme} onClose={onClose} title="🤡 Fresh Travis Content" wide>
      <div className="chaos">
        {rolling ? <Spinner label="Making it worse…" /> : <MemePreview meme={meme} maxWidth={800} />}
        <div className="row wrap center">
          <button className="btn btn--primary" onClick={onAgain} disabled={rolling}>🎲 Again!</button>
          <button className="btn" onClick={() => { store.openInEditor(meme); onClose(); }}>✏️ Edit</button>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await store.saveMeme(meme);
                store.toast('Saved to your vault.');
              } catch {
                /* toasted */
              } finally {
                setBusy(false);
              }
            }}
          >
            💾 Save
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                downloadBlob(await exportPNG(meme), fileNameFor(meme));
              } catch (e) {
                store.toast((e as Error).message, 'err');
              } finally {
                setBusy(false);
              }
            }}
          >
            ⬇ PNG
          </button>
        </div>
      </div>
    </Modal>
  );
}
