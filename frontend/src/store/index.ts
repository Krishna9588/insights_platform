import { create } from 'zustand';
import type { Project, Job, ChatMessage, NewsMonitor } from '@/types/api';

// ── API Key types ──────────────────────────────────────────
export interface ApiKeyEntry {
  id: string;
  name: string;          // e.g. "Production key" or "personal"
  key: string;           // stored in-memory, saved to config via backend
  provider: string;      // 'gemini' | 'openai' | 'huggingface' | 'apify' | ...
  isDefault: boolean;
  createdAt: string;
}

// ── Pipeline default settings ─────────────────────────────
export interface PipelineDefaults {
  enabled: boolean;       // if true, data pages use these defaults instead of asking
  provider: string;
  start_from: string;
  only: string;
}

interface Toast { message: string; visible: boolean; }

interface AppStore {
  // Theme
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Active page
  activePage: string;
  setActivePage: (page: string) => void;

  // Projects
  projects: Project[];
  activeProject: string | null;
  selectedProjectView: string | null;
  setProjects: (p: Project[]) => void;
  setActiveProject: (name: string | null) => void;
  setSelectedProjectView: (name: string | null) => void;

  // Jobs
  jobs: Job[];
  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;

  // News monitors
  monitors: NewsMonitor[];
  setMonitors: (m: NewsMonitor[]) => void;

  // Copilot chat
  chatMessages: ChatMessage[];
  chatProject: string | null;
  chatProvider: string;
  chatSessionId: string | null;
  chatLoading: boolean;
  addChatMessage: (msg: ChatMessage) => void;
  setChatMessages: (msgs: ChatMessage[]) => void;
  clearChat: () => void;
  setChatProject: (name: string | null) => void;
  setChatProvider: (p: string) => void;
  setChatSessionId: (id: string | null) => void;
  setChatLoading: (v: boolean) => void;

  // API Keys (stored in memory, persisted to backend config)
  apiKeys: ApiKeyEntry[];
  setApiKeys: (keys: ApiKeyEntry[]) => void;
  addApiKey: (key: Omit<ApiKeyEntry, 'id' | 'createdAt'>) => void;
  removeApiKey: (id: string) => void;

  // Pipeline Defaults
  pipelineDefaults: PipelineDefaults;
  setPipelineDefaults: (d: Partial<PipelineDefaults>) => void;

  // Toast
  toast: Toast;
  showToast: (message: string, durationMs?: number) => void;
}

const DEFAULT_PIPELINE: PipelineDefaults = {
  enabled: false,
  provider: 'gemini',
  start_from: 'agent1',
  only: '',
};

export const useStore = create<AppStore>((set, get) => ({
  // Theme
  theme: (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light',
  setTheme: (t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),

  // Page
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),

  // Projects
  projects: [],
  activeProject: null,
  selectedProjectView: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  setSelectedProjectView: (selectedProjectView) => set({ selectedProjectView }),

  // Jobs
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  upsertJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return { jobs: [job, ...s.jobs] };
      const next = [...s.jobs];
      next[idx] = job;
      return { jobs: next };
    }),

  // News
  monitors: [],
  setMonitors: (monitors) => set({ monitors }),

  // Chat
  chatMessages: [],
  chatProject: null,
  chatProvider: 'gemini',
  chatSessionId: null,
  chatLoading: false,
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),
  clearChat: () => set({ chatMessages: [], chatSessionId: null }),
  setChatProject: (chatProject) => set({ chatProject, chatSessionId: null, chatMessages: [] }),
  setChatProvider: (chatProvider) => set({ chatProvider }),
  setChatSessionId: (chatSessionId) => set({ chatSessionId }),
  setChatLoading: (chatLoading) => set({ chatLoading }),

  // API Keys
  apiKeys: [],
  setApiKeys: (apiKeys) => set({ apiKeys }),
  addApiKey: ({ name, key, provider, isDefault }) => {
    const newKey: ApiKeyEntry = {
      id: crypto.randomUUID(),
      name, key, provider, isDefault,
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      let keys = [...s.apiKeys];
      // If new key is default for its provider, unset others
      if (isDefault) {
        keys = keys.map((k) =>
          k.provider === provider ? { ...k, isDefault: false } : k
        );
      }
      return { apiKeys: [...keys, newKey] };
    });
  },
  removeApiKey: (id) =>
    set((s) => ({ apiKeys: s.apiKeys.filter((k) => k.id !== id) })),

  // Pipeline Defaults
  pipelineDefaults: DEFAULT_PIPELINE,
  setPipelineDefaults: (d) =>
    set((s) => ({ pipelineDefaults: { ...s.pipelineDefaults, ...d } })),

  // Toast
  toast: { message: '', visible: false },
  showToast: (message, durationMs = 2800) => {
    set({ toast: { message, visible: true } });
    setTimeout(() => set({ toast: { message: '', visible: false } }), durationMs);
  },
}));
