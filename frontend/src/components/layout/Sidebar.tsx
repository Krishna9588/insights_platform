import { useStore } from '@/store';
import { getProjects, getJobs, getNewsMonitors } from '@/api';
import { useEffect } from 'react';

const NAV = [
  {
    group: 'Primary', cls: 'primary',
    items: [
      { key: 'dashboard', label: 'Dashboard', badge: 'projects' },
      { key: 'collection', label: 'Collection' },
    ],
  },
  {
    group: 'Data', cls: 'data',
    items: [
      { key: 'deep', label: 'Deep Research' },
      { key: 'company', label: 'Company Profile' },
      { key: 'transcript', label: 'Transcript' },
      { key: 'social', label: 'Social Media' },
      { key: 'news', label: 'News & SEBI', badge: 'news' },
    ],
  },
  {
    group: 'System', cls: 'system',
    items: [
      { key: 'config', label: 'Configurations' },
      { key: 'storage', label: 'Storage' },
      { key: 'history', label: 'History', badge: 'jobs' },
    ],
  },
];

export default function Sidebar() {
  const { activePage, setActivePage, theme, toggleTheme, projects, jobs, monitors,
    setProjects, setJobs, setMonitors } = useStore();

  // Load data on mount
  useEffect(() => {
    getProjects().then((r) => setProjects(r.projects)).catch(() => { });
    getJobs().then((r) => setJobs(r.jobs)).catch(() => { });
    getNewsMonitors().then((r) => setMonitors(r.monitors)).catch(() => { });
  }, []);

  const badges: Record<string, number> = {
    projects: projects.length,
    jobs: jobs.filter((j) => j.status === 'running').length,
    news: monitors.length,
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">IP</div>
        <div>Insights Platform</div>
      </div>

      {NAV.map(({ group, cls, items }) => (
        <div key={group}>
          <div className={`nav-group-title ${cls}`}>{group}</div>
          {items.map(({ key, label, badge }) => (
            <button
              key={key}
              className={`nav-button${activePage === key ? ' active' : ''}`}
              onClick={() => setActivePage(key)}
            >
              <span>{label}</span>
              {badge && badges[badge] !== undefined && (
                <span className="nav-badge">{badges[badge]}</span>
              )}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          data-theme={theme}
        >
          <span className="light">Light</span>
          <span className="dark">Dark</span>
        </button>
      </div>
    </aside>
  );
}
