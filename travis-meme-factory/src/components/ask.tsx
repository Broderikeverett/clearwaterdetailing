import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';

/*
 * In-page replacements for window.confirm / window.prompt, which claude.ai's
 * artifact viewer silently disables (confirm → false, prompt → null).
 */
type Req =
  | { kind: 'confirm'; message: string; ok: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; message: string; ok: string; value: string; resolve: (v: string | null) => void };

let push: ((r: Req) => void) | null = null;

export const ask = {
  confirm(message: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      if (!push) return resolve(false);
      push({ kind: 'confirm', message, ok: opts.ok ?? 'Yes', danger: opts.danger ?? false, resolve });
    });
  },
  prompt(message: string, value = '', ok = 'Save'): Promise<string | null> {
    return new Promise((resolve) => {
      if (!push) return resolve(null);
      push({ kind: 'prompt', message, ok, value, resolve });
    });
  },
};

export function DialogHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [val, setVal] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    push = (r) => {
      setReq(r);
      if (r.kind === 'prompt') setVal(r.value);
    };
    return () => {
      push = null;
    };
  }, []);
  useEffect(() => {
    if (req?.kind === 'prompt') setTimeout(() => input.current?.select(), 30);
  }, [req]);

  const close = (result: boolean) => {
    if (!req) return;
    if (req.kind === 'confirm') req.resolve(result);
    else req.resolve(result && val.trim() ? val.trim() : null);
    setReq(null);
  };

  return (
    <Modal open={!!req} onClose={() => close(false)} title={req?.kind === 'prompt' ? 'Name it' : 'You sure?'}>
      {req && (
        <form
          className="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            close(true);
          }}
        >
          <p>{req.message}</p>
          {req.kind === 'prompt' && <input id="ask-input" ref={input} value={val} onChange={(e) => setVal(e.target.value)} maxLength={80} />}
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => close(false)}>Cancel</button>
            <button type="submit" className={`btn ${req.kind === 'confirm' && req.danger ? 'btn--danger' : 'btn--primary'}`} autoFocus={req.kind === 'confirm'}>
              {req.ok}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
