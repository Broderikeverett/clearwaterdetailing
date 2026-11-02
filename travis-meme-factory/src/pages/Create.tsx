import { useCallback, useEffect, useRef, useState } from 'react';
import type { AspectKey, ImageLayer, Layer, Meme, StickerLayer, TextLayer } from '../types';
import { useStore } from '../store';
import { EditorCanvas } from '../components/EditorCanvas';
import { Empty, Modal, PageHead, Spinner } from '../components/ui';
import { FONTS } from '../lib/render';
import { TEMPLATES } from '../lib/templates';
import {
  cloneMeme, wallImage, downloadBlob, exportPNG, fileNameFor, imageLayer, memeFromPhoto, memeFromTemplate, readImageFile,
  shareBlob, sizeForAspect, stickerLayer, textLayer,
} from '../lib/memes';
import { EMOJI_STICKERS, ROAST_CATEGORIES, generateRoasts } from '../lib/roasts';
import { uid } from '../lib/random';
import { ask } from '../components/ask';
import { inArtifact, slimMeme, useCloud } from '../cloud';

type Tab = 'text' | 'stickers' | 'photo' | 'layers' | 'save';

const SWATCHES = ['#ffffff', '#000000', '#ffde00', '#ff3b3b', '#3ab8ff', '#8b5cf6', '#22c55e', '#ff7ad9'];

export function Create() {
  const store = useStore();
  const cloud = useCloud();
  const { draft, toast } = store;
  const [meme, setMeme] = useState<Meme | null>(null);
  const [past, setPast] = useState<Meme[]>([]);
  const [future, setFuture] = useState<Meme[]>([]);
  const committed = useRef<Meme | null>(null);
  const lastCoalesce = useRef<{ key: string; t: number }>({ key: '', t: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('text');
  const [panMode, setPanMode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [roastCat, setRoastCat] = useState(ROAST_CATEGORIES[0].id);
  const [roastIdeas, setRoastIdeas] = useState<string[]>([]);
  const [facePicker, setFacePicker] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const faceInput = useRef<HTMLInputElement>(null);

  const load = useCallback((m: Meme) => {
    setMeme(m);
    committed.current = m;
    setPast([]);
    setFuture([]);
    setSelectedId(m.layers.find((l) => l.type === 'text')?.id ?? null);
  }, []);

  // pick up memes handed over from other pages
  useEffect(() => {
    if (draft) load(cloneMeme(draft));
  }, [draft, load]);

  /** Update the meme. `commit` pushes an undo step; `coalesceKey` merges rapid slider changes into one step. */
  const change = useCallback((next: Meme, commit = true, coalesceKey?: string) => {
    setMeme(next);
    if (!commit) return;
    const now = Date.now();
    const merge = coalesceKey && lastCoalesce.current.key === coalesceKey && now - lastCoalesce.current.t < 800;
    lastCoalesce.current = { key: coalesceKey ?? '', t: now };
    if (!merge && committed.current) {
      const prev = committed.current;
      setPast((p) => [...p.slice(-60), prev]);
      setFuture([]);
    }
    committed.current = next;
  }, []);

  const undo = useCallback(() => {
    if (!past.length || !meme) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((f) => [meme, ...f]);
    setMeme(prev);
    committed.current = prev;
  }, [past, meme]);

  const redo = useCallback(() => {
    if (!future.length || !meme) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setPast((p) => [...p, meme]);
    setMeme(next);
    committed.current = next;
  }, [future, meme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && meme) {
        change({ ...meme, layers: meme.layers.filter((l) => l.id !== selectedId) });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedId, meme, change]);

  const startFromFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Loading photo…');
    try {
      const img = await readImageFile(file);
      if (meme && meme.background.kind !== 'template' && meme.layers.length) {
        // replace background but keep the captions
        const { width, height } = sizeForAspect(meme.aspect, img.w, img.h);
        change({ ...meme, width, height, background: { kind: 'image', src: img.src, natW: img.w, natH: img.h, zoom: 1, panX: 0, panY: 0 } });
      } else load(memeFromPhoto(img));
      toast('Photo loaded. Make him regret it.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!meme) {
    return (
      <div className="page">
        <PageHead kicker="Meme Studio" title={<>Pick your <span className="grad">weapon</span></>} sub="Upload a photo of Travis, or start from a classic. Everything runs on your device." />
        <div className="start-grid">
          <label className="start-card start-card--hero">
            <input type="file" accept="image/*" hidden onChange={(e) => startFromFile(e.target.files?.[0])} />
            <span className="start-card__emoji">📸</span>
            <strong>Upload a photo</strong>
            <span className="muted">Any pic. Ideally an unflattering one.</span>
          </label>
          {TEMPLATES.slice(0, 5).map((t) => (
            <button key={t.id} className="start-card" onClick={() => load(memeFromTemplate(t))}>
              <span className="start-card__emoji">{t.emoji}</span>
              <strong>{t.name}</strong>
              <span className="muted">{t.blurb}</span>
            </button>
          ))}
          <button
            className="start-card"
            onClick={() => {
              const now = Date.now();
              load({ id: uid('m'), title: 'Blank Travis Canvas', width: 1000, height: 1000, aspect: '1:1', background: { kind: 'color', color: '#111122' }, layers: [textLayer({ x: 500, y: 500, text: 'Travis.' })], collectionId: null, createdAt: now, updatedAt: now });
            }}
          >
            <span className="start-card__emoji">⬛</span>
            <strong>Blank canvas</strong>
            <span className="muted">Pure chaos, no rules.</span>
          </button>
        </div>
        <button className="btn" onClick={() => (window.location.hash = '#templates')}>🧩 Browse all {TEMPLATES.length} templates</button>
        {busy && <Spinner label={busy} />}
      </div>
    );
  }

  const sel = meme.layers.find((l) => l.id === selectedId) ?? null;
  const updateLayer = (l: Layer, key?: string) => change({ ...meme, layers: meme.layers.map((x) => (x.id === l.id ? l : x)) }, true, key);
  const addLayer = (l: Layer) => {
    change({ ...meme, layers: [...meme.layers, l] });
    setSelectedId(l.id);
  };
  const removeLayer = (id: string) => {
    change({ ...meme, layers: meme.layers.filter((l) => l.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };
  const moveLayer = (id: string, dir: -1 | 1) => {
    const i = meme.layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j < 0 || j >= meme.layers.length) return;
    const layers = meme.layers.slice();
    [layers[i], layers[j]] = [layers[j], layers[i]];
    change({ ...meme, layers });
  };
  const duplicate = (l: Layer) => addLayer({ ...l, id: uid(l.type[0]), x: l.x + 30, y: l.y + 30 });

  const addText = (where: 'top' | 'bottom' | 'middle') => {
    const y = where === 'top' ? meme.height * 0.09 : where === 'bottom' ? meme.height * 0.91 : meme.height / 2;
    addLayer(textLayer({ x: meme.width / 2, y, w: meme.width * 0.9, text: where === 'top' ? 'Top text' : where === 'bottom' ? 'Bottom text' : 'Travis moment', fontSize: Math.round(meme.width * 0.075) }));
    setTab('text');
    setTimeout(() => textRef.current?.select(), 50);
  };

  const addFace = async (src: string, w: number, h: number) => {
    const size = Math.min(meme.width, meme.height) * 0.4;
    const ratio = h / w;
    addLayer({ ...imageLayer(src, meme.width / 2, meme.height / 2, size, size * ratio), border: undefined });
    setFacePicker(false);
    setTab('stickers');
  };

  const setAspect = (aspect: AspectKey) => {
    if (meme.background.kind !== 'image') return;
    const { width, height } = sizeForAspect(aspect, meme.background.natW, meme.background.natH);
    const sy = height / meme.height;
    change({ ...meme, aspect, width, height, background: { ...meme.background, panX: 0, panY: 0 }, layers: meme.layers.map((l) => ({ ...l, y: l.y * sy })) });
  };

  const doExport = async (mode: 'download' | 'share', width = 2000) => {
    setBusy('Rendering high-res PNG…');
    try {
      const blob = await exportPNG(meme, width);
      const name = fileNameFor(meme);
      if (mode === 'share') {
        const ok = await shareBlob(blob, name).catch((e: Error) => {
          if (e.name === 'AbortError') return true;
          throw e;
        });
        if (!ok) {
          await downloadBlob(blob, name);
          toast('Sharing not supported here, downloaded instead.', 'info');
        }
      } else {
        const r = await downloadBlob(blob, name);
        if (r === 'declined') toast('Download cancelled.', 'info');
        else toast(`${name} (${Math.round(blob.size / 1024)} KB) is ready. Travis has been notified. (He hasn't.)`);
      }
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const doSave = async () => {
    setBusy('Saving to the vault…');
    try {
      const saved = await store.saveMeme(meme);
      committed.current = { ...meme, thumbnail: saved.thumbnail };
      setMeme((m) => (m ? { ...m, thumbnail: saved.thumbnail, updatedAt: saved.updatedAt } : m));
      toast('Saved. This is evidence now.');
    } catch {
      /* toast already shown */
    } finally {
      setBusy(null);
    }
  };

  const isSaved = store.memes.some((m) => m.id === meme.id);

  return (
    <div className="page page--editor">
      <div className="editor">
        <div className="editor__stage">
          <div className="stage-toolbar">
            <button className="chip" onClick={undo} disabled={!past.length} aria-label="Undo">↶ Undo</button>
            <button className="chip" onClick={redo} disabled={!future.length} aria-label="Redo">↷ Redo</button>
            {meme.background.kind === 'image' && (
              <button className={`chip ${panMode ? 'chip--on' : ''}`} onClick={() => setPanMode((p) => !p)}>
                ✋ {panMode ? 'Moving photo' : 'Move photo'}
              </button>
            )}
            {sel && (
              <>
                <button className="chip" onClick={() => duplicate(sel)}>⧉ Copy</button>
                <button className="chip chip--danger" onClick={() => removeLayer(sel.id)}>🗑 Delete</button>
              </>
            )}
            <button className="chip" onClick={async () => { if (await ask.confirm('Start a new meme? Unsaved changes will be lost.', { ok: 'Start fresh', danger: true })) { setMeme(null); committed.current = null; } }}>
              ＋ New
            </button>
          </div>
          <div className="stage">
            <EditorCanvas
              meme={meme}
              selectedId={selectedId}
              panMode={panMode}
              onSelect={(id) => {
                setSelectedId(id);
                const l = meme.layers.find((x) => x.id === id);
                if (l?.type === 'text') setTab('text');
                else if (l) setTab('stickers');
              }}
              onChange={(m, commit) => change(m, commit)}
              onEditText={(id) => {
                setSelectedId(id);
                setTab('text');
                setTimeout(() => textRef.current?.focus(), 30);
              }}
            />
            {busy && (
              <div className="stage__busy">
                <Spinner label={busy} />
              </div>
            )}
          </div>
          <p className="hint">Tap to select · drag to move · ⤡ resize · ↻ rotate · ↔ wrap width · pinch on mobile · double-tap text to edit</p>
          <div className="export-row">
            <button className="btn btn--primary" onClick={() => doExport('download')}>⬇ Download PNG</button>
            <button className="btn" onClick={doSave}>{isSaved ? '💾 Update save' : '💾 Save'}</button>
            {cloud.status === 'live' && <button className="btn" onClick={() => setTab('save')}>🧱 Post</button>}
            {!inArtifact() && 'share' in navigator && <button className="btn" onClick={() => doExport('share')}>📤 Share</button>}
          </div>
        </div>

        <aside className="editor__panel">
          <div className="tabs" role="tablist">
            {(
              [
                ['text', '🔤 Text'],
                ['stickers', '😂 Stickers'],
                ['photo', '🖼 Photo'],
                ['layers', '🥞 Layers'],
                ['save', '💾 Save'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'tab--on' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'text' && (
            <div className="panel">
              <div className="row wrap">
                <button className="btn btn--sm" onClick={() => addText('top')}>+ Top caption</button>
                <button className="btn btn--sm" onClick={() => addText('bottom')}>+ Bottom caption</button>
                <button className="btn btn--sm" onClick={() => addText('middle')}>+ Text box</button>
              </div>
              {sel?.type === 'text' ? (
                <TextControls layer={sel} onChange={updateLayer} textRef={textRef} />
              ) : (
                <p className="muted small">Select a text box on the meme (or add one) to style it.</p>
              )}
              <div className="roast-inline">
                <div className="row">
                  <select value={roastCat} onChange={(e) => setRoastCat(e.target.value)} aria-label="Roast category">
                    {ROAST_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                  <button className="btn btn--sm btn--primary" onClick={() => setRoastIdeas(generateRoasts(roastCat, 5))}>🎲 Roast ideas</button>
                </div>
                {roastIdeas.map((r) => (
                  <button
                    key={r}
                    className="idea"
                    onClick={() => {
                      if (sel?.type === 'text') updateLayer({ ...sel, text: r });
                      else addLayer(textLayer({ x: meme.width / 2, y: meme.height * 0.88, w: meme.width * 0.9, text: r, fontSize: Math.round(meme.width * 0.05) }));
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'stickers' && (
            <div className="panel">
              <h4>Travis's face</h4>
              <div className="row wrap">
                <button className="btn btn--sm btn--primary" onClick={() => (store.photos.length ? setFacePicker(true) : faceInput.current?.click())}>🧑 Add Travis photo</button>
                <button className="btn btn--sm" onClick={() => faceInput.current?.click()}>⬆ Upload new</button>
                <input
                  ref={faceInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      const img = await readImageFile(f, 1200);
                      await store.addPhoto(img);
                      addFace(img.src, img.w, img.h);
                      toast('Added to the Travis Photo Bank too.');
                    } catch (err) {
                      toast((err as Error).message, 'err');
                    }
                  }}
                />
              </div>
              {sel?.type === 'image' && <ImageControls layer={sel} onChange={updateLayer} />}
              {sel?.type === 'sticker' && <StickerControls layer={sel} onChange={updateLayer} />}
              <h4>Stickers</h4>
              <div className="emoji-grid">
                {EMOJI_STICKERS.map((em) => (
                  <button key={em} className="emoji-btn" onClick={() => addLayer(stickerLayer(em, meme.width / 2, meme.height / 2, Math.round(meme.width * 0.14)))} aria-label={`Add ${em}`}>
                    {em}
                  </button>
                ))}
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (new FormData(e.currentTarget).get('em') as string).trim();
                  if (v) addLayer(stickerLayer(v, meme.width / 2, meme.height / 2, Math.round(meme.width * 0.14)));
                  e.currentTarget.reset();
                }}
              >
                <input name="em" placeholder="Any emoji or short text ✍️" maxLength={8} />
                <button className="btn btn--sm">Add</button>
              </form>
            </div>
          )}

          {tab === 'photo' && (
            <div className="panel">
              <div className="row wrap">
                <button className="btn btn--sm btn--primary" onClick={() => bgInput.current?.click()}>
                  {meme.background.kind === 'image' ? '🔁 Replace photo' : '📸 Use a photo instead'}
                </button>
                <input ref={bgInput} type="file" accept="image/*" hidden onChange={(e) => { startFromFile(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              {meme.background.kind === 'image' ? (
                <>
                  <label className="field">
                    <span>Crop</span>
                    <div className="seg">
                      {(['original', '1:1', '4:5', '9:16', '16:9'] as AspectKey[]).map((a) => (
                        <button key={a} className={meme.aspect === a ? 'on' : ''} onClick={() => setAspect(a)}>
                          {a === 'original' ? 'Orig' : a}
                        </button>
                      ))}
                    </div>
                  </label>
                  <Slider label="Zoom" min={1} max={5} step={0.01} value={meme.background.zoom} fmt={(v) => `${v.toFixed(2)}×`}
                    onChange={(v) => meme.background.kind === 'image' && change({ ...meme, background: { ...meme.background, zoom: v } }, true, 'zoom')} />
                  <p className="muted small">Drag empty space on the photo (or hit “Move photo”) to reposition it. Pinch to zoom on phones.</p>
                  <button className="btn btn--sm" onClick={() => meme.background.kind === 'image' && change({ ...meme, background: { ...meme.background, zoom: 1, panX: 0, panY: 0 } })}>
                    Reset crop
                  </button>
                </>
              ) : meme.background.kind === 'color' ? (
                <label className="field">
                  <span>Background color</span>
                  <input type="color" value={meme.background.color} onChange={(e) => change({ ...meme, background: { kind: 'color', color: e.target.value } }, true, 'bg')} />
                </label>
              ) : (
                <>
                  <p className="muted small">Using a built-in template. Swap it:</p>
                  <div className="mini-templates">
                    {TEMPLATES.map((t) => (
                      <button key={t.id} className="chip" onClick={async () => { if (await ask.confirm(`Switch to ${t.name}? Captions reset.`, { ok: 'Switch' })) load({ ...memeFromTemplate(t), id: meme.id, collectionId: meme.collectionId, title: meme.title }); }}>
                        {t.emoji} {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'layers' && (
            <div className="panel">
              {meme.layers.length === 0 && <p className="muted small">No layers yet. Add text or stickers.</p>}
              <ul className="layer-list">
                {[...meme.layers].reverse().map((l) => (
                  <li key={l.id} className={l.id === selectedId ? 'on' : ''}>
                    <button className="layer-name" onClick={() => setSelectedId(l.id)}>
                      {l.type === 'text' ? '🔤 ' + (l.text.slice(0, 28) || '(empty)') : l.type === 'sticker' ? l.emoji + ' sticker' : '🧑 Travis photo'}
                    </button>
                    <button className="icon-btn" title="Bring forward" onClick={() => moveLayer(l.id, 1)}>▲</button>
                    <button className="icon-btn" title="Send back" onClick={() => moveLayer(l.id, -1)}>▼</button>
                    <button className="icon-btn" title={l.hidden ? 'Show' : 'Hide'} onClick={() => updateLayer({ ...l, hidden: !l.hidden })}>{l.hidden ? '🙈' : '👁'}</button>
                    <button className="icon-btn" title="Delete" onClick={() => removeLayer(l.id)}>🗑</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'save' && (
            <div className="panel">
              <label className="field">
                <span>Title</span>
                <input value={meme.title} onChange={(e) => change({ ...meme, title: e.target.value }, true, 'title')} maxLength={80} />
              </label>
              <label className="field">
                <span>Collection</span>
                <select
                  value={meme.collectionId ?? ''}
                  onChange={async (e) => {
                    if (e.target.value === '__new') {
                      const name = await ask.prompt('Name your collection, e.g. "Travis at work"', '', 'Create');
                      if (name) {
                        const c = await store.addCollection(name);
                        change({ ...meme, collectionId: c.id });
                      }
                    } else change({ ...meme, collectionId: e.target.value || null });
                  }}
                >
                  <option value="">Uncategorized</option>
                  {store.collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                  <option value="__new">＋ New collection…</option>
                </select>
              </label>
              <div className="row wrap">
                <button className="btn btn--primary" onClick={doSave}>💾 {isSaved ? 'Update' : 'Save'} meme</button>
                {cloud.status === 'live' && (
                  <button
                    className="btn"
                    onClick={async () => {
                      setBusy('Posting to the Wall…');
                      try {
                        await cloud.postToWall({ title: meme.title, image: await wallImage(meme), meme: slimMeme(meme) });
                        toast('Posted to the Wall. Everyone can see it now.');
                      } catch (e) {
                        toast((e as Error).message, 'err');
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    🧱 Post to the Wall
                  </button>
                )}
                <button className="btn" onClick={() => { load({ ...cloneMeme(meme), id: uid('m'), title: meme.title + ' (copy)' }); toast('Duplicated — this is a new copy.'); }}>⧉ Save as copy</button>
              </div>
              <h4>Export size</h4>
              <div className="row wrap">
                <button className="btn btn--sm" onClick={() => doExport('download', 1080)}>1080px</button>
                <button className="btn btn--sm" onClick={() => doExport('download', 2000)}>2000px (HQ)</button>
                <button className="btn btn--sm" onClick={() => doExport('download', 3000)}>3000px (overkill)</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <Modal open={facePicker} onClose={() => setFacePicker(false)} title="Pick a Travis">
        {store.photos.length ? (
          <div className="photo-grid">
            {store.photos.map((p) => (
              <button key={p.id} className="photo-tile" onClick={() => addFace(p.src, p.w, p.h)}>
                <img src={p.src} alt="Travis" />
              </button>
            ))}
          </div>
        ) : (
          <Empty emoji="🕵️" title="No Travis photos yet" />
        )}
        <button className="btn btn--sm" onClick={() => faceInput.current?.click()}>⬆ Upload another</button>
      </Modal>
    </div>
  );
}

/* ---------------- controls ---------------- */

function Slider({ label, value, min, max, step = 1, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="field">
      <span>
        {label} <em>{fmt ? fmt(value) : Math.round(value)}</em>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className={`swatch ${value.toLowerCase() === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={`Color ${c}`} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Custom ${label}`} />
      </div>
    </div>
  );
}

function TextControls({ layer: l, onChange, textRef }: { layer: TextLayer; onChange: (l: Layer, key?: string) => void; textRef: React.RefObject<HTMLTextAreaElement> }) {
  return (
    <div className="controls">
      <label className="field">
        <span>Caption</span>
        <textarea ref={textRef} rows={2} value={l.text} onChange={(e) => onChange({ ...l, text: e.target.value }, 'text-' + l.id)} placeholder="Say something mean (but fun)" />
      </label>
      <label className="field">
        <span>Font</span>
        <select value={l.font} onChange={(e) => onChange({ ...l, font: e.target.value })} style={{ fontFamily: l.font }}>
          {FONTS.map((f) => (
            <option key={f.family} value={f.family}>{f.label}</option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>Style</span>
        <div className="seg">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={l.align === a ? 'on' : ''} onClick={() => onChange({ ...l, align: a })} aria-label={`Align ${a}`}>
              {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
            </button>
          ))}
          {(
            [
              ['none', 'Aa'],
              ['upper', 'AA'],
              ['mock', 'mOcK'],
            ] as const
          ).map(([t, lbl]) => (
            <button key={t} className={l.transform === t ? 'on' : ''} onClick={() => onChange({ ...l, transform: t })}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Size" min={10} max={260} value={l.fontSize} onChange={(v) => onChange({ ...l, fontSize: v }, 'size')} />
      <ColorRow label="Text color" value={l.color} onChange={(v) => onChange({ ...l, color: v }, 'color')} />
      <Slider label="Outline" min={0} max={20} value={l.strokeWidth} onChange={(v) => onChange({ ...l, strokeWidth: v }, 'stroke')} />
      {l.strokeWidth > 0 && <ColorRow label="Outline color" value={l.stroke} onChange={(v) => onChange({ ...l, stroke: v }, 'strokec')} />}
      <Slider label="Rotation" min={-180} max={180} value={l.rotation} fmt={(v) => `${Math.round(v)}°`} onChange={(v) => onChange({ ...l, rotation: v }, 'rot')} />
      <div className="row wrap">
        <label className="check">
          <input type="checkbox" checked={!!l.bg} onChange={(e) => onChange({ ...l, bg: e.target.checked ? '#000000' : undefined })} /> Background box
        </label>
        {l.bg && <input type="color" value={l.bg} onChange={(e) => onChange({ ...l, bg: e.target.value }, 'bgc')} aria-label="Box color" />}
        <label className="check">
          <input type="checkbox" checked={!!l.shadow} onChange={(e) => onChange({ ...l, shadow: e.target.checked })} /> Shadow
        </label>
      </div>
    </div>
  );
}

function StickerControls({ layer: l, onChange }: { layer: StickerLayer; onChange: (l: Layer, key?: string) => void }) {
  return (
    <div className="controls">
      <Slider label="Sticker size" min={16} max={800} value={l.size} onChange={(v) => onChange({ ...l, size: v }, 'ssize')} />
      <Slider label="Rotation" min={-180} max={180} value={l.rotation} fmt={(v) => `${Math.round(v)}°`} onChange={(v) => onChange({ ...l, rotation: v }, 'srot')} />
    </div>
  );
}

function ImageControls({ layer: l, onChange }: { layer: ImageLayer; onChange: (l: Layer, key?: string) => void }) {
  return (
    <div className="controls">
      <div className="field">
        <span>Shape</span>
        <div className="seg">
          <button className={l.shape === 'rect' ? 'on' : ''} onClick={() => onChange({ ...l, shape: 'rect' })}>▭ Rectangle</button>
          <button className={l.shape === 'circle' ? 'on' : ''} onClick={() => onChange({ ...l, shape: 'circle' })}>◯ Face cutout</button>
        </div>
      </div>
      <Slider label="Width" min={20} max={2000} value={l.w} onChange={(v) => onChange({ ...l, w: v }, 'iw')} />
      <Slider label="Height" min={20} max={2000} value={l.h} onChange={(v) => onChange({ ...l, h: v }, 'ih')} />
      <Slider label="Rotation" min={-180} max={180} value={l.rotation} fmt={(v) => `${Math.round(v)}°`} onChange={(v) => onChange({ ...l, rotation: v }, 'irot')} />
      <label className="check">
        <input type="checkbox" checked={!!l.border} onChange={(e) => onChange({ ...l, border: e.target.checked ? '#ffffff' : undefined })} /> White border
      </label>
    </div>
  );
}
