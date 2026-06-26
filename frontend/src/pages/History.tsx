import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getJobs } from '@/api';
import type { Job } from '@/types/api';

const STATUS_DOT: Record<Job['status'], string> = {
  queued: 'warn',
  running: 'live',
  complete: 'ok',
  failed: 'bad',
};

export default function History() {
  const { jobs, setJobs, showToast } = useStore();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | Job['status']>('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await getJobs();
      setJobs(r.jobs);
    } catch {
      showToast('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Data</p>
          <h1>Research History</h1>
        </div>
        <div className="actions">
          <button className="button secondary" onClick={load} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="tabs">
        {(['all', 'running', 'complete', 'failed', 'queued'] as const).map((s) => (
          <button
            key={s}
            className={`tab${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 12 }}>
                ({jobs.filter((j) => j.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p className="muted">No jobs found{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="list">
          {filtered.map((job) => (
            <div className="list-item" key={job.id}>
              <div>
                <div className="item-title">{job.project_name}</div>
                <div className="status-line">
                  <div className={`dot ${STATUS_DOT[job.status]}`} />
                  <span style={{ textTransform: 'capitalize' }}>{job.status}</span>
                  {job.kind && <><span>·</span><span>{job.kind}</span></>}
                  {job.started_at && (
                    <span>· {new Date(job.started_at).toLocaleString()}</span>
                  )}
                </div>
                {job.result_summary && (
                  <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                    {job.result_summary}
                  </p>
                )}
                {job.error && (
                  <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>
                    Error: {job.error}
                  </p>
                )}
              </div>
              <div>
                {job.progress !== undefined && job.status === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>{job.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
