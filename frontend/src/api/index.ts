import { api } from './client';
import type {
  ProjectsResponse, Project, JobsResponse, Job,
  NewsMonitorsResponse, NewsMonitor, HealthStatus,
  CopilotResponse, PipelineRunRequest,
} from '@/types/api';

// ── Projects ──────────────────────────────────────────────
export const getProjects = () => api.get<ProjectsResponse>('/projects');
export const getProject = (name: string) => api.get<Project>(`/projects/${name}`);
export const searchProjects = (q: string) => api.get<{ results: { project_name: string, snippet: string, updated_at?: string }[] }>(`/projects/search?q=${encodeURIComponent(q)}`);

// ── Health ────────────────────────────────────────────────
export const getHealth = () => api.get<HealthStatus>('/health');

// ── Jobs ──────────────────────────────────────────────────
export const getJobs = () => api.get<JobsResponse>('/jobs');
export const getJob = (id: string) => api.get<Job>(`/jobs/${id}`);

// ── Pipeline ──────────────────────────────────────────────
export const runPipeline = (body: PipelineRunRequest) =>
  api.post<{ job_id: string }>('/pipeline/run', body);

// ── Ingest ────────────────────────────────────────────────
export const ingestTranscripts = (body: {
  project_name: string;
  input_path: string;
  provider?: string;
}) => api.post('/ingest/transcripts/local', body);

export const ingestGoogleDrive = (body: {
  project_name: string;
  folder_id: string;
  provider?: string;
}) => api.post('/ingest/google-drive', body);

// ── Copilot ───────────────────────────────────────────────
export const queryCopilot = (body: {
  question: string;
  project_name?: string;
  provider?: string;
  limit?: number;
  use_llm?: boolean;
}) => api.post<CopilotResponse>('/copilot/rag', body);

export const askChat = (body: {
  project_name: string;
  question: string;
  session_id?: string | null;
  provider?: string;
}) => api.post<{ session_id: string; title: string; question: string; answer: string }>('/chat/ask', body);

export const getChatSessions = (project_name: string) => 
  api.get<{ sessions: any[] }>(`/chat/sessions?project_name=${encodeURIComponent(project_name)}`);

export const getChatHistory = (project_name: string, session_id: string) =>
  api.get<{ history: any[] }>(`/chat/history?project_name=${encodeURIComponent(project_name)}&session_id=${encodeURIComponent(session_id)}`);

// ── News ──────────────────────────────────────────────────
export const getNewsMonitors = () => api.get<NewsMonitorsResponse>('/news/monitors');
export const createNewsMonitor = (body: Omit<NewsMonitor, 'id'>) =>
  api.post<NewsMonitor>('/news/monitors', body);

// ── RAG ───────────────────────────────────────────────────
export const triggerRagIndex = (project_name?: string) =>
  api.post('/rag/index', { project_name });

// ── Sessions ──────────────────────────────────────────────
export const getSessions = (project: string) =>
  api.get(`/sessions/${project}`);

// ── Summaries ─────────────────────────────────────────────
export const getSummaries = (project: string) =>
  api.get(`/summaries/${project}`);

// ── Config ────────────────────────────────────────────────
export const getAppConfig = () => api.get('/config/app');
export const saveAppConfig = (values: Record<string, unknown>) =>
  api.post('/config/app', { values });
export const getDriveConfig = () => api.get('/config/drive');
