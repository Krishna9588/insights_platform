import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import Sidebar from '@/components/layout/Sidebar';
import CopilotPanel from '@/components/layout/CopilotPanel';
import Dashboard from '@/pages/Dashboard';
import History from '@/pages/History';
import DeepResearch from '@/pages/DeepResearch';
import Transcript from '@/pages/Transcript';
import NewsSebi from '@/pages/NewsSebi';
import Config from '@/pages/Config';
import { CompanyProfile, SocialMedia, Storage } from '@/pages/stubs';
import { getJobs } from '@/api';

import Collection from '@/pages/Collection';
import ProjectView from '@/pages/ProjectView';

function PageRouter({ page }: { page: string }) {
  switch (page) {
    case 'dashboard': return <Dashboard />;
    case 'history': return <History />;
    case 'deep': return <DeepResearch />;
    case 'transcript': return <Transcript />;
    case 'news': return <NewsSebi />;
    case 'company': return <CompanyProfile />;
    case 'social': return <SocialMedia />;
    case 'config': return <Config />;
    case 'storage': return <Storage />;
    case 'collection': return <Collection />;
    case 'projectview': return <ProjectView />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const { theme, activePage, toast, jobs, setJobs, showToast, setActivePage, setSelectedProjectView } = useStore();
  const prevJobsRef = useRef<Record<string, string>>({});

  // Sync theme attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Poll for jobs every 3 seconds
  useEffect(() => {
    let interval: any;
    const fetchJobs = async () => {
      try {
        const res = await getJobs();
        setJobs(res.jobs);
        
        const newPrevJobs: Record<string, string> = {};
        res.jobs.forEach(j => {
          newPrevJobs[j.id] = j.status;
          const oldStatus = prevJobsRef.current[j.id];
          if (oldStatus && oldStatus !== 'complete' && j.status === 'complete') {
             showToast(`Process Completed: ${j.project_name}`, 10000, {
               label: 'Go to Project →',
               onClick: () => {
                 setSelectedProjectView(j.project_name);
                 setActivePage('projectview');
               }
             });
          } else if (oldStatus && oldStatus !== 'failed' && j.status === 'failed') {
             showToast(`Process Failed: ${j.project_name}. Check backend logs.`, 10000);
          }
        });
        prevJobsRef.current = newPrevJobs;
      } catch {}
    };

    fetchJobs();
    interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const hasActiveJobs = jobs.some(j => j.status === 'running' || j.status === 'queued');

  return (
    <div className="app" data-theme={theme}>
      <Sidebar />
      <main className="main" style={{ position: 'relative' }}>
        {hasActiveJobs && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--surface-strong)', overflow: 'hidden', zIndex: 100 }}>
            <div style={{ width: '100%', height: '100%', background: 'var(--accent-blue)', animation: 'indeterminate-progress 1.5s infinite linear', transformOrigin: '0% 50%' }} />
          </div>
        )}
        <PageRouter page={activePage} />
      </main>
      <CopilotPanel />

      {/* Global toast */}
      <div className={`toast${toast.visible ? ' show' : ''}`} aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{toast.message}</span>
        {toast.action && (
          <button 
            className="button primary" 
            style={{ padding: '4px 10px', fontSize: 12, minHeight: 'auto', background: 'var(--accent-green)', border: 'none' }}
            onClick={() => {
               toast.action!.onClick();
               // Hide toast immediately
               useStore.setState({ toast: { ...toast, visible: false } });
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
