import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { getProjects, searchProjects } from '@/api';
import type { Project } from '@/types/api';

function ProjectCard({
  project,
  onOpen,
  onAskCopilot,
}: {
  project: Project & { updated_at?: string; processing_status?: Record<string, unknown> };
  onOpen: () => void;
  onAskCopilot: () => void;
}) {
  const name = project.project_name ?? (project as Record<string, string>).name ?? 'Unknown';
  const domain = project.domain;
  const updated = project.updated_at ? new Date(project.updated_at).toLocaleDateString() : null;
  const status = project.processing_status ?? {};
  const statusEntries = Object.entries(status);
  const doneCount = statusEntries.filter(([, v]) => Boolean(v)).length;
  const total = statusEntries.length;

  // Logo from logo.dev
  const logoSrc = domain
    ? `https://img.logo.dev/${new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname}?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=64`
    : null;

  return (
    <div className="project-card card hoverable" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="project-card-header">
        <div className="project-card-logo">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={name}
              style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex';
              }}
            />
          ) : null}
          <div
            style={{
              display: logoSrc ? 'none' : 'flex',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--accent-blue)',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="item-title" style={{ fontSize: 16, marginBottom: 2 }}>{name}</div>
          {domain && (
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {domain.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* Processing status pills */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {statusEntries.map(([agent, done]) => (
            <span
              key={agent}
              style={{
                background: done ? 'var(--sage)' : 'var(--surface-strong)',
                color: done ? 'var(--success)' : 'var(--muted)',
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 600,
                border: done ? '1px solid rgba(21,128,61,0.2)' : '1px solid var(--hairline)',
              }}
            >
              {String(agent).replace(/_/g, ' ')} {done ? '✓' : '…'}
            </span>
          ))}
        </div>
      )}

      {total === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>No insights yet</div>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
        {updated ? (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{updated}</span>
        ) : (
          <span />
        )}
        {total > 0 && (
          <span style={{ fontSize: 12, color: doneCount === total ? 'var(--success)' : 'var(--muted)' }}>
            {doneCount}/{total} agents done
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
        <button
          className="button secondary compact"
          style={{ flex: 1 }}
          onClick={onOpen}
        >
          Open Project
        </button>
        <button
          className="button compact"
          style={{ flex: 1 }}
          onClick={onAskCopilot}
        >
          Ask Copilot →
        </button>
      </div>
    </div>
  );
}

export default function Collection() {
  const { setActivePage, setSelectedProjectView, setChatProject, projects, setProjects } = useStore();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ project_name: string; snippet: string; updated_at?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [allLoading, setAllLoading] = useState(false);

  // Load all projects on mount
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

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
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

  const isSearching = Boolean(query.trim());

  // Map search results to enriched project info
  const enrichedSearchResults = searchResults.map((r) => {
    const proj = projects.find((p) => p.project_name === r.project_name);
    return { ...r, ...(proj ?? {}) };
  });

  return (
    <div>
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
              style={{
                width: '100%',
                padding: '12px 48px',
                borderRadius: 12,
                fontSize: 15,
              }}
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
                  <div
                    key={i}
                    className="list-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openProject(r.project_name)}
                  >
                    <div>
                      <div className="item-title" style={{ fontSize: 16 }}>{r.project_name}</div>
                      <p style={{
                        marginTop: 8,
                        color: 'var(--body)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        background: 'var(--surface-strong)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontStyle: 'italic',
                      }}>
                        "{r.snippet}"
                      </p>
                      {r.updated_at && (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                          Last updated: {new Date(r.updated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      className="button compact"
                      onClick={(e) => { e.stopPropagation(); openProject(r.project_name); }}
                    >
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p className="eyebrow">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
              <button className="button" onClick={() => setActivePage('deep')}>+ New Research</button>
            </div>

            {projects.length === 0 && !allLoading ? (
              <div className="card" style={{ padding: 64, textAlign: 'center' }}>
                <span style={{ fontSize: 40, display: 'block', marginBottom: 16, opacity: 0.4 }}>📂</span>
                <h3 style={{ marginBottom: 8 }}>No projects yet</h3>
                <p className="muted">Start a new research run to populate your collection.</p>
                <button className="button" style={{ marginTop: 20 }} onClick={() => setActivePage('deep')}>
                  Start Research
                </button>
              </div>
            ) : (
              <div className="project-card-grid">
                {projects.map((proj, i) => (
                  <ProjectCard
                    key={i}
                    project={proj as Project & { updated_at?: string; processing_status?: Record<string, unknown> }}
                    onOpen={() => openProject(proj.project_name)}
                    onAskCopilot={() => askCopilot(proj.project_name)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
