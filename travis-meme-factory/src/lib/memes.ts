import type { AspectKey, ImageLayer, Meme, MemeTemplate, Photo, StickerLayer, TextLayer } from '../types';
import { TEMPLATES, getTemplate } from './templates';
import { pick, uid, sample } from './random';
import { breakingNews, randomTicker, anyCaption, EMOJI_STICKERS } from './roasts';
import { prepareMeme, renderMeme } from './render';
import { saveFile } from '../cloud';

export const DESIGN_W = 1000;

export function textLayer(p: Partial<TextLayer> & { x: number; y: number }): TextLayer {
  return {
    id: uid('t'),
    type: 'text',
    text: 'TRAVIS',
    font: 'Anton',
    fontSize: 72,
    w: 900,
    color: '#ffffff',
    stroke: '#000000',
    strokeWidth: 5,
    align: 'center',
    transform: 'upper',
    rotation: 0,
    ...p,
  };
}

export const stickerLayer = (emoji: string, x: number, y: number, size = 140): StickerLayer => ({
  id: uid('s'),
  type: 'sticker',
  emoji,
  x,
  y,
  size,
  rotation: 0,
});

export const imageLayer = (src: string, x: number, y: number, w: number, h: number, shape: 'rect' | 'circle' = 'rect'): ImageLayer => ({
  id: uid('i'),
  type: 'image',
  src,
  x,
  y,
  w,
  h,
  shape,
  rotation: 0,
});

export function memeFromTemplate(t: MemeTemplate, captions?: string[]): Meme {
  const now = Date.now();
  return {
    id: uid('m'),
    title: `${t.name} (Travis edition)`,
    width: t.width,
    height: t.height,
    aspect: 'original',
    background: { kind: 'template', templateId: t.id },
    layers: t.texts.map((tx, i) => {
      const { text, ...rest } = tx;
      return textLayer({ ...rest, text: captions?.[i] ?? text, transform: tx.transform ?? (tx.strokeWidth === 0 ? 'none' : 'upper') });
    }),
    collectionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function sizeForAspect(aspect: AspectKey, natW: number, natH: number) {
  const W = DESIGN_W;
  const ratio: Record<AspectKey, number> = { original: natH / natW, '1:1': 1, '4:5': 5 / 4, '9:16': 16 / 9, '16:9': 9 / 16 };
  return { width: W, height: Math.round(W * ratio[aspect]) };
}

export function memeFromPhoto(p: { src: string; w: number; h: number }, withCaptions = true): Meme {
  const { width, height } = sizeForAspect('original', p.w, p.h);
  const now = Date.now();
  return {
    id: uid('m'),
    title: 'Untitled Travis Masterpiece',
    width,
    height,
    aspect: 'original',
    background: { kind: 'image', src: p.src, natW: p.w, natH: p.h, zoom: 1, panX: 0, panY: 0 },
    layers: withCaptions
      ? [textLayer({ x: width / 2, y: height * 0.09, w: width * 0.92, text: 'Top text', fontSize: 80 }), textLayer({ x: width / 2, y: height * 0.91, w: width * 0.92, text: 'Bottom text', fontSize: 80 })]
      : [],
    collectionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Drop Travis's face into the template's slots. */
export function addFaces(meme: Meme, t: MemeTemplate | undefined, photos: Photo[]) {
  if (!t || !photos.length || !t.slots.length) return;
  const slots = t.slots.length > 1 ? sample(t.slots, Math.ceil(Math.random() * t.slots.length)) : t.slots;
  for (const s of slots) {
    const ph = pick(photos);
    meme.layers.splice(0, 0, { ...imageLayer(ph.src, s.x, s.y, s.w, s.h, s.shape ?? 'circle'), border: s.shape === 'rect' ? undefined : '#ffffff' });
  }
}

export function newsMeme(headline?: string, photo?: Photo): Meme {
  const t = getTemplate('breaking-news')!;
  const m = memeFromTemplate(t, [headline ?? breakingNews(1)[0], randomTicker()]);
  m.title = 'BREAKING: ' + (m.layers[0] as TextLayer).text.slice(0, 40);
  if (photo) addFaces(m, t, [photo]);
  else m.layers.push(stickerLayer(pick(['🤡', '🤦‍♂️', '🫠', '🙃', '😵‍💫']), 300, 260, 260));
  return m;
}

/** The MAKE TRAVIS LOOK STUPID engine. */
export function randomMeme(photos: Photo[], customTemplates: Photo[] = []): Meme {
  const roll = Math.random();
  let meme: Meme;
  if (photos.length && roll < 0.25) {
    meme = memeFromPhoto(pick(photos));
    const [a, b] = [anyCaption(), anyCaption()];
    (meme.layers[0] as TextLayer).text = a.length > 70 ? 'Travis:' : a;
    (meme.layers[1] as TextLayer).text = a.length > 70 ? a : b;
    if (a.length > 70) (meme.layers[1] as TextLayer).fontSize = 54;
  } else if (customTemplates.length && roll < 0.4) {
    meme = memeFromPhoto(pick(customTemplates));
    (meme.layers[0] as TextLayer).text = 'Travis:';
    (meme.layers[1] as TextLayer).text = anyCaption();
    (meme.layers[1] as TextLayer).fontSize = 54;
  } else if (roll < 0.5) {
    meme = newsMeme(undefined, photos.length ? pick(photos) : undefined);
  } else {
    const usable = TEMPLATES.filter((t) => t.captionSets.length && t.captionSets[0].length);
    const t = pick(usable);
    const idx = Math.floor(Math.random() * 100);
    const captions = t.captionSets.map((set) => set[idx % set.length]);
    meme = memeFromTemplate(t, captions);
    addFaces(meme, t, photos);
  }
  if (Math.random() < 0.6) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const s = stickerLayer(pick(EMOJI_STICKERS), meme.width * (0.12 + Math.random() * 0.76), meme.height * (0.25 + Math.random() * 0.5), 90 + Math.random() * 60);
      s.rotation = Math.random() * 40 - 20;
      meme.layers.push(s);
    }
  }
  meme.title = 'Certified Travis Moment #' + Math.floor(Math.random() * 9000 + 1000);
  return meme;
}

/* ---------------- export ---------------- */

export async function renderToCanvas(meme: Meme, targetWidth: number): Promise<HTMLCanvasElement> {
  await prepareMeme(meme);
  // stay under mobile Safari's ~16.7MP canvas limit
  const maxPixels = 12_000_000;
  let scale = targetWidth / meme.width;
  if (meme.width * scale * meme.height * scale > maxPixels) scale = Math.sqrt(maxPixels / (meme.width * meme.height));
  const c = document.createElement('canvas');
  c.width = Math.round(meme.width * scale);
  c.height = Math.round(meme.height * scale);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Your browser refused to give us a canvas. Rude.');
  renderMeme(ctx, meme, scale);
  return c;
}

export async function thumbnail(meme: Meme, width = 360): Promise<string> {
  const c = await renderToCanvas(meme, width);
  return c.toDataURL('image/jpeg', 0.82);
}

/** JPEG small enough for a shared wall post (< ~180 KB). */
export async function wallImage(meme: Meme): Promise<string> {
  for (const [w, q] of [[900, 0.82], [760, 0.75], [600, 0.7], [480, 0.65]] as const) {
    const url = (await renderToCanvas(meme, w)).toDataURL('image/jpeg', q);
    if (url.length < 180_000) return url;
  }
  return (await renderToCanvas(meme, 360)).toDataURL('image/jpeg', 0.6);
}

export async function exportPNG(meme: Meme, width = 2000): Promise<Blob> {
  const c = await renderToCanvas(meme, width);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed. Travis probably touched something.'))), 'image/png'),
  );
}

export const fileNameFor = (meme: Meme) =>
  (meme.title || 'travis-meme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '.png';

/** Save via claude.ai's download prompt when hosted there, else a normal browser download. */
export const downloadBlob = (blob: Blob, name: string) => saveFile(blob, name);

export async function shareBlob(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: 'Travis Meme Factory' });
    return true;
  }
  return false;
}

/* ---------------- uploads ---------------- */

/** Read a user file, downscale to keep storage sane, return a data URL + size. */
export async function readImageFile(file: File, maxDim = 2000): Promise<{ src: string; w: number; h: number }> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|png|jpe?g|gif|webp|bmp)$/i.test(file.name)) {
    throw new Error(`"${file.name}" isn't an image. Nice try, Travis.`);
  }
  if (file.size > 40 * 1024 * 1024) throw new Error('That file is over 40MB. Even Travis isn\'t that big.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image. HEIC photos may need converting to JPG first."));
      i.src = url;
    });
    const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const isPng = file.type === 'image/png';
    return { src: c.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export const cloneMeme = (m: Meme): Meme => JSON.parse(JSON.stringify(m));
