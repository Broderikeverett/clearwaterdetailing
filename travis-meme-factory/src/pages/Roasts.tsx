import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { ROAST_CATEGORIES, generateRoasts, LOADING_LINES } from '../lib/roasts';
import { getTemplate, TEMPLATES } from '../lib/templates';
import { memeFromPhoto, memeFromTemplate, textLayer } from '../lib/memes';
import { pick } from '../lib/random';
import { PageHead, Spinner } from '../components/ui';
import type { Meme } from '../types';

export function Roasts() {
  const store = useStore();
  const [cat, setCat] = useState(ROAST_CATEGORIES[0].id);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [line, setLine] = useState('');

  const generate = (id = cat) => {
    setThinking(true);
    setLine(pick(LOADING_LINES));
    setTimeout(() => {
      setIdeas(generateRoasts(id, 8));
      setThinking(false);
    }, 500);
  };

  useEffect(() => generate(cat), [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const toMeme = (caption: string) => {
    let m: Meme;
    if (store.photos.length) {
      m = memeFromPhoto(pick(store.photos), false);
      m.layers = [textLayer({ x: m.width / 2, y: m.height * 0.86, w: m.width * 0.92, text: caption, fontSize: caption.length > 60 ? 52 : 70 })];
    } else if (cat === 'news') {
      m = memeFromTemplate(getTemplate('breaking-news')!, [caption, 'Developing story • More at 11']);
    } else {
      const t = pick(TEMPLATES.filter((x) => ['classic', 'galaxy-brain', 'one-does-not'].includes(x.id)));
      m = memeFromTemplate(t, t.id === 'classic' ? ['Travis:', caption] : t.id === 'one-does-not' ? ['Fun fact', caption] : ['Travis energy:', caption]);
    }
    m.title = caption.slice(0, 50);
    store.openInEditor(m);
  };

  const active = ROAST_CATEGORIES.find((c) => c.id === cat)!;

  return (
    <div className="page">
      <PageHead
        kicker="Travis AI Roast Generator™"
        title={<>Artificial <span className="grad">Disrespect</span></>}
        sub="Runs 100% offline on a proprietary blend of jokes and bad intentions. All roasts are fictional and friendly-fire only."
      />
      <div className="cat-grid">
        {ROAST_CATEGORIES.map((c) => (
          <button key={c.id} className={`cat ${c.id === cat ? 'cat--on' : ''}`} onClick={() => setCat(c.id)}>
            <span className="cat__emoji">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="card__head">
          <h2>
            {active.emoji} {active.label}
          </h2>
          <button className="btn btn--primary" onClick={() => generate()} disabled={thinking}>
            {thinking ? 'Cooking…' : '🎲 Generate more'}
          </button>
        </div>
        {thinking ? (
          <Spinner label={line} />
        ) : (
          <ul className="roast-list">
            {ideas.map((r) => (
              <li key={r} className="roast">
                <p>{r}</p>
                <div className="row">
                  <button
                    className="chip"
                    onClick={() => {
                      navigator.clipboard?.writeText(r).then(
                        () => store.toast('Copied. Deploy responsibly.'),
                        () => store.toast('Clipboard blocked — long-press to copy.', 'err'),
                      );
                    }}
                  >
                    📋 Copy
                  </button>
                  <button className="chip chip--on" onClick={() => toMeme(r)}>
                    🎨 Make meme
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
