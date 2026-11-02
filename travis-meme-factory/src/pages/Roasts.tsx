import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { aiErrorCopy, aiMemePrompt, roastPrompt, slimMeme, useCloud, type Spice } from '../cloud';
import { ROAST_CATEGORIES, generateRoasts } from '../lib/roasts';
import { BOX_HINTS, getTemplate, TEMPLATES } from '../lib/templates';
import { addFaces, memeFromPhoto, memeFromTemplate, textLayer, wallImage } from '../lib/memes';
import { pick } from '../lib/random';
import { MemePreview } from '../components/MemePreview';
import { PageHead, Spinner } from '../components/ui';
import type { Meme } from '../types';

const SPICES: { id: Spice; label: string; hint: string }[] = [
  { id: 'spicy', label: '🌶 Spicy', hint: 'Sharp, PG-13' },
  { id: 'savage', label: '🔥 Savage', hint: 'Mean, swearing allowed' },
  { id: 'nuclear', label: '☢️ Nuclear', hint: 'Full roast battle, R-rated' },
];

export function Roasts({ go }: { go: (r: string) => void }) {
  const store = useStore();
  const cloud = useCloud();
  const [cat, setCat] = useState(ROAST_CATEGORIES[0].id);
  const [spice, setSpice] = useState<Spice>('savage');
  const [storyId, setStoryId] = useState<string>('all');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [source, setSource] = useState<'offline' | 'ai'>('offline');
  const [aiMemes, setAiMemes] = useState<Meme[]>([]);
  const [busy, setBusy] = useState<null | 'roasts' | 'memes'>(null);
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);

  const active = ROAST_CATEGORIES.find((c) => c.id === cat)!;
  const stories = (storyId === 'all' ? cloud.lore : cloud.lore.filter((l) => l.id === storyId)).slice(0, 60).map((l) => l.text);

  const offline = (id = cat) => {
    setIdeas(generateRoasts(id, 8));
    setSource('offline');
  };
  useEffect(() => {
    if (source === 'offline') offline(cat);
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAi = async (mode: 'roasts' | 'memes') => {
    if (!cloud.ai) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(mode);
    setErr('');
    try {
      if (mode === 'roasts') {
        const out = await cloud.ai.json<unknown>(roastPrompt({ stories, category: active.label, spice, count: 8 }), { signal: c.signal, cache: false });
        const list = Array.isArray(out) ? out.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
        if (!list.length) throw { code: 'invalid_json' };
        setIdeas(list);
        setSource('ai');
      } else {
        const templates = TEMPLATES.filter((t) => BOX_HINTS[t.id]).map((t) => ({ id: t.id, name: t.name, boxes: BOX_HINTS[t.id] }));
        const out = await cloud.ai.json<unknown>(aiMemePrompt({ stories, spice, templates, count: 4 }), { signal: c.signal, cache: false });
        const rows = Array.isArray(out) ? out : [];
        const memes: Meme[] = [];
        for (const r of rows as { templateId?: string; captions?: unknown; title?: string }[]) {
          const t = r && typeof r.templateId === 'string' ? getTemplate(r.templateId) : undefined;
          if (!t || !Array.isArray(r.captions)) continue;
          const captions = t.texts.map((tx, i) => (typeof (r.captions as unknown[])[i] === 'string' ? String((r.captions as unknown[])[i]) : tx.text));
          const m = memeFromTemplate(t, captions);
          if (store.photos.length) addFaces(m, t, store.photos);
          m.title = (r.title || 'Lore-based Travis meme').slice(0, 60);
          memes.push(m);
        }
        if (!memes.length) throw { code: 'invalid_json' };
        setAiMemes(memes);
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'cancelled') setErr(aiErrorCopy(code));
    } finally {
      if (ctl.current === c) {
        setBusy(null);
        ctl.current = null;
      }
    }
  };

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

  const post = async (m: Meme) => {
    try {
      await cloud.postToWall({ title: m.title, image: await wallImage(m), meme: slimMeme(m) });
      store.toast('Posted to the Wall. The group has been notified (spiritually).');
    } catch (e) {
      store.toast((e as Error).message, 'err');
    }
  };

  return (
    <div className="page">
      <PageHead
        kicker="Travis AI Roast Generator"
        title={<>Artificial <span className="grad">Disrespect</span></>}
        sub="Claude reads the Travis Lore and writes roasts built on what he actually did. No lore yet? You still get the offline joke bank."
      />

      <section className="card ai-card">
        <div className="card__head">
          <h2>🧠 Claude Roaster</h2>
          <span className="muted small">{cloud.lore.length} {cloud.lore.length === 1 ? 'story' : 'stories'} in the lore</span>
        </div>
        {!cloud.ai ? (
          <p className="muted small">
            AI roasts work in the published app on claude.ai. Here you get the offline joke bank below.
          </p>
        ) : (
          <>
            <div className="field">
              <span>Spice level</span>
              <div className="seg seg--spice">
                {SPICES.map((s) => (
                  <button key={s.id} className={spice === s.id ? 'on' : ''} onClick={() => setSpice(s.id)} title={s.hint}>
                    {s.label}
                  </button>
                ))}
              </div>
              <small className="muted">{SPICES.find((s) => s.id === spice)!.hint}. Stays off race, religion, sexuality, disability and threats.</small>
            </div>
            <label className="field" htmlFor="story-pick">
              <span>Roast material</span>
              <select id="story-pick" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
                <option value="all">All lore ({cloud.lore.length})</option>
                {cloud.lore.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.text.slice(0, 70)}
                    {l.text.length > 70 ? '…' : ''}
                  </option>
                ))}
              </select>
            </label>
            {cloud.lore.length === 0 && (
              <p className="small">
                <button className="linkish" onClick={() => go('lore')}>Add a story about Travis first →</button> Claude roasts much harder with real details.
              </p>
            )}
            <div className="row wrap">
              <button className="btn btn--primary" onClick={() => runAi('roasts')} disabled={!!busy}>
                🔥 Write {active.label.toLowerCase()} roasts
              </button>
              <button className="btn" onClick={() => runAi('memes')} disabled={!!busy}>
                🎨 Make 4 full memes
              </button>
              {busy && (
                <button className="btn btn--sm" onClick={() => ctl.current?.abort()}>
                  ■ Stop
                </button>
              )}
            </div>
            {busy && <Spinner label={busy === 'memes' ? 'Claude is picking templates and sharpening knives…' : 'Claude is reading the lore and taking notes…'} />}
            {err && <p className="error-text">{err}</p>}
          </>
        )}
      </section>

      {aiMemes.length > 0 && (
        <section className="card">
          <div className="card__head">
            <h2>🎨 Fresh from the lore</h2>
            <button className="chip" onClick={() => setAiMemes([])}>Clear</button>
          </div>
          <div className="ai-meme-grid">
            {aiMemes.map((m) => (
              <div key={m.id} className="ai-meme">
                <MemePreview meme={m} maxWidth={600} />
                <strong className="small">{m.title}</strong>
                <div className="row wrap">
                  <button className="btn btn--sm btn--primary" onClick={() => store.openInEditor(m)}>✏️ Edit</button>
                  <button className="btn btn--sm" onClick={() => store.saveMeme(m).then(() => store.toast('Saved.'), () => {})}>💾 Save</button>
                  {cloud.status === 'live' && <button className="btn btn--sm" onClick={() => post(m)}>🧱 Post</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
            {active.emoji} {active.label} {source === 'ai' && <span className="pill">Claude · {spice}</span>}
          </h2>
          <button className="btn btn--sm" onClick={() => offline()}>
            🎲 Offline jokes
          </button>
        </div>
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
                      () => store.toast('Clipboard blocked. Long-press the text to copy.', 'err'),
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
      </div>
    </div>
  );
}
