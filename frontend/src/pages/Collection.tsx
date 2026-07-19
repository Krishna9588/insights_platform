import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { getProjects, searchProjects, deleteProject } from '@/api';
import type { Project } from '@/types/api';
import { ProjectLogo } from '@/components/ProjectLogo';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';



function ProjectCard({
  project,
  onOpen,
  onAskCopilot,
  onDelete,
}: {
  project: Project & { updated_at?: string; processing_status?: Record<string, unknown> };
  onOpen: () => void;
  onAskCopilot: () => void;
  onDelete: () => void;
}) {
  const name = project.project_name ?? (project as unknown as Record<string, string>).name ?? 'Unknown';
  const domain = project.domain;
  const updated = project.updated_at ? new Date(project.updated_at).toLocaleDateString() : null;

  return (
    <div
      className="project-card card hoverable"
      onClick={onOpen}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 180,
        position: 'relative',
      }}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete project"
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
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>

      <div className="project-card-header">
        <div className="project-card-logo">
          <ProjectLogo name={name} domain={domain} size={40} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 32, marginLeft: 12 }}>
          <div className="item-title" style={{ fontSize: 16, marginBottom: 2 }}>{name}</div>
          {domain && (
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {domain.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }}></div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
        {updated ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{updated}</span> : <span />}
      </div>

      {/* Actions pinned to bottom */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
        <button className="button secondary compact" style={{ flex: 1 }} onClick={onOpen}>
          Open Project
        </button>
        <button className="button compact" style={{ flex: 1 }} onClick={onAskCopilot}>
          Ask Copilot <img src="/send.png" alt="Send" style={{ width: 14, height: 14, marginLeft: 6 }} />
        </button>
      </div>
    </div>
  );
}

export default function Collection() {
  const { setActivePage, setSelectedProjectView, setChatProject, projects, setProjects, showToast } = useStore();
  const [query, setQuery] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ project_name: string; snippet: string; updated_at?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setAllLoading(true);
      try {
        const res = await getProjects();
        setProjects(res.projects);
      } catch (err) {
        console.error(err);
      } finally {
        setAllLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchProjects(query.trim());
        setSearchResults(res.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const openProject = useCallback((name: string) => {
    setSelectedProjectView(name);
    setActivePage('projectview');
  }, [setSelectedProjectView, setActivePage]);

  const askCopilot = useCallback((name: string) => {
    setChatProject(name);
    setSelectedProjectView(name);
    setActivePage('projectview');
  }, [setChatProject, setSelectedProjectView, setActivePage]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteProject(deleteTarget);
      showToast(`Deleted: ${deleteTarget}`);
      const res = await getProjects();
      setProjects(res.projects);
    } catch {
      showToast('Failed to delete — check backend logs');
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const isSearching = Boolean(query.trim());

  return (
    <div>
      {deleteTarget && (
        <DeleteConfirmModal
          projectName={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <header className="topbar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <p className="eyebrow">Primary</p>
          <h1>Collection</h1>
        </div>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.45, fontSize: 16 }}>🔍</span>
            <input
              type="text"
              placeholder="Search across all projects & insights..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 48px', borderRadius: 12, fontSize: 15 }}
            />
            {(loading || allLoading) && (
              <span className="spinner" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }} />
            )}
          </div>
        </div>
      </header>

      <div style={{ marginTop: 32 }}>
        {isSearching ? (
          <>
            <p className="eyebrow" style={{ marginBottom: 16 }}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{query}"
            </p>
            {searchResults.length > 0 ? (
              <div className="collection-search-results">
                {searchResults.map((r, i) => (
                  <div key={i} className="list-item" style={{ cursor: 'pointer' }} onClick={() => openProject(r.project_name)}>
                    <div>
                      <div className="item-title" style={{ fontSize: 16 }}>{r.project_name}</div>
                      <p style={{
                        marginTop: 8, color: 'var(--body)', fontSize: 14, lineHeight: 1.5,
                        background: 'var(--surface-strong)', padding: '8px 12px', borderRadius: 8, fontStyle: 'italic',
                      }}>"{r.snippet}"</p>
                      {r.updated_at && (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                          Last updated: {new Date(r.updated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button className="button compact" onClick={(e) => { e.stopPropagation(); openProject(r.project_name); }}>
                      Open →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <p className="muted">No matches found for "{query}".</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Section A: Deep Research Projects ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 2 }}>Deep Research</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  {projects.length} project{projects.length !== 1 ? 's' : ''} · Full agent pipeline (scrape → insights → synthesis → brief)
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--hairline)', width: 200 }}
                />
                <button className="button" onClick={() => setActivePage('deep')}>+ New Research</button>
              </div>
            </div>

            {projects.length === 0 && !allLoading ? (
              <div className="card" style={{ padding: 64, textAlign: 'center' }}>
                <span style={{ fontSize: 40, display: 'block', marginBottom: 16, opacity: 0.4 }}>📂</span>
                <h3 style={{ marginBottom: 8 }}>No projects yet</h3>
                <p className="muted">Start a new research run to populate your collection.</p>
                <button className="button" style={{ marginTop: 20 }} onClick={() => setActivePage('deep')}>Start Research</button>
              </div>
            ) : (
              <div className="project-card-grid" style={{ alignItems: 'stretch' }}>
                {projects.filter(p => {
                  if (!localQuery.trim()) return true;
                  const q = localQuery.toLowerCase();
                  return (p.project_name?.toLowerCase().includes(q) || p.domain?.toLowerCase().includes(q));
                }).map((proj, i) => (
                  <ProjectCard
                    key={i}
                    project={proj as Project & { updated_at?: string; processing_status?: Record<string, unknown> }}
                    onOpen={() => openProject(proj.project_name)}
                    onAskCopilot={() => askCopilot(proj.project_name)}
                    onDelete={() => setDeleteTarget(proj.project_name)}
                  />
                ))}
                {projects.filter(p => {
                  if (!localQuery.trim()) return true;
                  const q = localQuery.toLowerCase();
                  return (p.project_name?.toLowerCase().includes(q) || p.domain?.toLowerCase().includes(q));
                }).length === 0 && (
                  <p className="muted" style={{ padding: 24 }}>No projects match your filter.</p>
                )}
              </div>
            )}

            {/* ── Section B: Data Collection ── */}
            <div style={{ marginTop: 48, paddingTop: 32, borderTop: '2px solid var(--hairline)' }}>
              <div style={{ marginBottom: 20 }}>
                <p className="eyebrow" style={{ marginBottom: 2 }}>Data Collection</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Standalone data gathering — social media scrapers, transcripts, company profiles
                </p>
              </div>
              <div className="grid cols-2" style={{ gap: 16 }}>
                {[
                  { key: 'social', icon: '📱', title: 'Social Media & Stores', desc: 'Reddit, YouTube, App Store, Play Store scrapers' },
                  { key: 'transcript', icon: '📄', title: 'Transcripts', desc: 'Upload local files or connect Google Drive' },
                  { key: 'company', icon: '🏢', title: 'Company Profile', desc: 'Scrape company information and market positioning' },
                  { key: 'news', icon: '📰', title: 'News', desc: 'Monitor news & SEBI filings — Under Development' },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="card hoverable"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}
                    onClick={() => setActivePage(item.key)}
                  >
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.desc}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 18, flexShrink: 0 }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
