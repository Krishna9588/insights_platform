import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getProject, runPipeline } from '@/api';

export default function ProjectView() {
  const { selectedProjectView, setActivePage, setChatProject, showToast } = useStore();
  const [data, setData] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProjectView) return;
    setLoading(true);
    getProject(selectedProjectView)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error(err);
        showToast('Failed to load project details');
      })
      .finally(() => setLoading(false));
  }, [selectedProjectView, showToast]);

  if (!selectedProjectView) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p className="muted">No project selected.</p>
        <button className="button" onClick={() => setActivePage('dashboard')} style={{ marginTop: 16 }}>Go to Dashboard</button>
      </div>
    );
  }

  const handleAskCopilot = () => {
    setChatProject(selectedProjectView);
    showToast(`Copilot set to: ${selectedProjectView}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 64 }}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Project View</p>
          <h1>{data?.company_name || selectedProjectView}</h1>
        </div>
        <div className="actions">
          <button className="button compact secondary" onClick={handleAskCopilot}>
            Ask Copilot →
          </button>
          <button className="button compact secondary" onClick={() => setActivePage('collection')}>
            ← Back
          </button>
        </div>
      </header>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-strong)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Need fresh data?</h3>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>Re-run the deep research pipeline to update this project with the latest information.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            placeholder="E.g. Focus specifically on their latest pricing model..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--hairline)' }}
          />
          <button 
            className="button" 
            disabled={updating}
            onClick={async () => {
              try {
                setUpdating(true);
                await runPipeline({
                  project_name: activeProject || 'Unknown',
                  provider: 'gemini',
                  start_from: 'agent1',
                  only: ''
                });
                showToast('Update started! Check Dashboard for progress.');
                setCustomPrompt('');
              } catch (e) {
                showToast('Failed to start update');
              } finally {
                setUpdating(false);
              }
            }}
          >
            {updating ? 'Starting...' : 'Update Data'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span className="spinner dark" />
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">Project data not found.</p>
        </div>
      ) : (
        <div className="grid cols-1" style={{ gap: 24 }}>
          {/* Company Profile Card */}
          <div className="card">
            <h2 style={{ marginBottom: 16, borderBottom: '1px solid var(--hairline)', paddingBottom: 12 }}>Company Profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Domain</span>
                <p style={{ fontWeight: 500, wordBreak: 'break-all' }}>
                  {data.domain ? <a href={data.domain} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{data.domain}</a> : 'N/A'}
                </p>
              </div>

              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Founded</span>
                <p style={{ fontWeight: 500 }}>{data.year_founded || 'N/A'}</p>
              </div>

              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Employees</span>
                <p style={{ fontWeight: 500 }}>{data.employee_count || 'N/A'}</p>
              </div>

              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Industry & Segment</span>
                <p style={{ fontWeight: 500 }}>{data.industry_and_segment || 'N/A'}</p>
              </div>

              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Revenue / Funding</span>
                <p style={{ fontWeight: 500 }}>{data.annual_revenue || data.funding_raised || 'N/A'}</p>
              </div>

            </div>

            {data.key_positioning && (
              <div style={{ marginTop: 24 }}>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Key Positioning</span>
                <p style={{ lineHeight: 1.6, marginTop: 4, color: 'var(--body)' }}>{data.key_positioning}</p>
              </div>
            )}
          </div>

          <div className="grid cols-2" style={{ gap: 24 }}>
            {/* Strategic Moves */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎯</span> Strategic Moves
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(data.strategic_moves || []).slice(0, 5).map((move: any, i: number) => (
                  <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, lineHeight: 1.5 }}>{move.move || move.description || move}</p>
                    {move.effect && move.effect.length > 0 && (
                      <ul style={{ paddingLeft: 16, margin: 0, fontSize: 13, color: 'var(--body)' }}>
                        {move.effect.map((ef: string, j: number) => <li key={j}>{ef}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {(!data.strategic_moves || data.strategic_moves.length === 0) && (
                  <p className="muted" style={{ fontSize: 14 }}>No strategic moves recorded.</p>
                )}
              </div>
            </div>

            {/* Current Problems */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span> Problems Struggling With
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(data.current_problems_struggling_with || []).slice(0, 5).map((prob: any, i: number) => (
                  <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8, borderLeft: '3px solid var(--error)' }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, lineHeight: 1.5 }}>{prob.description || prob.issue || prob}</p>
                    {prob.effect && prob.effect.length > 0 && (
                      <ul style={{ paddingLeft: 16, margin: 0, fontSize: 13, color: 'var(--body)', marginTop: 8 }}>
                        {prob.effect.map((ef: string, j: number) => <li key={j}>{ef}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {(!data.current_problems_struggling_with || data.current_problems_struggling_with.length === 0) && (
                  <p className="muted" style={{ fontSize: 14 }}>No problems recorded.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid cols-2" style={{ gap: 24 }}>
            {/* Differentiators */}
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✨</span> Differentiators
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(data.differentiators || []).slice(0, 5).map((diff: any, i: number) => (
                  <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8 }}>
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>{diff.feature || diff.description || diff}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💻</span> Tech Stack Highlights
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(data.tech_stack_highlights || []).map((tech: string, i: number) => (
                  <span key={i} style={{ 
                    padding: '4px 12px', 
                    background: 'var(--surface-strong)', 
                    border: '1px solid var(--hairline)', 
                    borderRadius: 999, 
                    fontSize: 13, 
                    fontWeight: 500 
                  }}>
                    {tech}
                  </span>
                ))}
                {(!data.tech_stack_highlights || data.tech_stack_highlights.length === 0) && (
                  <p className="muted" style={{ fontSize: 14 }}>No tech stack data recorded.</p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
