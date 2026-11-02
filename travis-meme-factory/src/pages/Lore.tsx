import { useState } from 'react';
import { useCloud } from '../cloud';
import { useStore } from '../store';
import { ask } from '../components/ask';
import { Empty, PageHead } from '../components/ui';

const STARTERS = [
  'The time Travis…',
  'Travis genuinely believes…',
  'Travis always says…',
  'Worst thing Travis ever did on a date:',
  'Travis at work:',
  'Travis’s most delusional plan:',
];

export function Lore({ go }: { go: (r: string) => void }) {
  const cloud = useCloud();
  const { toast } = useStore();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const shared = cloud.status === 'live';

  const submit = async () => {
    if (text.trim().length < 8) return toast('Give me a little more than that. Details make it hurt.', 'info');
    setSaving(true);
    try {
      await cloud.addLore(text);
      setText('');
      toast(shared ? 'Added to the group vault. Everyone can roast with it now.' : 'Story saved.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        kicker={shared ? 'Travis Lore · shared with the group' : 'Travis Lore'}
        title={<>Feed the <span className="grad">roaster</span></>}
        sub="Tell stories about Travis: dumb things he did, things he says, his worst takes. Claude reads them and writes roasts built on the real details."
      />

      <div className="card">
        <label className="field" htmlFor="lore-text">
          <span>New story</span>
        </label>
        <textarea
          id="lore-text"
          rows={4}
          value={text}
          maxLength={1500}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Travis locked his keys in his car at Taco Bell, then tried to get them out with a spork while the car was still running. Took 40 minutes. Ordered more food during."
        />
        <div className="row wrap">
          {STARTERS.map((s) => (
            <button key={s} className="chip" onClick={() => setText((t) => (t ? t : s + ' '))}>
              {s}
            </button>
          ))}
        </div>
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <span className="muted small">{text.length}/1500 · Specific names, places and quotes make the best roasts.</span>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : '➕ Add to lore'}
          </button>
        </div>
      </div>

      {cloud.status === 'connecting' && <p className="muted small">Connecting to the group vault…</p>}
      {cloud.status === 'error' && <p className="muted small">Couldn't reach shared storage, so stories are only saved on this device.</p>}

      <div className="card">
        <div className="card__head">
          <h2>📜 The Lore ({cloud.lore.length})</h2>
          {cloud.lore.length > 0 && (
            <button className="btn btn--sm btn--primary" onClick={() => go('roasts')}>
              🔥 Roast him with these
            </button>
          )}
        </div>
        {cloud.lore.length === 0 ? (
          <Empty emoji="📜" title="No lore yet">
            <p className="muted">Add the first story above. One good one is enough to get roasting.</p>
          </Empty>
        ) : (
          <ul className="lore-list">
            {cloud.lore.map((l) => (
              <li key={l.id} className="lore">
                <p>{l.text}</p>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <small className="muted">
                    {shared ? (l.by === cloud.me ? 'You' : cloud.names[l.by] || 'Someone') + ' · ' : ''}
                    {new Date(l.createdAt).toLocaleDateString()}
                  </small>
                  {(!shared || l.by === cloud.me || cloud.isOwner) && (
                    <button
                      className="icon-btn"
                      aria-label="Delete story"
                      onClick={async () => {
                        if (!(await ask.confirm('Delete this story?', { ok: 'Delete', danger: true }))) return;
                        cloud.deleteLore(l.id).catch((e: Error) => toast(e.message, 'err'));
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
