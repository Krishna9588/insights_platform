# Frontend Development Guide — Insights Platform

> **For agents and developers:** This document is the single source of truth for all
> frontend decisions. Read this before writing any frontend code or modifying the UI.
> Updated as the project evolves.

---

## 1. Technology Stack

| Tool | Version | Why |
|------|---------|-----|
| **React** | 18+ | Component model, ecosystem, team familiarity |
| **Vite** | 5+ | Fast dev server, HMR, optimized builds |
| **TypeScript** | 5+ | Type safety across the whole app |
| **Zustand** | 4+ | Simple global state (no Redux boilerplate) |
| **CSS Custom Properties** | Native | Design tokens from design_airtable.md |
| **React Router** | 6+ | Client-side routing for multi-page SPA |

**Not using:** Next.js (overkill for internal tool), TailwindCSS (conflicts with design system tokens), Redux (too much boilerplate for team size).

---

## 2. Project Structure

```
frontend/
+-- index.html              # Vite entry HTML
+-- package.json
+-- vite.config.ts          # Vite config — proxy API to port 8000
+-- tsconfig.json
+-- src/
    +-- main.tsx            # React app mount point
    +-- App.tsx             # Root component with router + layout
    +-- pages/              # One file per navigation section
    |   +-- Dashboard.tsx
    |   +-- History.tsx
    |   +-- Transcript.tsx
    |   +-- CompanyProfile.tsx
    |   +-- SocialMedia.tsx
    |   +-- NewsSebi.tsx
    |   +-- DeepResearch.tsx
    |   +-- Config.tsx
    |   +-- Storage.tsx
    +-- components/
    |   +-- layout/
    |   |   +-- Sidebar.tsx       # Left nav (always visible)
    |   |   +-- CopilotPanel.tsx  # Right chat panel (always visible)
    |   |   +-- Topbar.tsx        # Page header with title + actions
    |   +-- ui/
    |   |   +-- Button.tsx        # Primary, secondary, compact variants
    |   |   +-- Card.tsx          # Base card with optional accent border
    |   |   +-- MetricCard.tsx    # Dashboard KPI card
    |   |   +-- Badge.tsx         # Status badge / nav counter
    |   |   +-- Toast.tsx         # Fixed bottom notification
    |   |   +-- Tabs.tsx          # Tab switcher
    |   |   +-- DropZone.tsx      # File upload area
    |   |   +-- StatusDot.tsx     # Online/offline indicator dot
    |   +-- chat/
    |       +-- ChatLog.tsx       # Message list
    |       +-- ChatMessage.tsx   # Single message bubble
    |       +-- ChatComposer.tsx  # Input + send button
    +-- store/
    |   +-- index.ts            # Zustand store root
    |   +-- slices/
    |       +-- projectsSlice.ts
    |       +-- jobsSlice.ts
    |       +-- chatSlice.ts
    |       +-- uiSlice.ts
    +-- api/
    |   +-- client.ts           # Base fetch wrapper (handles errors, JSON)
    |   +-- projects.ts         # /projects endpoints
    |   +-- pipeline.ts         # /pipeline endpoints
    |   +-- jobs.ts             # /jobs endpoints
    |   +-- copilot.ts          # /copilot endpoints
    |   +-- news.ts             # /news endpoints
    |   +-- rag.ts              # /rag endpoints
    |   +-- sessions.ts         # /sessions endpoints
    +-- styles/
    |   +-- index.css           # Design system tokens + global reset
    |   +-- components.css      # Shared component styles
    +-- types/
        +-- api.ts              # TypeScript types for all API responses
        +-- store.ts            # TypeScript types for Zustand store
```

---

## 3. Design System

All visual decisions are derived from `docs/design/design_airtable.md`.
Do NOT invent new colors, radii, or spacing values. Use the tokens below.

### 3.1 Color Tokens (CSS Custom Properties)

```css
:root {
  /* Canvas & Surface */
  --canvas: #f8f7f1;
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --surface-strong: #e0e2e6;

  /* Text */
  --ink: #181d26;
  --body: #333840;
  --muted: #41454d;
  --on-primary: #ffffff;

  /* Brand */
  --primary: #181d26;
  --primary-active: #0d1218;
  --link: #1b61c9;

  /* Borders */
  --hairline: #dddddd;

  /* Signature Cards */
  --coral: #aa2d00;
  --forest: #0a2e0e;
  --cream: #f5e9d4;
  --surface-dark: #181d26;

  /* Demo Grid */
  --peach: #fcab79;
  --mint: #a8d8c4;
  --yellow: #f4d35e;
  --mustard: #d9a441;

  /* Semantic */
  --success: #006400;
  --warning: #a15c00;
  --danger: #a42318;
  --info: #254fad;
  --info-border: #458fff;

  /* Radius Scale */
  --radius-xs: 2px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-pill: 9999px;
  --radius-full: 50%;

  /* Spacing */
  --space-xxs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;
  --space-section: 96px;

  /* Layout */
  --sidebar-width: 256px;
  --copilot-width: 430px;
}

/* Dark Mode */
[data-theme="dark"] {
  --canvas: #111318;
  --surface: #1a1d24;
  --surface-strong: #232a32;
  --ink: #f4f6f8;
  --body: #d8dee6;
  --muted: #9aa4b2;
  --hairline: #323a45;
  --primary: #f4f6f8;
  --primary-active: #ffffff;
  --on-primary: #101418;
  --cream: #2b271e;
}
```

### 3.2 Typography

```css
body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.25;
  color: var(--body);
}

/* Scale */
/* display-xl: 48px / 500 weight / 1.1 line-height */
/* display-lg: 40px / 400 weight / 1.2 */
/* display-md: 32px / 400 weight / 1.2 */
/* title-lg:   24px / 400 weight / 1.35 / 0.12px letter-spacing */
/* title-md:   20px / 400 weight / 1.5 */
/* title-sm:   18px / 500 weight / 1.4 */
/* label-md:   16px / 500 weight / 1.4 */
/* button:     16px / 500 weight / 1.4 */
/* body-md:    14px / 400 weight / 1.25 */
/* caption:    14px / 500 weight / 1.35 / 0.16px letter-spacing */
```

### 3.3 Component Rules

**Buttons:**
- Primary: `background: var(--primary)`, `color: var(--on-primary)`, `border-radius: var(--radius-lg)`
- Secondary: `background: var(--canvas)`, `border: 1px solid var(--hairline)`, same radius
- One primary button per viewport — scarcity is intentional
- Minimum height: 42px (48px touch target on mobile)

**Cards:**
- Default: `border: 1px solid var(--hairline)`, `border-radius: var(--radius-md)`, `background: var(--surface)`
- Signature: full-bleed coral/forest/dark — `border-radius: var(--radius-lg)`, `padding: var(--space-xxl)`
- Metric: colored top border (4px) for accent variant

**Layout:**
- Three-column grid: `[var(--sidebar-width)] 1fr [var(--copilot-width)]`
- Sidebar and Copilot are ALWAYS visible (not toggled)
- Main content area scrolls independently

---

## 4. Layout Architecture

```
+------------------+----------------------------+--------------------+
|   SIDEBAR        |      MAIN CONTENT          |   COPILOT          |
|   256px fixed    |      flex-grow             |   430px fixed      |
|   (always shown) |      (scrollable)          |   (always shown)   |
|                  |                            |                    |
| - Brand          | - Topbar (title + actions) | - Chat log         |
| - Nav groups     | - Page content (panels)    | - FAQ shortcuts    |
| - Theme toggle   |                            | - Composer input   |
+------------------+----------------------------+--------------------+
```

**Responsive breakpoints:**
- `< 1180px`: Copilot moves below main (full-width, 2-col grid)
- `< 820px`: All panels stack vertically, hamburger nav

---

## 5. Pages — Complete List

| Component | Route | API calls | Status |
|-----------|-------|-----------|--------|
| Dashboard.tsx | `/` | `GET /health`, `GET /projects`, `GET /jobs`, `GET /news/monitors` | To build |
| History.tsx | `/history` | `GET /jobs` | To build |
| Transcript.tsx | `/transcript` | `POST /ingest/transcripts/local`, `POST /ingest/google-drive` | To build |
| CompanyProfile.tsx | `/company` | `POST /pipeline/run` (agent1 only) | To build |
| SocialMedia.tsx | `/social` | `POST /pipeline/run` (reddit/youtube) | To build |
| NewsSebi.tsx | `/news` | `GET /news/monitors`, `POST /news/monitors` | To build |
| DeepResearch.tsx | `/deep` | `POST /pipeline/run` (full pipeline) | To build |
| Config.tsx | `/config` | `GET /config/app`, `POST /config/app`, `GET /config/drive` | To build |
| Storage.tsx | `/storage` | `GET /projects`, `GET /projects/{name}` | To build |

Plus the persistent **CopilotPanel** (right sidebar):
- Uses: `POST /copilot/rag` for Q&A
- Uses: `GET /sessions/{project}` for history
- Maintains its own local chat state in Zustand

---

## 6. State Management (Zustand)

```typescript
// store/index.ts — top-level store shape
interface AppStore {
  // Projects
  projects: Project[];
  activeProject: string | null;
  
  // Jobs
  jobs: Job[];
  pollingJobId: string | null;
  
  // Chat (Copilot)
  chatMessages: ChatMessage[];
  chatProject: string | null;
  chatProvider: string;
  
  // UI
  theme: 'light' | 'dark';
  activePage: string;
  toast: { message: string; visible: boolean };
}
```

**Rules:**
- Store lives in Zustand, NOT in React component state (for anything shared across pages)
- Local component state (form inputs, hover) stays in `useState`
- No prop-drilling more than 2 levels deep — use the store

---

## 7. API Client Pattern

```typescript
// api/client.ts — base pattern
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// Usage example
export const getProjects = () => apiFetch<ProjectsResponse>('/projects');
export const runPipeline = (body: PipelineRunRequest) =>
  apiFetch<JobResponse>('/pipeline/run', { method: 'POST', body: JSON.stringify(body) });
```

**Vite proxy config** (vite.config.ts) routes `/api` to `localhost:8000` in dev:
```typescript
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000', rewrite: (path) => path.replace(/^\/api/, '') }
  }
}
```

---

## 8. Build & Deploy Flow

```
frontend/src/  ->  npm run build  ->  frontend/dist/
                                            |
                                     copy to backend/static/
                                            |
                               FastAPI serves static files
                               + React Router handles /path/*
```

In production, FastAPI's `catch_all` route returns `index.html` for any path,
which lets React Router handle client-side navigation.

**Dev workflow:**
```bash
# Terminal 1 — backend
uvicorn backend.app:app --reload --port 8000

# Terminal 2 — frontend  
cd frontend && npm run dev   # runs on port 5173, proxies API to 8000
```

---

## 9. Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `MetricCard.tsx` |
| Hooks | camelCase + use prefix | `useProjects.ts` |
| API functions | camelCase verb+noun | `getProjects`, `runPipeline` |
| CSS classes | kebab-case | `.metric-card`, `.nav-button` |
| Store slices | camelCase | `projectsSlice.ts` |
| Pages | PascalCase | `Dashboard.tsx` |
| Types | PascalCase | `Project`, `Job`, `ChatMessage` |

---

## 10. Migration Approach from Vanilla HTML

The original `backend/static/index.html` is a 1787-line single-file SPA.
Migration strategy: **page-by-page, bottom-up**.

### Priority Order
1. **Layout shell** (Sidebar + Topbar + CopilotPanel) — all pages share this
2. **Dashboard** — first meaningful page users see
3. **Copilot sidebar** — high-value, used from every page
4. **History** — simple list, good for testing API integration
5. **Deep Research** — most-used action page (pipeline launcher)
6. **Remaining pages** — Transcript, Company, Social, News, Config, Storage

### Porting Rules
- Preserve all existing API calls exactly (method, path, body shape)
- Do not change any FastAPI endpoint contracts
- Keep same UX flows — do not redesign features, only re-implement in React
- Add TypeScript types for every API response

---

## 11. Environment Variables

```bash
# .env (frontend/.env)
VITE_API_URL=http://localhost:8000    # local dev (change for staging/prod)
```

```bash
# .env.production (frontend/.env.production)
VITE_API_URL=https://your-backend.railway.app
```

---

## 12. Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Vite over CRA | Faster HMR, better DX, modern toolchain | 2026-06-26 |
| TypeScript over JS | Type safety, better IDE support for team | 2026-06-26 |
| Zustand over Redux | Less boilerplate for internal tool scale | 2026-06-26 |
| React Router over file-based routing | Simpler, no Next.js needed | 2026-06-26 |
| CSS custom props over Tailwind | Must follow design_airtable.md tokens exactly | 2026-06-26 |
| Sidebar always visible | Original design intent — critical for copilot access | 2026-06-26 |
