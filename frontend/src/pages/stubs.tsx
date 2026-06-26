// Fully wired stub pages — results panels + copilot integration
import { useState } from 'react';
import { useStore } from '@/store';
import { runPipeline, getProjects } from '@/api';
import type { Project } from '@/types/api';

// ── Shared result card ──────────────────────────────────────
function ProjectResultCard({
  project,
  onAskCopilot,
}: {
  project: Project;
  onAskCopilot: () => void;
}) {
  const p = project as unknown as Record<string, unknown>;
  const status = (p?.processing_status as Record<string, boolean>) ?? {};
  return (
    <div className="list-item">
      <div>
        <div className="item-title">{String(p.project_name || p.name || '')}</div>
        <div className="status-line">
          {Object.entries(status).map(([agent, done]) => (
            <span key={agent} style={{
              background: done ? 'var(--sage)' : 'var(--surface-strong)',
              color: done ? 'var(--success)' : 'var(--muted)',
              borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600,
              border: done ? '1px solid rgba(21,128,61,0.2)' : '1px solid var(--hairline)',
            }}>
              {String(agent).replace('_', ' ')} {done ? '✓' : '…'}
            </span>
          ))}
          {String(p.updated_at || '') && (
            <span>· {new Date(String(p.updated_at)).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button compact secondary" onClick={() => {
          const { setSelectedProjectView, setActivePage } = useStore.getState();
          setSelectedProjectView(String(p.project_name || p.name || ''));
          setActivePage('projectview');
        }}>
          View Project
        </button>
        <button className="button compact" onClick={onAskCopilot}>Ask Copilot →</button>
      </div>
    </div>
  );
}

// ── Company Profile ─────────────────────────────────────────
export function CompanyProfile() {
  const { projects, setProjects, pipelineDefaults, setChatProject, upsertJob, showToast } = useStore();
  const [form, setForm] = useState({ project_name: '', domain: '' });
  const [loading, setLoading] = useState(false);
  const [lastProject, setLastProject] = useState<string | null>(null);
  const [showAdv, setShowAdv] = useState(!pipelineDefaults.enabled);
  const [provider, setProvider] = useState(pipelineDefaults.enabled ? pipelineDefaults.provider : 'gemini');

  const submit = async () => {
    if (!form.project_name.trim()) { showToast('Project name is required'); return; }
    setLoading(true);
    try {
      const res = await runPipeline({
        project_name: form.project_name.trim(),
        provider,
        domain: form.domain || undefined,
        only: 'agent1',
        agent1_payload: {
          project_name: form.project_name.trim(),
          sources: ['company'],
        },
      });
      upsertJob({ id: res.job_id, project_name: form.project_name, status: 'queued' });
      setLastProject(form.project_name.trim());
      getProjects().then((r) => setProjects(r.projects)).catch(() => { });
      showToast('Company scrape started');
    } catch { showToast('Failed to start'); }
    finally { setLoading(false); }
  };

  const foundProject = projects.find(
    (p) => (p as unknown as Record<string, string>).project_name === lastProject ||
      (p as unknown as Record<string, string>).name === lastProject
  );

  return (
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>Company Profile</h1></div>
        {pipelineDefaults.enabled && (
          <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
            ⚡ Using defaults from Configurations
          </div>
        )}
      </header>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Scrape Company Profile</h3>
          <div className="form">
            <label>
              Project / Company Name
              <input value={form.project_name} onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
                placeholder="e.g. Zerodha, INDmoney" />
            </label>
            <label>
              Domain / Focus <span className="muted">(optional)</span>
              <input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                placeholder="e.g. wealthtech" />
            </label>
            <button
              type="button"
              className={`settings-toggle-btn${showAdv ? ' open' : ''}`}
              onClick={() => setShowAdv((v) => !v)}
            >
              <span className="chevron">▼</span>
              Advanced Settings
            </button>
            {showAdv && (
              <div className="settings-panel">
                <p className="muted" style={{ fontSize: 13 }}>Additional settings can be managed in Configurations.</p>
              </div>
            )}
            <button className="button" onClick={submit} disabled={loading}>
              {loading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Scraping…</> : 'Scrape Profile'}
            </button>
          </div>
        </div>

        <div className="soft-band">
          <p className="muted" style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            What gets scraped
          </p>
          {['Company website homepage', 'About / Team page', 'Play Store listing & reviews', 'App Store listing & reviews', 'Press releases & news'].map((s) => (
            <div key={s} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <div className="dot ok" />
              <span style={{ fontSize: 13, color: 'var(--body)' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Result panel */}
      {lastProject && (
        <div className="result-panel">
          <div className="result-panel-header">
            <div>
              <h3>Scrape Started</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                <strong style={{ color: 'var(--ink)' }}>{lastProject}</strong> — company profile scrape queued.
              </p>
            </div>
            <button className="button compact" onClick={() => { setChatProject(lastProject); showToast(`Copilot → ${lastProject}`); }}>
              Ask Copilot →
            </button>
          </div>
          {foundProject && (
            <div className="result-list">
              <ProjectResultCard project={foundProject} onAskCopilot={() => { setChatProject(lastProject!); showToast(`Copilot → ${lastProject}`); }} />
            </div>
          )}
        </div>
      )}

      {/* Past projects */}
      {projects.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="section-head"><h2>Previous Scrapes</h2></div>
          <div className="list">
            {projects.map((p) => {
              const n = (p as unknown as Record<string, string>).project_name || (p as unknown as Record<string, string>).name;
              return <ProjectResultCard key={n} project={p} onAskCopilot={() => { setChatProject(n); showToast(`Copilot → ${n}`); }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Social Media ────────────────────────────────────────────
export function SocialMedia() {
  const { projects, setProjects, pipelineDefaults, setChatProject, upsertJob, showToast } = useStore();
  const [form, setForm] = useState({ 
    project_name: '', 
    reddit: '', 
    youtube: '', 
    app_store: '', 
    play_store: '' 
  });
  const [loading, setLoading] = useState(false);
  const [lastProject, setLastProject] = useState<string | null>(null);

  const provider = pipelineDefaults.enabled ? pipelineDefaults.provider : 'gemini';

  const submit = async (source: 'reddit' | 'youtube' | 'app_store' | 'play_store') => {
    if (!form.project_name.trim()) { showToast('Project name is required'); return; }
    if (!form[source].trim()) { showToast(`Please provide input for ${source.replace('_', ' ')}`); return; }
    
    setLoading(true);
    try {
      const res = await runPipeline({
        project_name: form.project_name.trim(),
        provider,
        only: 'agent1',
        agent1_payload: {
          project_name: form.project_name.trim(),
          sources: [source],
          search_query: form[source].trim(),
        },
      });
      upsertJob({ id: res.job_id, project_name: form.project_name, status: 'queued' });
      setLastProject(form.project_name.trim());
      getProjects().then((r) => setProjects(r.projects)).catch(() => { });
      showToast(`${source.replace('_', ' ')} scrape started`);
    } catch { showToast('Failed to start scrape'); }
    finally { setLoading(false); }
  };

  const foundProject = projects.find(
    (p) => (p as unknown as Record<string, string>).project_name === lastProject ||
      (p as unknown as Record<string, string>).name === lastProject
  );

  return (
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>Social Media & Stores</h1></div>
        {pipelineDefaults.enabled && (
          <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
            ⚡ Using defaults from Configurations
          </div>
        )}
      </header>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form">
          <label>
            Target Project / Company Name
            <input value={form.project_name} onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
              placeholder="e.g. Groww" />
          </label>
        </div>
      </div>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'stretch' }}>
        
        {/* Reddit */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="http://localhost:8000/logo?domain=reddit.com" alt="Reddit" style={{ width: 32, height: 32, borderRadius: 6, background: '#fff' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <h3 style={{ margin: 0 }}>Reddit</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>Subreddit / Keywords
              <input value={form.reddit} onChange={(e) => setForm((f) => ({ ...f, reddit: e.target.value }))} placeholder="e.g. r/IndiaInvestments, Groww review" />
            </label>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button secondary" onClick={() => submit('reddit')} disabled={loading}>
                Scrape Reddit
              </button>
            </div>
          </div>
        </div>

        {/* YouTube */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="http://localhost:8000/logo?domain=youtube.com" alt="YouTube" style={{ width: 32, height: 32, borderRadius: 6, background: '#fff' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <h3 style={{ margin: 0 }}>YouTube</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>Search Query
              <input value={form.youtube} onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))} placeholder="e.g. Groww review 2024" />
            </label>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button secondary" onClick={() => submit('youtube')} disabled={loading}>
                Scrape YouTube
              </button>
            </div>
          </div>
        </div>

        {/* App Store */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="http://localhost:8000/logo?domain=apple.com" alt="App Store" style={{ width: 32, height: 32, borderRadius: 6, background: '#fff' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <h3 style={{ margin: 0 }}>App Store</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>App Name / URL
              <input value={form.app_store} onChange={(e) => setForm((f) => ({ ...f, app_store: e.target.value }))} placeholder="e.g. Groww App" />
            </label>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button secondary" onClick={() => submit('app_store')} disabled={loading}>
                Scrape App Store
              </button>
            </div>
          </div>
        </div>

        {/* Play Store */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img src="http://localhost:8000/logo?domain=play.google.com" alt="Play Store" style={{ width: 32, height: 32, borderRadius: 6, background: '#fff' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
            <h3 style={{ margin: 0 }}>Play Store</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>App ID / URL
              <input value={form.play_store} onChange={(e) => setForm((f) => ({ ...f, play_store: e.target.value }))} placeholder="e.g. com.groww.app" />
            </label>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button secondary" onClick={() => submit('play_store')} disabled={loading}>
                Scrape Play Store
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Result panel */}
      {lastProject && (
        <div className="result-panel" style={{ marginTop: 24 }}>
          <div className="result-panel-header">
            <div>
              <h3>Scrape Started</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                <strong style={{ color: 'var(--ink)' }}>{lastProject}</strong> scrape queued.
              </p>
            </div>
          </div>
          {foundProject && (
            <div className="result-list">
              <ProjectResultCard project={foundProject} onAskCopilot={() => { setChatProject(lastProject!); }} />
            </div>
          )}
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="section-head"><h2>Previous Projects</h2></div>
          <div className="list">
            {projects.map((p) => {
              const n = (p as unknown as Record<string, string>).project_name || (p as unknown as Record<string, string>).name;
              return <ProjectResultCard key={n} project={p} onAskCopilot={() => setChatProject(n)} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Storage ─────────────────────────────────────────────────
export function Storage() {
  const { projects, setProjects, setChatProject, showToast } = useStore();
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getProjects().then((r) => { setProjects(r.projects); setLoading(false); }).catch(() => setLoading(false));
  };

  return (
    <div>
      <header className="topbar">
        <div><p className="eyebrow">System</p><h1>Storage</h1></div>
        <div className="actions">
          <button className="button secondary" onClick={load} disabled={loading}>
            {loading ? <span className="spinner dark" /> : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="section-head">
        <h2>All Projects ({projects.length})</h2>
      </div>

      {projects.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p className="muted">No project data stored yet. Run a research pipeline first.</p>
        </div>
      ) : (
        <div className="list">
          {projects.map((p) => {
            const pp = p as unknown as Record<string, unknown>;
            const name = String(pp.project_name || pp.name || '');
            const status = (pp.processing_status as Record<string, boolean>) ?? {};
            return (
              <div className="list-item" key={name}>
                <div>
                  <div className="item-title">{name}</div>
                  <div className="status-line">
                    {Object.entries(status).map(([agent, done]) => (
                      <span key={agent} style={{
                        background: done ? 'var(--sage)' : 'var(--surface-strong)',
                        color: done ? 'var(--success)' : 'var(--muted)',
                        borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                        border: done ? '1px solid rgba(21,128,61,0.2)' : '1px solid var(--hairline)',
                      }}>
                        {String(agent).replace('_', ' ')} {done ? '✓' : '–'}
                      </span>
                    ))}
                    {String(pp.domain || '') && <span>· {String(pp.domain)}</span>}
                    {String(pp.updated_at || '') && (
                      <span>· {new Date(String(pp.updated_at)).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="button secondary compact"
                    onClick={() => { setChatProject(name); showToast(`Copilot → ${name}`); }}
                  >
                    Ask Copilot
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
