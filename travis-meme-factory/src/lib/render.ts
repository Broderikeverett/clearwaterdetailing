import type { Layer, Meme, TextLayer } from '../types';
import { getTemplate } from './templates';

export const FONTS: { family: string; label: string; weight: number }[] = [
  { family: 'Anton', label: 'Classic Meme (Anton)', weight: 400 },
  { family: 'Impact', label: 'Impact (if installed)', weight: 400 },
  { family: 'Bangers', label: 'Bangers', weight: 400 },
  { family: 'Permanent Marker', label: 'Permanent Marker', weight: 400 },
  { family: 'Comic Neue', label: 'Comic Neue', weight: 700 },
  { family: 'Oswald', label: 'Oswald', weight: 700 },
  { family: 'Bebas Neue', label: 'Bebas Neue', weight: 400 },
  { family: 'Space Grotesk', label: 'Space Grotesk', weight: 700 },
  { family: 'Arial', label: 'Arial', weight: 700 },
  { family: 'Georgia', label: 'Georgia (serious news)', weight: 700 },
  { family: 'Courier New', label: 'Courier (hacker Travis)', weight: 700 },
];

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

const fontWeight = (family: string) => FONTS.find((f) => f.family === family)?.weight ?? 700;
export const fontString = (family: string, size: number) =>
  `${fontWeight(family)} ${Math.max(1, size)}px "${family}", Anton, Impact, sans-serif`;

/* ---------------- images ---------------- */

const imageCache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(src);
  if (p) return p;
  const prom = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageCache.set(src, img);
      pending.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(src);
      reject(new Error('Could not load that image. Is it actually an image?'));
    };
    img.src = src;
  });
  pending.set(src, prom);
  return prom;
}

export const memeImageSources = (meme: Meme): string[] => {
  const out: string[] = [];
  if (meme.background.kind === 'image') out.push(meme.background.src);
  for (const l of meme.layers) if (l.type === 'image') out.push(l.src);
  return out;
};

/** Ensure every image and font a meme needs is ready before drawing (important for export). */
export async function prepareMeme(meme: Meme): Promise<void> {
  const fonts = new Set(meme.layers.filter((l): l is TextLayer => l.type === 'text').map((l) => l.font));
  await Promise.all([
    ...memeImageSources(meme).map((s) => loadImage(s).catch(() => null)),
    ...[...fonts].map((f) => document.fonts?.load(fontString(f, 48), 'Travis').catch(() => null)),
  ]);
}

/* ---------------- text ---------------- */

export function transformText(text: string, t: TextLayer['transform']): string {
  if (t === 'upper') return text.toUpperCase();
  if (t === 'mock') {
    let i = 0;
    return [...text]
      .map((ch) => {
        if (!/[a-z]/i.test(ch)) return ch;
        return i++ % 2 ? ch.toUpperCase() : ch.toLowerCase();
      })
      .join('');
  }
  return text;
}

export interface TextLayout {
  lines: string[];
  lineHeight: number;
  width: number;
  height: number;
}

export function layoutText(ctx: CanvasRenderingContext2D, l: TextLayer): TextLayout {
  ctx.font = fontString(l.font, l.fontSize);
  const lineHeight = l.fontSize * 1.12;
  const lines: string[] = [];
  const raw = transformText(l.text || ' ', l.transform);
  for (const para of raw.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= l.w || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return { lines, lineHeight, width: l.w, height: Math.max(lineHeight, lines.length * lineHeight) };
}

/** Half-size of a layer's local (unrotated) bounding box. */
export function layerSize(ctx: CanvasRenderingContext2D, l: Layer): { w: number; h: number } {
  if (l.type === 'text') {
    const lay = layoutText(ctx, l);
    return { w: l.w, h: lay.height + (l.bg ? l.fontSize * 0.3 : 0) };
  }
  if (l.type === 'sticker') return { w: l.size * 1.15, h: l.size * 1.15 };
  return { w: l.w, h: l.h };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const lay = layoutText(ctx, l);
  const pad = l.bg ? l.fontSize * 0.15 : 0;
  const totalH = lay.height + pad * 2;
  if (l.bg) {
    ctx.fillStyle = l.bg;
    roundRect(ctx, -l.w / 2 - pad, -totalH / 2, l.w + pad * 2, totalH, Math.min(12, l.fontSize * 0.15));
    ctx.fill();
  }
  ctx.font = fontString(l.font, l.fontSize);
  ctx.textBaseline = 'middle';
  ctx.textAlign = l.align;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const ax = l.align === 'left' ? -l.w / 2 : l.align === 'right' ? l.w / 2 : 0;
  lay.lines.forEach((line, i) => {
    const y = -lay.height / 2 + lay.lineHeight * (i + 0.5);
    if (l.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = l.fontSize * 0.25;
      ctx.shadowOffsetY = l.fontSize * 0.06;
      ctx.fillStyle = l.color;
      ctx.fillText(line, ax, y);
      ctx.restore();
    }
    if (l.strokeWidth > 0) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.strokeWidth * 2;
      ctx.strokeText(line, ax, y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(line, ax, y);
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawLayer(ctx: CanvasRenderingContext2D, l: Layer) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate((l.rotation * Math.PI) / 180);
  if (l.type === 'text') drawText(ctx, l);
  else if (l.type === 'sticker') {
    ctx.font = `${l.size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.emoji, 0, l.size * 0.06);
  } else {
    const img = imageCache.get(l.src);
    ctx.beginPath();
    if (l.shape === 'circle') ctx.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(-l.w / 2, -l.h / 2, l.w, l.h);
    ctx.save();
    ctx.clip();
    if (img) drawCover(ctx, img, -l.w / 2, -l.h / 2, l.w, l.h);
    else {
      ctx.fillStyle = '#333';
      ctx.fill();
    }
    ctx.restore();
    if (l.border) {
      ctx.lineWidth = Math.max(3, Math.min(l.w, l.h) * 0.03);
      ctx.strokeStyle = l.border;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBackground(ctx: CanvasRenderingContext2D, meme: Meme) {
  const { width: W, height: H, background: bg } = meme;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (bg.kind === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.kind === 'template') {
    const t = getTemplate(bg.templateId);
    if (t) {
      ctx.save();
      ctx.scale(W / t.width, H / t.height);
      t.draw(ctx, t.width, t.height);
      ctx.restore();
    }
  } else {
    const img = imageCache.get(bg.src);
    if (img) {
      const s0 = Math.max(W / bg.natW, H / bg.natH);
      const s = s0 * bg.zoom;
      const dw = bg.natW * s;
      const dh = bg.natH * s;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (W - dw) / 2 + bg.panX, (H - dh) / 2 + bg.panY, dw, dh);
    }
  }
}

/** Draw a meme at `scale` (output pixels per design pixel). */
export function renderMeme(ctx: CanvasRenderingContext2D, meme: Meme, scale = 1) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  drawBackground(ctx, meme);
  for (const l of meme.layers) if (!l.hidden) drawLayer(ctx, l);
  ctx.restore();
}

/** Convert a design-space point into a layer's local, unrotated coords. */
export function toLocal(l: Layer, px: number, py: number) {
  const a = (-l.rotation * Math.PI) / 180;
  const dx = px - l.x;
  const dy = py - l.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

export function hitTest(ctx: CanvasRenderingContext2D, meme: Meme, px: number, py: number, pad = 0): Layer | null {
  for (let i = meme.layers.length - 1; i >= 0; i--) {
    const l = meme.layers[i];
    if (l.hidden) continue;
    const { w, h } = layerSize(ctx, l);
    const p = toLocal(l, px, py);
    if (Math.abs(p.x) <= w / 2 + pad && Math.abs(p.y) <= h / 2 + pad) return l;
  }
  return null;
}
