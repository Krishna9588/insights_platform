import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { runPipeline, getProjects } from '@/api';
import type { Project } from '@/types/api';

function SlideToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className="slide-toggle" onClick={onToggle} style={{ display: 'inline-flex' }}>
      <div className={`slide-toggle-track${on ? ' on' : ''}`}>
        <div className="slide-toggle-thumb" />
      </div>
    </div>
  );
}

function ProjectResultCard({ project, onAskCopilot }: { project: Project; onAskCopilot: () => void }) {
  const status = (project as unknown as Record<string, unknown>)?.processing_status as Record<string, unknown> ?? {};
  return (
    <div className="list-item">
      <div>
        <div className="item-title">{project.project_name ?? (project as unknown as Record<string, string>).name}</div>
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
          {(project as unknown as Record<string, string>).updated_at && (
            <span>· {new Date((project as unknown as Record<string, string>).updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button compact secondary" onClick={() => {
          const { setSelectedProjectView, setActivePage } = useStore.getState();
          setSelectedProjectView(project.project_name ?? (project as unknown as Record<string, string>).name);
          setActivePage('projectview');
        }}>
          View Project
        </button>
        <button className="button compact" onClick={onAskCopilot}>
          Ask Copilot →
        </button>
      </div>
    </div>
  );
}

export default function DeepResearch() {
  const { projects, setProjects, upsertJob, showToast, pipelineDefaults, setChatProject } = useStore();

  // Form state — initialized from global defaults if enabled
  const [form, setForm] = useState({
    project_name: '',
    domain: '',
    provider: pipelineDefaults.enabled ? pipelineDefaults.provider : 'gemini',
    start_from: pipelineDefaults.enabled ? pipelineDefaults.start_from : 'agent1',
    only: pipelineDefaults.enabled ? pipelineDefaults.only : '',
  });

  const [sources, setSources] = useState({
    reddit: true, youtube: true, play_store: true, app_store: true, company: true, news: false,
  });

  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(!pipelineDefaults.enabled);
  const [lastJobProject, setLastJobProject] = useState<string | null>(null);

  // Keep form in sync when defaults toggle changes
  useEffect(() => {
    if (pipelineDefaults.enabled) {
      setForm((f) => ({
        ...f,
        provider: pipelineDefaults.provider,
        start_from: pipelineDefaults.start_from,
        only: pipelineDefaults.only,
      }));
      setShowAdvanced(false);
    }
  }, [pipelineDefaults.enabled, pipelineDefaults.provider, pipelineDefaults.start_from, pipelineDefaults.only]);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.project_name.trim()) { showToast('Project name is required'); return; }
    setLoading(true);
    try {
      const res = await runPipeline({
        project_name: form.project_name.trim(),
        provider: form.provider,
        domain: form.domain || undefined,
        start_from: form.start_from,
        only: form.only || undefined,
        agent1_payload: {
          project_name: form.project_name.trim(),
          sources: Object.entries(sources).filter(([, v]) => v).map(([k]) => k),
        },
      });
      upsertJob({ id: res.job_id, project_name: form.project_name, status: 'queued' });
      setLastJobProject(form.project_name.trim());
      showToast(`Pipeline started — Job ${res.job_id.slice(0, 8)}`);
      // Refresh projects list
      getProjects().then((r) => setProjects(r.projects)).catch(() => { });
    } catch {
      showToast('Failed to start pipeline — check backend logs');
    } finally {
      setLoading(false);
    }
  };

  // Get project data for the last launched project
  const lastProject = projects.find(
    (p) => (p as unknown as Record<string, string>).project_name === lastJobProject ||
      (p as unknown as Record<string, string>).name === lastJobProject
  );

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Data</p>
          <h1>Deep Research</h1>
        </div>
        {pipelineDefaults.enabled && (
          <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
            ⚡ Using defaults from Configurations
          </div>
        )}
      </header>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'start' }}>
        {/* LEFT — Project form */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Pipeline Configuration</h3>
          <div className="form">
            <label>
              Project Name
              <input
                value={form.project_name}
                onChange={set('project_name')}
                placeholder="e.g. Zerodha, Groww, INDmoney"
                list="project-list"
              />
              <datalist id="project-list">
                {projects.map((p) => (
                  <option
                    key={(p as unknown as Record<string, string>).project_name || (p as unknown as Record<string, string>).name}
                    value={(p as unknown as Record<string, string>).project_name || (p as unknown as Record<string, string>).name}
                  />
                ))}
              </datalist>
            </label>

            <label>
              Domain / Focus Area <span className="muted">(optional)</span>
              <input
                value={form.domain}
                onChange={set('domain')}
                placeholder="e.g. wealthtech, mutual funds, stock trading"
              />
            </label>

            {/* Advanced settings toggle */}
            <div>
              <button
                type="button"
                className={`settings-toggle-btn${showAdvanced ? ' open' : ''}`}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span className="chevron">▼</span>
                Advanced Settings
                {pipelineDefaults.enabled && (
                  <span style={{ color: 'var(--accent-blue)', fontSize: 12, marginLeft: 4 }}>
                    (using config defaults)
                  </span>
                )}
              </button>

              {showAdvanced && (
                <div className="settings-panel">
                  <div className="form-grid">
                    <label>
                      Start From
                      <select value={form.start_from} onChange={set('start_from')}>
                        <option value="agent1">Agent 1 — Scrape</option>
                        <option value="agent2">Agent 2 — Insights</option>
                        <option value="agent3">Agent 3 — Synthesis</option>
                        <option value="agent4">Agent 4 — Brief</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Run Only One Agent <span className="muted">(overrides Start From)</span>
                    <select value={form.only} onChange={set('only')}>
                      <option value="">Run full pipeline</option>
                      <option value="agent1">Agent 1 only</option>
                      <option value="agent2">Agent 2 only</option>
                      <option value="agent3">Agent 3 only</option>
                      <option value="agent4">Agent 4 only</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Data sources + pipeline visual */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14 }}>Data Sources</h3>
            <div className="list" style={{ gap: 8 }}>
              {(Object.entries(sources) as [keyof typeof sources, boolean][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                  <label className="check-row" style={{ cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={v}
                      onChange={(e) => setSources((s) => ({ ...s, [k]: e.target.checked }))}
                    />
                    <span style={{ textTransform: 'capitalize', color: 'var(--body)', fontWeight: 500 }}>
                      {k.replace(/_/g, ' ')}
                    </span>
                  </label>
                  {v && ['reddit', 'youtube', 'play_store', 'app_store'].includes(k) && (
                    <div style={{ marginLeft: 28 }}>
                      <input 
                        value={(form as any)[k] || ''} 
                        onChange={set(k)} 
                        placeholder={
                          k === 'reddit' ? 'e.g. r/IndiaInvestments' :
                          k === 'youtube' ? 'e.g. Groww review' :
                          k === 'play_store' ? 'e.g. com.groww.app' :
                          'e.g. Groww App'
                        }
                        style={{ fontSize: 13, padding: '6px 10px' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline visual */}
          <div className="soft-band">
            <p className="muted" style={{ fontWeight: 600, marginBottom: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pipeline Flow
            </p>
            {['Scrape & Orchestrate', 'Insight Extraction', 'Synthesis', 'Product Brief'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--accent-blue)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: 'var(--body)' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Launch button */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="button" onClick={submit} disabled={loading}>
          {loading
            ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Starting…</>
            : '🚀 Launch Pipeline'}
        </button>
      </div>

      {/* ── Results Panel ── */}
      {lastJobProject && (
        <div className="result-panel">
          <div className="result-panel-header">
            <div>
              <h3>Research Started</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                Project <strong style={{ color: 'var(--ink)' }}>{lastJobProject}</strong> is queued.
                Results will appear here when complete.
              </p>
            </div>
            <button
              className="button compact"
              onClick={() => {
                setChatProject(lastJobProject);
                showToast(`Copilot set to: ${lastJobProject}`);
              }}
            >
              Ask Copilot →
            </button>
          </div>
          {lastProject && (
            <div className="result-list">
              <ProjectResultCard
                project={lastProject}
                onAskCopilot={() => {
                  setChatProject(lastJobProject!);
                  showToast(`Copilot set to: ${lastJobProject}`);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Past projects list */}
      {projects.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="section-head">
            <h2>Previous Projects</h2>
            <button
              className="button secondary compact"
              onClick={() => getProjects().then((r) => setProjects(r.projects)).catch(() => { })}
            >
              Refresh
            </button>
          </div>
          <div className="list">
            {projects.map((p) => {
              const pName = (p as unknown as Record<string, string>).project_name || (p as unknown as Record<string, string>).name;
              return (
                <ProjectResultCard
                  key={pName}
                  project={p}
                  onAskCopilot={() => {
                    setChatProject(pName);
                    showToast(`Copilot set to: ${pName}`);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
