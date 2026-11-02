import { useEffect, useRef, useState } from 'react';
import type { Meme } from '../types';
import { prepareMeme, renderMeme } from '../lib/render';
import { Spinner } from './ui';

/** Static, read-only render of a meme (same renderer as export, so what you see is what you download). */
export function MemePreview({ meme, className = '', maxWidth = 1000 }: { meme: Meme; className?: string; maxWidth?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    prepareMeme(meme)
      .then(() => {
        if (!alive || !ref.current) return;
        const c = ref.current;
        const scale = Math.min(1, maxWidth / meme.width) * Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.round(meme.width * scale);
        c.height = Math.round(meme.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        renderMeme(ctx, meme, scale);
        setState('ok');
      })
      .catch(() => alive && setState('err'));
    return () => {
      alive = false;
    };
  }, [meme, maxWidth]);

  return (
    <div className={`meme-preview ${className}`} style={{ aspectRatio: `${meme.width} / ${meme.height}` }}>
      <canvas ref={ref} aria-label={meme.title} role="img" />
      {state === 'loading' && (
        <div className="meme-preview__overlay">
          <Spinner />
        </div>
      )}
      {state === 'err' && <div className="meme-preview__overlay">💥 Render failed</div>}
    </div>
  );
}
