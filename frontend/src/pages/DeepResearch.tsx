import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { runPipeline, getProjects, fetchGoogleDriveFiles } from '@/api';
import type { Project } from '@/types/api';
import BackButton from '@/components/layout/BackButton';
import { ProjectLogo } from '@/components/ProjectLogo';
import { RiSendPlaneFill, RiRocketLine } from 'react-icons/ri';
import { HiCheck, HiLightningBolt, HiUpload, HiDocumentText, HiFolder } from 'react-icons/hi';
import { SiGoogledrive } from 'react-icons/si';
import { MdClose } from 'react-icons/md';

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
                {String(agent).replace('_', ' ')} {done ? <HiCheck size={11} /> : <span style={{ opacity: 0.5 }}>...</span>}
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
          Ask Copilot <RiSendPlaneFill size={13} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
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

  // Local transcripts drag-and-drop state
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setLocalFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLocalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

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
      if (localFiles.length > 0) {
        if (!payload.transcripts) payload.transcripts = {};
        payload.transcripts.local_paths = localFiles.map(f => f.name);
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
      getProjects().then((r) => setProjects(r.projects)).catch(() => { });
    } catch {
      showToast('Failed to start pipeline — check backend logs');
    } finally {
      setLoading(false);
    }
  };

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
          <button className="button" onClick={submit} disabled={loading}>
              {loading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Starting…</>
              : <><RiRocketLine size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Launch Pipeline</>}
          </button>
        </div>
      </header>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'stretch' }}>
        {/* LEFT — Project form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
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
          </div>

          {/* Transcripts & Documents Box on Left */}
          <div style={{ marginTop: 20, padding: 16, background: 'var(--surface-strong)', border: '1px solid var(--hairline)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Transcripts & Documents</h4>
            </div>

            {/* Google Drive Link Option — Original Color Google Drive Logo */}
            <div className="form" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--body)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SiGoogledrive color="#4285F4" size={18} style={{ flexShrink: 0 }} />
                Google Drive Link / Folder ID or Path
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={form.transcripts}
                  onChange={set('transcripts')}
                  placeholder="Paste Google Drive URL or Folder ID..."
                  style={{ fontSize: 13, flex: 1 }}
                />
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={handleFetchDrive}
                  disabled={fetchingDrive}
                  style={{ whiteSpace: 'nowrap', height: 36 }}
                >
                  {fetchingDrive ? 'Fetching...' : 'Fetch Files'}
                </button>
              </div>
            </div>

            {driveFiles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={driveFiles.length > 0 && selectedDriveFiles.size === driveFiles.length}
                    onChange={() => setSelectedDriveFiles(selectedDriveFiles.size === driveFiles.length ? new Set() : new Set(driveFiles.map(f => f.id)))}
                  />
                  <span style={{ fontSize: 12 }} className="muted">Select All ({selectedDriveFiles.size} / {driveFiles.length})</span>
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-card)' }}>
                  {driveFiles.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--hairline)', cursor: 'pointer', margin: 0, fontWeight: 'normal' }}>
                      <input type="checkbox" checked={selectedDriveFiles.has(f.id)} onChange={() => toggleDriveFile(f.id)} />
                      <span style={{ fontSize: 12 }}>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Local Upload Grid Box */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <HiUpload size={14} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--body)' }}>Upload Local Transcripts</span>
              </div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '2px dashed var(--accent-blue)' : '2px dashed var(--hairline)',
                  borderRadius: 8,
                  padding: '18px 12px',
                  textAlign: 'center',
                  background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-card)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('deep-file-upload')?.click()}
              >
                <HiUpload size={24} style={{ marginBottom: 4, opacity: 0.7, color: 'var(--accent-blue)', display: 'block', margin: '0 auto 4px' }} />
                <p style={{ margin: 0, fontWeight: 500, fontSize: 13 }}>Drag and drop transcript files here</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>or click to browse</p>
                <input type="file" id="deep-file-upload" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
              </div>

              {localFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12 }} className="muted">Selected Files ({localFiles.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {localFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--surface-card)', borderRadius: 4, fontSize: 12 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}><HiDocumentText size={13} /> {f.name}</span>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }} onClick={() => setLocalFiles(prev => prev.filter((_, idx) => idx !== i))}><MdClose size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Data sources */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 14 }}>Data Sources</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Fill in the inputs for the sources you want to include. Empty inputs will be ignored.
            </p>
              
            {['reddit', 'youtube', 'play_store', 'app_store', 'news'].map((k) => (
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
                      k === 'news' ? 'e.g. Groww recent news or topic' :
                      'e.g. Groww App'
                    }
                    style={{ fontSize: 13, padding: '8px 12px', flex: 1 }}
                  />
                </div>
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
              Ask Copilot <RiSendPlaneFill size={13} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
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
