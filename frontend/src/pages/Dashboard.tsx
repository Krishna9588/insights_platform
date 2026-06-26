import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getHealth, getProjects, getJobs, getNewsMonitors } from '@/api';

export default function Dashboard() {
  const { projects, jobs, monitors, setProjects, setJobs, setMonitors, setActivePage, showToast } = useStore();
  const [health, setHealth] = useState<string>('checking…');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [h, p, j, n] = await Promise.all([
        getHealth(),
        getProjects(),
        getJobs(),
        getNewsMonitors(),
      ]);
      setHealth(h.status ?? 'ok');
      setProjects(p.projects);
      setJobs(j.jobs);
      setMonitors(n.monitors);
    } catch {
      setHealth('error');
      showToast('Could not reach backend — is it running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runningJobs = jobs.filter((j) => j.status === 'running').length;
  const completedJobs = jobs.filter((j) => j.status === 'complete').length;

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Home</p>
          <h1>Dashboard</h1>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Refresh'}
          </button>
          <button className="button" onClick={() => setActivePage('deep')}>
            New Research
          </button>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="grid cols-4">
        <div className="card hoverable metric accent-blue">
          <div>
            <p className="eyebrow">Company Projects</p>
            <strong>{projects.length}</strong>
          </div>
          <button
            className="button secondary compact"
            onClick={() => setActivePage('history')}
          >
            History
          </button>
        </div>

        <div className="card hoverable metric accent-violet">
          <div>
            <p className="eyebrow">News Monitors</p>
            <strong>{monitors.length}</strong>
          </div>
          <button
            className="button secondary compact"
            onClick={() => setActivePage('news')}
          >
            Open News
          </button>
        </div>

        <div className="card hoverable metric accent-green">
          <div>
            <p className="eyebrow">Backend</p>
            <strong style={{ fontSize: 20 }}>{health}</strong>
          </div>
          <div className="status-line">
            <div className={`dot ${health === 'ok' || health === 'healthy' ? 'ok' : 'bad'}`} />
            <span>API Status</span>
          </div>
        </div>

        <div className="card hoverable metric accent-coral">
          <div>
            <p className="eyebrow">Jobs Running</p>
            <strong>{runningJobs}</strong>
          </div>
          <p className="muted">{completedJobs} completed</p>
        </div>
      </div>

      {/* Recent Projects */}
      <div style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Recent Projects</h2>
          <button className="button secondary compact" onClick={() => setActivePage('deep')}>
            + New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p className="muted">No projects yet. Start your first research run.</p>
            <button
              className="button"
              style={{ marginTop: 16 }}
              onClick={() => setActivePage('deep')}
            >
              Start Research
            </button>
          </div>
        ) : (
          <div className="list">
            {projects.slice(0, 8).map((p) => {
              const pp = p as unknown as Record<string, unknown>;
              const name = String(pp.project_name || pp.name || '');
              const status = (pp.processing_status as Record<string, boolean>) ?? {};
              const hasBrief = status.agent4_product_brief_done;
              const hasInsights = status.agent2_insights_extracted;

              return (
                <div className="list-item" key={name}>
                  <div>
                    <div className="item-title">{name}</div>
                    <div className="status-line">
                      {hasBrief && <><div className="dot ok" /><span>Brief ready</span></>}
                      {hasInsights && !hasBrief && <><div className="dot warn" /><span>Insights ready</span></>}
                      {!hasInsights && !hasBrief && <><div className="dot" /><span>No insights yet</span></>}
                      {pp.updated_at && <span>· {new Date(String(pp.updated_at)).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="button secondary compact"
                      onClick={() => {
                        useStore.getState().setSelectedProjectView(name);
                        useStore.getState().setActivePage('projectview');
                      }}
                    >
                      View Project
                    </button>
                    <button
                      className="button secondary compact"
                      onClick={() => {
                        useStore.getState().setChatProject(name);
                        showToast(`Copilot set to: ${name}`);
                      }}
                    >
                      Ask Copilot
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Active Jobs */}
      {jobs.filter((j) => j.status === 'running' || j.status === 'queued').length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="section-head">
            <h2>Active Jobs</h2>
            <button className="button secondary compact" onClick={() => setActivePage('history')}>
              All jobs
            </button>
          </div>
          <div className="list">
            {jobs.filter((j) => j.status === 'running' || j.status === 'queued').map((j) => (
              <div className="list-item" key={j.id}>
                <div>
                  <div className="item-title">{j.project_name}</div>
                  <div className="status-line">
                    <div className="dot live" style={{ animation: 'pulse 1.5s ease infinite' }} />
                    <span>{j.status}</span>
                    {j.started_at && <span>· Started {new Date(j.started_at).toLocaleTimeString()}</span>}
                  </div>
                </div>
                <div>
                  {j.progress !== undefined && (
                    <div className="progress-bar" style={{ width: 120 }}>
                      <div className="progress-bar-fill" style={{ width: `${j.progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
