import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getNewsMonitors, createNewsMonitor, deleteNewsMonitor } from '@/api';
import type { NewsMonitor } from '@/types/api';
import BackButton from '@/components/layout/BackButton';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

const SOURCE_OPTIONS = ['news', 'sebi', 'rbi', 'reddit', 'youtube'];

export default function NewsSebi() {
  const { monitors, setMonitors, showToast, setActivePage, setSelectedProjectView } = useStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', query: '', schedule_time: '20:00', timezone: 'Asia/Kolkata', enabled: true,
  });
  const [selectedSources, setSelectedSources] = useState(['news', 'sebi']);
  const [deleteTarget, setDeleteTarget] = useState<NewsMonitor | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await getNewsMonitors(); setMonitors(r.monitors); }
    catch { showToast('Failed to load monitors'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleSource = (s: string) =>
    setSelectedSources((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const submit = async () => {
    if (!form.name || !form.query) { showToast('Fill in name and query'); return; }
    try {
      const m = await createNewsMonitor({ ...form, sources: selectedSources } as Omit<NewsMonitor, 'id'>);
      setMonitors([...monitors, m]);
      showToast('Monitor created');
      setForm({ name: '', query: '', schedule_time: '20:00', timezone: 'Asia/Kolkata', enabled: true });
    } catch { showToast('Failed to create monitor'); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
    {deleteTarget && (
      <DeleteConfirmModal
        projectName={deleteTarget.name}
        onConfirm={async () => {
          setDeleteLoading(true);
          try {
            await deleteNewsMonitor(deleteTarget.id);
            setMonitors(monitors.filter(x => x.id !== deleteTarget.id));
            showToast('Monitor deleted', 2000);
            setDeleteTarget(null);
          } catch (err) {
            showToast('Failed to delete monitor', 3000);
          } finally {
            setDeleteLoading(false);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    )}
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>News & Trends</h1></div>
        <div className="actions">
          <button className="button secondary" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </header>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'start' }}>
        {/* Active monitors */}
        <div>
          <div className="section-head"><h2>Active Monitors</h2></div>
          {monitors.length === 0
            ? <div className="card" style={{ padding: 24, textAlign: 'center' }}><p className="muted">No monitors yet.</p></div>
            : <div className="list">
              {monitors.map((m) => (
                <div 
                  className="list-item" 
                  key={m.id} 
                  style={{ cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }}
                  onClick={() => {
                    setSelectedProjectView(`Monitor: ${m.name}`);
                    setActivePage('projectview');
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <div className="item-title">{m.name}</div>
                      <div className="status-line">
                        <div className={`dot ${m.enabled ? 'ok' : 'warn'}`} />
                        <span>{m.enabled ? 'Active' : 'Paused'}</span>
                        <span>· {m.schedule_time} {m.timezone}</span>
                        <span>· {m.sources.join(', ')}</span>
                      </div>
                      <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{m.query}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(m);
                      }}
                      style={{
                        position: 'absolute', top: 12, right: 12,
                        background: 'none', border: '1px solid var(--hairline)', cursor: 'pointer',
                        padding: '6px', borderRadius: 6,
                        color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', zIndex: 2,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.borderColor = '#ef4444';
                        e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--muted)';
                        e.currentTarget.style.borderColor = 'var(--hairline)';
                        e.currentTarget.style.background = 'none';
                      }}
                      title="Delete Monitor"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        {/* Create new monitor */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>New Monitor</h3>
          <div className="form">
            <label>Monitor Name<input value={form.name} onChange={set('name')} placeholder="e.g. SEBI Wealthtech Watch" /></label>
            <label>
              Research Query
              <textarea value={form.query} onChange={set('query')} rows={3}
                placeholder="e.g. Track SEBI and RBI fintech updates for Indian wealthtech apps." />
            </label>
            <div>
              <label style={{ marginBottom: 8 }}>Sources</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SOURCE_OPTIONS.map((s) => (
                  <button key={s} type="button"
                    className={`tab${selectedSources.includes(s) ? ' active' : ''}`}
                    onClick={() => toggleSource(s)}
                    style={{ minHeight: 32, fontSize: 13 }}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-grid">
              <label>Schedule Time<input type="time" value={form.schedule_time} onChange={set('schedule_time')} /></label>
              <label>Timezone<select value={form.timezone} onChange={set('timezone')}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">US Eastern</option>
              </select></label>
            </div>
            <button className="button" onClick={submit}>Create Monitor</button>
          </div>
        </div>
      </div>
    </div>
    <BackButton fallback="dashboard" />
    </>
  );
}
