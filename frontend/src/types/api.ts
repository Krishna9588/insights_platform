// All TypeScript types for API responses and shared data structures

export interface Project {
  project_name: string;
  name?: string;
  display_name?: string;
  domain?: string;
  updated_at?: string;
  last_updated?: string;
  processing_status?: Record<string, boolean>;
  has_insights?: boolean;
  has_brief?: boolean;
  agent2_done?: boolean;
  agent3_done?: boolean;
  agent4_done?: boolean;
  sources?: string[];
}

export interface Job {
  id: string;
  project_name: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress?: number;
  started_at?: string;
  completed_at?: string;
  result_summary?: string;
  error?: string;
  kind?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sources?: string[];
  grounding?: number;
}

export interface NewsMonitor {
  id: string;
  name: string;
  query: string;
  schedule_time: string;
  timezone: string;
  sources: string[];
  enabled: boolean;
  last_run?: string;
}

export interface AppConfig {
  provider?: string;
  drive_folder_id?: string;
  [key: string]: unknown;
}

export interface HealthStatus {
  status: string;
  version?: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface JobsResponse {
  jobs: Job[];
}

export interface NewsMonitorsResponse {
  monitors: NewsMonitor[];
}

export interface PipelineRunRequest {
  project_name: string;
  provider?: string;
  domain?: string;
  start_from?: string;
  only?: string;
  agent1_payload?: Record<string, unknown>;
}

export interface CopilotResponse {
  answer: string;
  sources?: string[];
  grounding?: number;
  chunks?: Array<{ text: string; source: string }>;
}

export interface SessionsResponse {
  sessions: Array<{
    id: string;
    created_at: string;
    message_count: number;
    preview?: string;
  }>;
}
