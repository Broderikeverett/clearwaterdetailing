import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { breakingNews, randomTicker } from '../lib/roasts';
import { newsMeme } from '../lib/memes';
import { pick } from '../lib/random';
import { MemePreview } from '../components/MemePreview';
import { PageHead } from '../components/ui';
import type { TextLayer } from '../types';

export function News() {
  const store = useStore();
  const [headlines, setHeadlines] = useState(() => breakingNews(6));
  const [custom, setCustom] = useState('');
  const [current, setCurrent] = useState(headlines[0]);
  const [seed, setSeed] = useState(0);

  const meme = useMemo(() => {
    const m = newsMeme(current, store.photos.length ? pick(store.photos) : undefined);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, seed, store.photos.length]);

  return (
    <div className="page">
      <PageHead kicker="TMF News Network" title={<>🚨 Breaking <span className="grad">Travis</span> News</>} sub="Fair and balanced coverage of a man who is neither." />
      <div className="grid-2">
        <div className="card">
          <div className="news-frame">
            <MemePreview meme={meme} maxWidth={900} />
          </div>
          <div className="row wrap">
            <button className="btn btn--primary" onClick={() => store.openInEditor(meme)}>✏️ Edit in studio</button>
            <button className="btn" onClick={() => setSeed((s) => s + 1)}>🔁 New photo / ticker</button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await store.saveMeme(meme);
                  store.toast('Filed to the archive.');
                } catch {
                  /* toasted */
                }
              }}
            >
              💾 Save
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card__head">
            <h2>Today's headlines</h2>
            <button className="btn btn--sm btn--primary" onClick={() => { const h = breakingNews(6); setHeadlines(h); setCurrent(h[0]); }}>
              🎲 New batch
            </button>
          </div>
          <ul className="headline-list">
            {headlines.map((h) => (
              <li key={h}>
                <button className={`headline ${h === current ? 'on' : ''}`} onClick={() => setCurrent(h)}>
                  {h}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) setCurrent(custom.trim().toUpperCase());
            }}
          >
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Write your own headline…" maxLength={120} />
            <button className="btn btn--sm">Go live</button>
          </form>
          <p className="muted small">Ticker: {(meme.layers.find((l) => l.type === 'text' && l.font === 'Oswald' && l.fontSize < 40) as TextLayer | undefined)?.text ?? randomTicker()}</p>
        </div>
      </div>
    </div>
  );
}
