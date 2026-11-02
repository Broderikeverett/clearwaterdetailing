import { useState } from 'react';
import { useStore } from '../store';
import { Empty, PageHead, Spinner } from '../components/ui';
import { ask } from '../components/ask';
import { downloadBlob, exportPNG, fileNameFor } from '../lib/memes';
import type { Meme } from '../types';

const COLLECTION_EMOJI = ['📁', '🔥', '💀', '🏀', '💼', '💘', '🎓', '🤡', '🐐', '🚨'];

export function Saved({ go }: { go: (r: string) => void }) {
  const store = useStore();
  const { memes, collections } = store;
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!store.ready) return <Spinner label="Opening the vault…" />;

  const visible = memes.filter(
    (m) =>
      (filter === 'all' || (filter === 'none' ? !m.collectionId : m.collectionId === filter)) &&
      m.title.toLowerCase().includes(q.toLowerCase()),
  );

  const move = async (m: Meme, collectionId: string | null) => {
    try {
      await store.saveMeme({ ...m, collectionId });
      store.toast('Moved.');
    } catch {
      /* toasted */
    }
  };

  const newCollection = async () => {
    const name = await ask.prompt('Collection name, e.g. "Travis at the gym"', '', 'Create');
    if (!name) return;
    const c = await store.addCollection(name, COLLECTION_EMOJI[collections.length % COLLECTION_EMOJI.length]);
    setFilter(c.id);
  };

  return (
    <div className="page">
      <PageHead kicker="The Vault" title={<>Saved <span className="grad">evidence</span></>} sub={`${memes.length} meme${memes.length === 1 ? '' : 's'} stored on this device.`} />

      <div className="collections">
        <button className={`chip ${filter === 'all' ? 'chip--on' : ''}`} onClick={() => setFilter('all')}>
          🗂 All ({memes.length})
        </button>
        <button className={`chip ${filter === 'none' ? 'chip--on' : ''}`} onClick={() => setFilter('none')}>
          📥 Uncategorized ({memes.filter((m) => !m.collectionId).length})
        </button>
        {collections.map((c) => (
          <span key={c.id} className={`chip chip--group ${filter === c.id ? 'chip--on' : ''}`}>
            <button onClick={() => setFilter(c.id)}>
              {c.emoji} {c.name} ({memes.filter((m) => m.collectionId === c.id).length})
            </button>
            {filter === c.id && (
              <>
                <button
                  title="Rename"
                  onClick={async () => {
                    const n = await ask.prompt('Rename collection', c.name);
                    if (n) store.renameCollection(c.id, n);
                  }}
                >
                  ✏️
                </button>
                <button
                  title="Delete collection"
                  onClick={async () => {
                    if (await ask.confirm(`Delete "${c.name}"? Memes inside are kept as uncategorized.`, { ok: 'Delete', danger: true })) {
                      store.deleteCollection(c.id);
                      setFilter('all');
                    }
                  }}
                >
                  🗑
                </button>
              </>
            )}
          </span>
        ))}
        <button className="chip chip--add" onClick={newCollection}>
          ＋ New collection
        </button>
      </div>

      {memes.length > 0 && <input className="search" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} />}

      {memes.length === 0 ? (
        <Empty emoji="🕳️" title="Nothing saved yet">
          <p className="muted">Travis is currently un-memed. This is unacceptable.</p>
          <button className="btn btn--primary" onClick={() => go('create')}>
            Start creating
          </button>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty emoji="🔍" title="Nothing in here" />
      ) : (
        <div className="saved-grid">
          {visible.map((m) => (
            <div key={m.id} className="saved-card">
              <button className="saved-card__img" onClick={() => store.openInEditor(m)} aria-label={`Edit ${m.title}`}>
                {m.thumbnail ? <img src={m.thumbnail} alt={m.title} loading="lazy" /> : <span>🖼</span>}
              </button>
              <div className="saved-card__meta">
                <strong title={m.title}>{m.title}</strong>
                <small className="muted">{new Date(m.updatedAt).toLocaleDateString()}</small>
                <select value={m.collectionId ?? ''} onChange={(e) => move(m, e.target.value || null)} aria-label="Collection">
                  <option value="">📥 Uncategorized</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
                <div className="row">
                  <button className="btn btn--sm btn--primary" onClick={() => store.openInEditor(m)}>
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn--sm"
                    disabled={busyId === m.id}
                    onClick={async () => {
                      setBusyId(m.id);
                      try {
                        await downloadBlob(await exportPNG(m), fileNameFor(m));
                      } catch (e) {
                        store.toast((e as Error).message, 'err');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    aria-label="Download PNG"
                  >
                    ⬇
                  </button>
                  <button className="btn btn--sm" aria-label="Delete" onClick={async () => (await ask.confirm(`Delete "${m.title}" forever?`, { ok: 'Delete', danger: true })) && store.deleteMeme(m.id).then(() => store.toast('Deleted. Travis lives to fight another day.'))}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
