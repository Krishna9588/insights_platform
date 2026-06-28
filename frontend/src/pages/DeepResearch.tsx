import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { runPipeline, getProjects, fetchGoogleDriveFiles } from '@/api';
import type { Project } from '@/types/api';
import BackButton from '@/components/layout/BackButton';
import { ProjectLogo } from '@/components/ProjectLogo';

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
  const name = project.project_name ?? (project as unknown as Record<string, string>).name;
  return (
    <div className="list-item">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ProjectLogo name={name} domain={project.domain} size={32} />
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
                {String(agent).replace('_', ' ')} {done ? '✓' : '…'}
              </span>
            ))}
            {(project as unknown as Record<string, string>).updated_at && (
              <span>· {new Date((project as unknown as Record<string, string>).updated_at).toLocaleString()}</span>
            )}
          </div>
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
        <button 
          className="button compact" 
          style={{ 
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-green) 100%)', 
            color: 'white', border: 'none' 
          }}
          onClick={onAskCopilot}
        >
          Ask Copilot <img src="/send.png" alt="Send" style={{ width: 14, height: 14, marginLeft: 6 }} />
        </button>
      </div>
    </div>
  );
}

export default function DeepResearch() {
  const { projects, setProjects, upsertJob, showToast, pipelineDefaults, setChatProject } = useStore();

  // Form state
  const [form, setForm] = useState({
    project_name: '',
    provider: 'gemini',
    domain: '',
    reddit: '',
    youtube: '',
    play_store: '',
    app_store: '',
    transcripts: '',
    news: '',
  });

  const [loading, setLoading] = useState(false);
  const [lastJobProject, setLastJobProject] = useState<string | null>(null);

  // Drive state
  const [fetchingDrive, setFetchingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<Set<string>>(new Set());

  const handleFetchDrive = async () => {
    if (!form.transcripts.trim()) {
      showToast('Please enter a Google Drive ID or URL');
      return;
    }
    setFetchingDrive(true);
    try {
      const res = await fetchGoogleDriveFiles(form.transcripts);
      setDriveFiles(res.files || []);
      setSelectedDriveFiles(new Set((res.files || []).map((f: any) => f.id)));
      showToast('Fetched Google Drive files');
    } catch {
      showToast('Failed to fetch Google Drive files');
    } finally {
      setFetchingDrive(false);
    }
  };

  const toggleDriveFile = (id: string) => {
    const next = new Set(selectedDriveFiles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDriveFiles(next);
  };

  // Keep form in sync when defaults toggle changes
  useEffect(() => {
    if (pipelineDefaults.enabled) {
      setForm((f) => ({
        ...f,
        provider: pipelineDefaults.provider || 'gemini',
      }));
    }
  }, [pipelineDefaults.enabled, pipelineDefaults.provider]);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.project_name.trim()) { showToast('Project name is required'); return; }
    setLoading(true);
    try {
      const payload: Record<string, any> = {};
      
      // Implicitly add source if input is not empty
      if (form.reddit.trim()) {
        payload.reddit = [{ input: form.reddit.trim(), mode: 'auto', limit: 25 }];
      }
      if (form.youtube.trim()) {
        payload.youtube = [{ mode: 'search', query: form.youtube.trim(), count: 10 }];
      }
      if (form.play_store.trim()) {
        payload.play_store = { link_or_id: form.play_store.trim(), reviews_count: 100 };
      }
      if (form.app_store.trim()) {
        payload.app_store = { link_or_id: form.app_store.trim(), reviews_count: 100 };
      }
      if (form.transcripts.trim()) {
        payload.transcripts = { input_path: form.transcripts.trim() };
      }
      if (form.news.trim()) {
        payload.news = [{ query: form.news.trim() }];
      }

      if (driveFiles.length > 0 && selectedDriveFiles.size > 0) {
        payload.transcripts = {
          input_path: "combined",
          drive_metadata: driveFiles.filter(f => selectedDriveFiles.has(f.id))
        };
      }

      const { job_id } = await runPipeline({
        project_name: form.project_name.trim(),
        provider: form.provider,
        domain: form.domain.trim() || undefined,
        agent1_payload: Object.keys(payload).length > 0 ? payload : undefined,
      });
      upsertJob({ id: job_id, project_name: form.project_name, status: 'queued' });
      setLastJobProject(form.project_name.trim());
      showToast(`Pipeline started — Job ${job_id.slice(0, 8)}`);
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pipelineDefaults.enabled && (
            <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
              ⚡ Using defaults from Configurations
            </div>
          )}
          <button className="button" onClick={submit} disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Starting…</>
              : '🚀 Launch Pipeline'}
          </button>
        </div>
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
          </div>

          {/* Pipeline visual (Moved to Left) */}
          <div className="soft-band" style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontWeight: 600, marginBottom: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pipeline Flow
            </p>
            {['Scrape & Orchestrate', 'Insight Extraction', 'Synthesis', 'Product Brief'].map((step, i) => {
              // Determine if this step is active or completed
              const isRunning = lastProject && (lastProject as any).processing_status && Object.values((lastProject as any).processing_status).some(v => v === true);
              const isComplete = lastProject && (lastProject as any)[`agent${i + 2}_done`];
              const isPrevComplete = i === 0 || (lastProject && (lastProject as any)[`agent${i + 1}_done`]);
              
              let bgColor = 'var(--surface-strong)';
              let color = 'var(--body)';
              let pulse = false;

              if (isComplete) {
                bgColor = 'var(--accent-blue)';
                color = '#fff';
              } else if (isRunning && isPrevComplete) {
                bgColor = 'var(--accent-green)';
                color = '#fff';
                pulse = true;
              } else if (i === 0 && loading) {
                bgColor = 'var(--accent-green)';
                color = '#fff';
                pulse = true;
              }

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, opacity: isComplete || (isRunning && isPrevComplete) || (i===0 && loading) ? 1 : 0.6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: bgColor, color,
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    transition: 'all 0.3s',
                    boxShadow: pulse ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none',
                    animation: pulse ? 'pulse 2s infinite' : 'none'
                  }}>
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: color === '#fff' ? 'var(--ink)' : 'var(--body)', fontWeight: color === '#fff' ? 600 : 400 }}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Data sources */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 14 }}>Data Sources</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Fill in the inputs for the sources you want to include. Empty inputs will be ignored.
              </p>
              
              {['reddit', 'youtube', 'play_store', 'app_store', 'transcripts', 'news'].map((k) => (
                <div key={k} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, textTransform: 'capitalize', color: 'var(--body)', fontWeight: 500 }}>
                    {k.replace(/_/g, ' ')}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      value={form[k as keyof typeof form] || ''} 
                      onChange={set(k)} 
                      placeholder={
                        k === 'reddit' ? 'e.g. url, r/subreddit, u/user, or keyword' :
                        k === 'youtube' ? 'e.g. Groww review 2024' :
                        k === 'play_store' ? 'e.g. url, app name, or com.groww.app' :
                        k === 'transcripts' ? 'e.g. /path/to/transcript.docx or Drive URL' :
                        k === 'news' ? 'e.g. Groww recent news or topic' :
                        'e.g. Groww App'
                      }
                      style={{ fontSize: 13, padding: '8px 12px', flex: 1 }}
                    />
                    {k === 'transcripts' && form.transcripts.includes('drive') && (
                      <button className="button secondary compact" onClick={handleFetchDrive} disabled={fetchingDrive} type="button" style={{ whiteSpace: 'nowrap' }}>
                        {fetchingDrive ? 'Fetching...' : 'Fetch Files'}
                      </button>
                    )}
                    {k === 'transcripts' && (
                      <label className="button secondary compact" style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', height: 34 }}>
                        <img src="/upload-file.png" alt="Upload" style={{ width: 16, height: 16 }} />
                        <input type="file" multiple onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            // Let's just simulate adding them to a local list or updating the input for now
                            // Since the backend handles local upload differently, we would need to upload them.
                            // For UI placeholder as requested:
                            showToast(`Selected ${files.length} files`);
                          }
                        }} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>
                  {k === 'transcripts' && driveFiles.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input 
                          type="checkbox" 
                          checked={driveFiles.length > 0 && selectedDriveFiles.size === driveFiles.length}
                          onChange={() => setSelectedDriveFiles(selectedDriveFiles.size === driveFiles.length ? new Set() : new Set(driveFiles.map(f => f.id)))}
                        />
                        <span style={{ fontSize: 13 }} className="muted">Select All ({selectedDriveFiles.size} / {driveFiles.length})</span>
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-strong)' }}>
                        {driveFiles.map(f => (
                          <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--hairline)', cursor: 'pointer', margin: 0, fontWeight: 'normal' }}>
                            <input type="checkbox" checked={selectedDriveFiles.has(f.id)} onChange={() => toggleDriveFile(f.id)} />
                            <span style={{ fontSize: 12 }}>{f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
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
              Ask Copilot <img src="/send.png" alt="Send" style={{ width: 14, height: 14, marginLeft: 6 }} />
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
      <BackButton fallback="collection" />
    </div>
  );
}
