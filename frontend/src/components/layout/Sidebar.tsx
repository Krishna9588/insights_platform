import { useStore } from '@/store';
import { getProjects, getJobs, getNewsMonitors } from '@/api';
import { useEffect } from 'react';
import {
  MdDashboard, MdFolder, MdSearch, MdBusiness, MdSubtitles,
  MdPhoneAndroid, MdNewspaper, MdSettings, MdStorage, MdHistory,
} from 'react-icons/md';
import { HiSun, HiMoon } from 'react-icons/hi';

const NAV_ICON_MAP: Record<string, React.ElementType> = {
  dashboard: MdDashboard,
  collection: MdFolder,
  deep: MdSearch,
  company: MdBusiness,
  transcript: MdSubtitles,
  social: MdPhoneAndroid,
  news: MdNewspaper,
  config: MdSettings,
  storage: MdStorage,
  history: MdHistory,
};

const NAV = [
  {
    group: 'Primary', cls: 'primary',
    items: [
      { key: 'dashboard', label: 'Dashboard', badge: 'projects' },
      { key: 'collection', label: 'Projects' },
    ],
  },
  {
    group: 'Data', cls: 'data',
    items: [
      { key: 'deep', label: 'Competitor Research' },
      { key: 'company', label: 'Company Info' },
      { key: 'transcript', label: 'Documents' },
      { key: 'social', label: 'Social Insights' },
      { key: 'news', label: 'News & Trends', badge: 'news' },
    ],
  },
  {
    group: 'System', cls: 'system',
    items: [
      { key: 'config', label: 'Settings' },
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
      <div className="brand" style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', marginBottom: 16, cursor: 'pointer' }} onClick={() => setActivePage('dashboard')}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Founder Intelligence
        </h1>
      </div>

      {NAV.map(({ group, cls, items }) => (
        <div key={group}>
          <div className={`nav-group-title ${cls}`}>{group}</div>
          {items.map(({ key, label, badge }) => {
            const Icon = NAV_ICON_MAP[key];
            return (
              <button
                key={key}
                className={`nav-button${activePage === key ? ' active' : ''}`}
                onClick={() => setActivePage(key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {Icon && <Icon size={16} style={{ flexShrink: 0, opacity: activePage === key ? 1 : 0.7 }} />}
                  {label}
                </span>
                {badge && badges[badge] !== undefined && (
                  <span className="nav-badge">{badges[badge]}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div className="sidebar-bottom">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          data-theme={theme}
        >
          <span className="light" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HiSun size={14} /> Light
          </span>
          <span className="dark" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HiMoon size={14} /> Dark
          </span>
        </button>
      </div>
    </aside>
  );
}
