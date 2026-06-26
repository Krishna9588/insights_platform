import { useEffect } from 'react';
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
  const { theme, activePage, toast } = useStore();

  // Sync theme attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app" data-theme={theme}>
      <Sidebar />
      <main className="main">
        <PageRouter page={activePage} />
      </main>
      <CopilotPanel />

      {/* Global toast */}
      <div className={`toast${toast.visible ? ' show' : ''}`} aria-live="polite">
        {toast.message}
      </div>
    </div>
  );
}
