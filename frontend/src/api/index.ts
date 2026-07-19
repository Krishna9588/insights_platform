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
export const deleteProject = (name: string) => api.delete<{ status: string; project_name: string; deleted_paths: string[]; errors: string[] }>(`/projects/${encodeURIComponent(name)}`);
export const requestFreshData = (body: { project_name: string; query: string; provider?: string }) => api.post<{ status: string; requested_data: any[] }>('/projects/requested-data', body);

// ── Health ────────────────────────────────────────────────
export const getHealth = () => api.get<HealthStatus>('/health');

// ── Jobs ──────────────────────────────────────────────────
export const getJobs = () => api.get<JobsResponse>('/jobs');
export const getJob = (id: string) => api.get<Job>(`/jobs/${id}`);
export const cancelJob = (id: string) => api.delete<{ status: string; message: string }>(`/jobs/${id}`);
export const clearJobs = () => api.delete<{ status: string; cleared_count: number }>('/jobs');

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

export const fetchGoogleDriveFiles = (url_or_id: string) =>
  api.post<{ status: string; files: any[] }>('/ingest/google-drive/list', { url_or_id });

export const ingestCombined = (formData: FormData) =>
  api.postForm<{ job_id: string; status: string }>('/ingest/transcripts/combined', formData);

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

export const getAllChatHistory = (project_name: string) =>
  api.get<{ history: any[] }>(`/chat/history/all?project_name=${encodeURIComponent(project_name)}`);

// ── News ──────────────────────────────────────────────────
export const getNewsMonitors = () => api.get<NewsMonitorsResponse>('/news/monitors');
export const createNewsMonitor = (body: Omit<NewsMonitor, 'id' | 'updated_at'>) =>
  api.post<NewsMonitor>('/news/monitors', body);
export const deleteNewsMonitor = (id: string) => api.delete<{status: string, id: string}>(`/news/monitors/${id}`);

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
export const testDriveConnection = (folder_id: string) => api.post(`/config/drive/test?folder_id=${encodeURIComponent(folder_id)}`, {});
export const getKeyStatus = () =>
  api.get<{ key_status: Record<string, { found: boolean; preview: string | null }> }>('/config/key-status');
