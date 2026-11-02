import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { TEMPLATES } from '../lib/templates';
import { memeFromPhoto, memeFromTemplate, readImageFile } from '../lib/memes';
import { MemePreview } from '../components/MemePreview';
import { ask } from '../components/ask';
import { PageHead, Spinner } from '../components/ui';

export function Templates() {
  const store = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  // previews with captions
  const previews = useMemo(() => TEMPLATES.map((t) => ({ t, meme: memeFromTemplate(t) })), []);
  const filtered = previews.filter(({ t }) => (t.name + t.blurb).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <PageHead
        kicker="Template Library"
        title={<>Classic formats, <span className="grad">Travis-ified</span></>}
        sub="Built-in remixes of the classics (drawn on the fly, no stolen JPEGs). Want the originals? Upload them as custom templates below."
      />
      <div className="row wrap toolbar">
        <input className="search" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--primary" onClick={() => input.current?.click()} disabled={busy}>
          ⬆ Upload custom template
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              const img = await readImageFile(f);
              const name = (await ask.prompt('Name this template', f.name.replace(/\.[^.]+$/, ''))) || 'Custom template';
              await store.addCustomTemplate({ ...img, name });
              store.toast(`"${name}" added to your templates.`);
            } catch (err) {
              store.toast((err as Error).message, 'err');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {busy && <Spinner label="Processing template…" />}

      {store.customTemplates.length > 0 && (
        <>
          <h2 className="section-title">Your templates</h2>
          <div className="tpl-grid">
            {store.customTemplates.map((t) => (
              <div key={t.id} className="tpl-card">
                <button className="tpl-card__img" onClick={() => store.openInEditor({ ...memeFromPhoto(t), title: `${t.name} (Travis edition)` })}>
                  <img src={t.src} alt={t.name} />
                </button>
                <div className="tpl-card__meta">
                  <strong>{t.name}</strong>
                  <div className="row">
                    <button className="btn btn--sm btn--primary" onClick={() => store.openInEditor({ ...memeFromPhoto(t), title: `${t.name} (Travis edition)` })}>Use</button>
                    <button className="btn btn--sm" onClick={async () => (await ask.confirm(`Delete "${t.name}"?`, { ok: 'Delete', danger: true })) && store.deleteCustomTemplate(t.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <h2 className="section-title">Built-in</h2>
        </>
      )}

      <div className="tpl-grid">
        {filtered.map(({ t, meme }) => (
          <div key={t.id} className="tpl-card">
            <button className="tpl-card__img" onClick={() => store.openInEditor(memeFromTemplate(t))} aria-label={`Use ${t.name}`}>
              <MemePreview meme={meme} maxWidth={420} />
            </button>
            <div className="tpl-card__meta">
              <div>
                <strong>{t.emoji} {t.name}</strong>
                <p className="muted small">{t.blurb}</p>
              </div>
              <div className="row">
                <button className="btn btn--sm btn--primary" onClick={() => store.openInEditor(memeFromTemplate(t))}>Use</button>
                {t.captionSets[0]?.length > 0 && (
                  <button
                    className="btn btn--sm"
                    title="Random captions"
                    onClick={() => {
                      const i = Math.floor(Math.random() * 100);
                      store.openInEditor(memeFromTemplate(t, t.captionSets.map((s) => s[i % s.length])));
                    }}
                  >
                    🎲
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="muted">No templates match “{q}”. Much like Travis's excuses.</p>}
    </div>
  );
}
