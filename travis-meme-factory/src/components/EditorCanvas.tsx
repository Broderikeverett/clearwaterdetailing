import { useEffect, useRef, useState } from 'react';
import type { Layer, Meme } from '../types';
import { hitTest, layerSize, prepareMeme, renderMeme, toLocal } from '../lib/render';
import { clamp } from '../lib/random';

type Drag =
  | { kind: 'move'; id: string; ox: number; oy: number; sx: number; sy: number }
  | { kind: 'scale'; id: string; orig: Layer; startDist: number }
  | { kind: 'width'; id: string; orig: Layer }
  | { kind: 'rotate'; id: string; orig: Layer }
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number }
  | { kind: 'pinch'; id: string | null; orig: Layer | null; startDist: number; startAngle: number; zoom: number };

interface Props {
  meme: Meme;
  selectedId: string | null;
  panMode: boolean;
  onSelect: (id: string | null) => void;
  /** commit=false for live drag frames, true when the gesture ends */
  onChange: (m: Meme, commit: boolean) => void;
  onEditText: (id: string) => void;
}

const HANDLE_CSS = 13; // css px radius of handles

/** Apply a uniform scale factor to a layer. */
function scaleLayer(l: Layer, f: number): Layer {
  if (l.type === 'text') return { ...l, fontSize: clamp(l.fontSize * f, 8, 600), w: clamp(l.w * f, 40, 6000) };
  if (l.type === 'sticker') return { ...l, size: clamp(l.size * f, 16, 1600) };
  return { ...l, w: clamp(l.w * f, 20, 6000), h: clamp(l.h * f, 20, 6000) };
}

export function EditorCanvas({ meme, selectedId, panMode, onSelect, onChange, onEditText }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const memeRef = useRef(meme);
  memeRef.current = meme;
  const [fontTick, setFontTick] = useState(0);
  const lastTap = useRef<{ t: number; id: string | null }>({ t: 0, id: null });

  // Re-render once web fonts / images finish loading.
  useEffect(() => {
    const bump = () => setFontTick((t) => t + 1);
    document.fonts?.addEventListener?.('loadingdone', bump);
    return () => document.fonts?.removeEventListener?.('loadingdone', bump);
  }, []);
  useEffect(() => {
    let alive = true;
    prepareMeme(meme).then(() => alive && setFontTick((t) => t + 1));
    return () => {
      alive = false;
    };
    // only when image sources/fonts change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([meme.background.kind === 'image' ? meme.background.src.length : 0, meme.layers.map((l) => (l.type === 'image' ? l.src.length : l.type === 'text' ? l.font : ''))])]);

  const unit = () => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return meme.width / Math.max(1, r.width);
  };

  // draw
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (c.width !== meme.width || c.height !== meme.height) {
      c.width = meme.width;
      c.height = meme.height;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    renderMeme(ctx, meme, 1);
    const sel = meme.layers.find((l) => l.id === selectedId);
    if (!sel || sel.hidden) return;
    const u = unit();
    const { w, h } = layerSize(ctx, sel);
    ctx.save();
    ctx.translate(sel.x, sel.y);
    ctx.rotate((sel.rotation * Math.PI) / 180);
    ctx.setLineDash([10 * u, 6 * u]);
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = '#3ab8ff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4 * u;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);
    // rotate stem
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, -h / 2 - 34 * u);
    ctx.stroke();
    const dot = (x: number, y: number, fill: string, glyph?: string) => {
      ctx.beginPath();
      ctx.arc(x, y, HANDLE_CSS * u, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2.5 * u;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (glyph) {
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${15 * u}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, x, y + u);
      }
    };
    dot(w / 2, h / 2, '#8b5cf6', '⤡');
    dot(0, -h / 2 - 34 * u, '#3ab8ff', '↻');
    if (sel.type === 'text') dot(w / 2, 0, '#2563eb', '↔');
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meme, selectedId, fontTick]);

  const pt = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * meme.width, y: ((e.clientY - r.top) / r.height) * meme.height };
  };

  const replace = (l: Layer) => ({ ...memeRef.current, layers: memeRef.current.layers.map((x) => (x.id === l.id ? l : x)) });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers/synthetic events have no capturable pointer */
    }
    const p = pt(e);
    pointers.current.set(e.pointerId, p);
    const ctx = c.getContext('2d')!;
    const m = memeRef.current;

    // two-finger pinch: scale/rotate selected layer, or zoom the photo
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const sel = m.layers.find((l) => l.id === selectedId) ?? null;
      drag.current = {
        kind: 'pinch',
        id: sel?.id ?? null,
        orig: sel,
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startAngle: Math.atan2(b.y - a.y, b.x - a.x),
        zoom: m.background.kind === 'image' ? m.background.zoom : 1,
      };
      return;
    }

    const u = unit();
    const sel = m.layers.find((l) => l.id === selectedId);
    if (sel && !sel.hidden && !panMode) {
      const { w, h } = layerSize(ctx, sel);
      const lp = toLocal(sel, p.x, p.y);
      const near = (x: number, y: number) => Math.hypot(lp.x - x, lp.y - y) <= (HANDLE_CSS + 8) * u;
      if (near(w / 2, h / 2)) {
        drag.current = { kind: 'scale', id: sel.id, orig: sel, startDist: Math.max(1, Math.hypot(p.x - sel.x, p.y - sel.y)) };
        return;
      }
      if (near(0, -h / 2 - 34 * u)) {
        drag.current = { kind: 'rotate', id: sel.id, orig: sel };
        return;
      }
      if (sel.type === 'text' && near(w / 2, 0)) {
        drag.current = { kind: 'width', id: sel.id, orig: sel };
        return;
      }
    }

    const hit = panMode ? null : hitTest(ctx, m, p.x, p.y, 6 * u);
    if (hit) {
      const now = Date.now();
      if (hit.type === 'text' && lastTap.current.id === hit.id && now - lastTap.current.t < 350) onEditText(hit.id);
      lastTap.current = { t: now, id: hit.id };
      onSelect(hit.id);
      drag.current = { kind: 'move', id: hit.id, ox: hit.x, oy: hit.y, sx: p.x, sy: p.y };
      return;
    }
    onSelect(null);
    if (m.background.kind === 'image') {
      drag.current = { kind: 'pan', sx: p.x, sy: p.y, panX: m.background.panX, panY: m.background.panY };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = pt(e);
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (!d) return;
    const m = memeRef.current;
    if (d.kind === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const f = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, d.startDist);
      const ang = Math.atan2(b.y - a.y, b.x - a.x) - d.startAngle;
      if (d.orig) {
        const scaled = scaleLayer(d.orig, f);
        onChange(replace({ ...scaled, rotation: d.orig.rotation + (ang * 180) / Math.PI }), false);
      } else if (m.background.kind === 'image') {
        onChange({ ...m, background: { ...m.background, zoom: clamp(d.zoom * f, 1, 6) } }, false);
      }
      return;
    }
    if (d.kind === 'pan' && m.background.kind === 'image') {
      onChange({ ...m, background: { ...m.background, panX: d.panX + (p.x - d.sx), panY: d.panY + (p.y - d.sy) } }, false);
      return;
    }
    const l = m.layers.find((x) => x.id === (d as { id: string }).id);
    if (!l) return;
    if (d.kind === 'move') {
      let nx = d.ox + (p.x - d.sx);
      let ny = d.oy + (p.y - d.sy);
      // gentle snap to center lines
      const snap = 10 * unit();
      if (Math.abs(nx - m.width / 2) < snap) nx = m.width / 2;
      if (Math.abs(ny - m.height / 2) < snap) ny = m.height / 2;
      onChange(replace({ ...l, x: nx, y: ny }), false);
    } else if (d.kind === 'scale') {
      const f = Math.hypot(p.x - d.orig.x, p.y - d.orig.y) / d.startDist;
      onChange(replace(scaleLayer(d.orig, f)), false);
    } else if (d.kind === 'width' && d.orig.type === 'text') {
      const lp = toLocal(d.orig, p.x, p.y);
      onChange(replace({ ...d.orig, w: clamp(Math.abs(lp.x) * 2, 60, m.width * 3) }), false);
    } else if (d.kind === 'rotate') {
      let deg = (Math.atan2(p.y - d.orig.y, p.x - d.orig.x) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(deg - s) < 4) deg = s;
      onChange(replace({ ...l, rotation: Math.round(deg) }), false);
    }
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (drag.current) {
      const moved = drag.current.kind !== 'move' || memeRef.current.layers.find((l) => l.id === (drag.current as { id: string }).id)?.x !== drag.current.ox;
      if (pointers.current.size === 0) {
        if (moved) onChange(memeRef.current, true);
        drag.current = null;
      } else if (drag.current.kind === 'pinch') {
        onChange(memeRef.current, true);
        drag.current = null;
      }
    }
  };

  return (
    <canvas
      ref={ref}
      className={`editor-canvas ${panMode ? 'is-pan' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={(e) => {
        const ctx = ref.current!.getContext('2d')!;
        const p = pt(e);
        const hit = hitTest(ctx, memeRef.current, p.x, p.y);
        if (hit?.type === 'text') onEditText(hit.id);
      }}
      aria-label="Meme editor canvas. Tap to select, drag to move."
    />
  );
}
