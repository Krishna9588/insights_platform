// Fully wired stub pages — results panels + copilot integration
import { useState } from 'react';
import { useStore } from '@/store';
import { runPipeline, getProjects } from '@/api';
import type { Project } from '@/types/api';
import BackButton from '@/components/layout/BackButton';
import { ProjectLogo } from '@/components/ProjectLogo';

const indeterminateAnimation = `
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
`;

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
  const name = String(p.project_name || p.name || '');
  return (
    <div className="list-item">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ProjectLogo name={name} domain={p.domain as string} size={32} />
        <div>
          <div className="item-title">{name}</div>
          <div className="status-line">
            {String(p.updated_at || '') && (
              <span>Last updated: {new Date(String(p.updated_at)).toLocaleString()}</span>
            )}
          </div>
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
        agent1_payload: {
          project_name: form.project_name.trim(),
          skip_company_profile: false,
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pipelineDefaults.enabled && (
            <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
              ⚡ Using defaults from Configurations
            </div>
          )}
          <button className="button" onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Scraping…</> : 'Scrape Profile'}
          </button>
        </div>
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
                placeholder="e.g. flipkart.com" />
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

      {lastProject && (
        <div className="result-panel" style={{ position: 'relative', overflow: 'hidden' }}>
          <style>{indeterminateAnimation}</style>
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--hairline)' }}>
            <div style={{ width: '40%', height: '100%', background: 'var(--accent-blue)', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      )}

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
      <BackButton fallback="collection" />
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

  /**
   * Build proper agent1 payload for each source.
   * Reddit/YouTube go as structured arrays that agent1_orchestrator understands.
   * App/Play store go as {link_or_id: ...} objects.
   */
  const submit = async () => {
    // Collect all inputs
    const inputs = [
      { name: 'reddit', value: form.reddit.trim() },
      { name: 'youtube', value: form.youtube.trim() },
      { name: 'app_store', value: form.app_store.trim() },
      { name: 'play_store', value: form.play_store.trim() }
    ].filter(i => i.value !== '');

    if (inputs.length === 0) {
      showToast('Please provide at least one input to scrape.');
      return;
    }

    // Auto-generate project name if not provided
    let projName = form.project_name.trim();
    if (!projName) {
      // Use the first available input as the project name
      projName = inputs[0].value.substring(0, 30);
      setForm(f => ({ ...f, project_name: projName }));
    }

    setLoading(true);
    try {
      // Build the correct payload structure for agent1_orchestrator
      let agent1_payload: Record<string, unknown> = {
        project_name: projName,
        skip_company_profile: true,  // Don't run company profile when scraping social
      };

      if (form.reddit.trim()) {
        const input = form.reddit.trim();
        agent1_payload.reddit = [{ input, mode: 'auto', limit: 25 }];
      }
      if (form.youtube.trim()) {
        agent1_payload.youtube = [{ mode: 'search', query: form.youtube.trim(), count: 10 }];
      }
      if (form.app_store.trim()) {
        agent1_payload.app_store = { link_or_id: form.app_store.trim(), reviews_count: 100 };
      }
      if (form.play_store.trim()) {
        agent1_payload.play_store = { link_or_id: form.play_store.trim(), reviews_count: 100 };
      }

      const res = await runPipeline({
        project_name: projName,
        provider,
        only: 'agent1',
        agent1_payload,
      });
      upsertJob({ id: res.job_id, project_name: projName, status: 'queued' });
      setLastProject(projName);
      getProjects().then((r) => setProjects(r.projects)).catch(() => { });
      showToast(`Social scrape started for ${projName}`);
    } catch { showToast('Failed to start scrape'); }
    finally { setLoading(false); }
  };

  const foundProject = projects.find(
    (p) => (p as unknown as Record<string, string>).project_name === lastProject ||
      (p as unknown as Record<string, string>).name === lastProject
  );

  const LOGO_TOKEN = 'pk_Tw38O-4_RNinmXOwNIgagQ';

  return (
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>Social Media & Stores</h1></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pipelineDefaults.enabled && (
            <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
              ⚡ Using defaults from Configurations
            </div>
          )}
          <button className="button" onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Starting…</> : 'Start Scraping'}
          </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form">
          <label>
            Target Project / Company Name <span className="muted">(optional, will auto-generate if empty)</span>
            <input value={form.project_name} onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
              placeholder="e.g. Groww" />
          </label>
        </div>
      </div>

      <div className="soft-band" style={{ marginBottom: 20, fontSize: 13 }}>
        💡 <strong>Note:</strong> Social media scrapers run without AI — they use direct scraping scripts (Reddit API, YouTube scraper, etc.). No Gemini is involved.
      </div>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'stretch' }}>

        {/* Reddit */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={`https://img.logo.dev/reddit.com?token=${LOGO_TOKEN}&size=32`}
              alt="Reddit"
              style={{ width: 32, height: 32, borderRadius: 6 }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h3 style={{ margin: 0 }}>Reddit</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>Subreddit, User, Post URL, or Keywords
              <input value={form.reddit} onChange={(e) => setForm((f) => ({ ...f, reddit: e.target.value }))}
                placeholder="e.g. r/IndiaInvestments or Groww review" />
              <div className="input-helper">
                Enter any URL, subreddit (r/stocks), user (u/username), or search phrase. It will be auto-detected!
              </div>
            </label>
          </div>
        </div>

        {/* YouTube */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={`https://img.logo.dev/youtube.com?token=${LOGO_TOKEN}&size=32`}
              alt="YouTube"
              style={{ width: 32, height: 32, borderRadius: 6 }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h3 style={{ margin: 0 }}>YouTube</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>Search Query
              <input value={form.youtube} onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))}
                placeholder="e.g. Groww review 2024" />
            </label>
          </div>
        </div>

        {/* App Store */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={`https://img.logo.dev/apple.com?token=${LOGO_TOKEN}&size=32`}
              alt="App Store"
              style={{ width: 32, height: 32, borderRadius: 6 }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h3 style={{ margin: 0 }}>App Store</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>App Name or App Store ID
              <input value={form.app_store} onChange={(e) => setForm((f) => ({ ...f, app_store: e.target.value }))}
                placeholder="e.g. Groww App or 1267100789" />
            </label>
          </div>
        </div>

        {/* Play Store */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={`https://img.logo.dev/play.google.com?token=${LOGO_TOKEN}&size=32`}
              alt="Play Store"
              style={{ width: 32, height: 32, borderRadius: 6 }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h3 style={{ margin: 0 }}>Play Store</h3>
          </div>
          <div className="form" style={{ flex: 1 }}>
            <label>App Name, URL, or Package ID
              <input value={form.play_store} onChange={(e) => setForm((f) => ({ ...f, play_store: e.target.value }))}
                placeholder="e.g. Groww App or com.groww.app or URL" />
              <div className="input-helper">
                Enter a full Play Store URL, package ID, or just the app's name to search for it automatically.
              </div>
            </label>
          </div>
        </div>
      </div>

      {lastProject && (
        <div className="result-panel" style={{ marginTop: 24, position: 'relative', overflow: 'hidden' }}>
          <style>{indeterminateAnimation}</style>
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--hairline)' }}>
            <div style={{ width: '40%', height: '100%', background: 'var(--accent-blue)', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
          </div>
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
      <BackButton fallback="collection" />
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

  const LOGO_TOKEN = 'pk_Tw38O-4_RNinmXOwNIgagQ';

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
            const domain = String(pp.domain || '');
            const status = (pp.processing_status as Record<string, boolean>) ?? {};

            // Build logo URL from domain
            let logoSrc: string | null = null;
            if (domain) {
              try {
                const hostname = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname;
                logoSrc = `https://img.logo.dev/${hostname}?token=${LOGO_TOKEN}&size=32`;
              } catch { /* ignore */ }
            }

            return (
              <div 
                className="list-item clickable" 
                key={name}
                onClick={() => {
                  const { setSelectedProjectView, setActivePage } = useStore.getState();
                  setSelectedProjectView(name);
                  setActivePage('projectview');
                }}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {/* Logo */}
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={name}
                      style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'contain' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      display: logoSrc ? 'none' : 'flex',
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'var(--accent-blue)',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 14,
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div className="item-title">{name}</div>
                    <div className="status-line">
                      {domain && <span>· {domain}</span>}
                      {String(pp.updated_at || '') && (
                        <span>· {new Date(String(pp.updated_at)).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="button compact"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-green) 100%)', 
                      color: 'white', border: 'none' 
                    }}
                    onClick={(e) => { 
                      e.stopPropagation();
                      setChatProject(name); 
                      showToast(`Copilot → ${name}`); 
                    }}
                  >
                    Ask Copilot ✨
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <BackButton fallback="dashboard" />
    </div>
  );
}
