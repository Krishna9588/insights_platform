import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getNewsMonitors, createNewsMonitor } from '@/api';
import type { NewsMonitor } from '@/types/api';

const SOURCE_OPTIONS = ['news', 'sebi', 'rbi', 'reddit', 'youtube'];

export default function NewsSebi() {
  const { monitors, setMonitors, showToast } = useStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', query: '', schedule_time: '20:00', timezone: 'Asia/Kolkata', enabled: true,
  });
  const [selectedSources, setSelectedSources] = useState(['news', 'sebi']);

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
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>News & SEBI</h1></div>
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
                <div className="list-item" key={m.id}>
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
  );
}
