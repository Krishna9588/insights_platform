# Insights Platform — Codebase Structure

> **Purpose of this document:** Audit the current folder layout, call out what needs to be archived vs. kept, and define the clean target structure that will support a production-grade multi-tenant research platform with a proper database, RAG, and hosting layer.

---

## 1. Current Structure (As-Is)

```
insights_platform/
|
+-- .env.example                  # KEEP -- template for secrets
+-- .gitignore                    # KEEP -- needs minor updates
+-- .ignore                       # WARN -- Redundant with .gitignore, review & merge
+-- ARCHITECTURE.md               # KEEP -- core technical doc, move to /docs
+-- conceptual_diagram.md         # DELETE -- empty file
+-- design_airtable.md            # KEEP -- UI design system doc, move to /docs/design
+-- info.md                       # WARN -- near-duplicate of instructions_details.md
|                                 #    ALSO contains a leaked API key on line 3 -> REVOKE IMMEDIATELY
+-- instructions_details.md       # WARN -- near-duplicate of info.md -- merge, then archive
+-- plan.md                       # KEEP -- active roadmap, move to /docs
+-- requirements.txt              # KEEP at root -- standard Python practice
+-- archive.zip                   # DELETE -- binary blob in repo
+-- pipeline_v2.py                # WARN -- root-level pipeline runner; duplicate exists inside /agents
|                                 #    Move to /agents/ as canonical, delete the duplicate
|
+-- agents/                       # Core AI agent pipeline
|   +-- __init__.py
|   +-- agent1_orchestrator.py    # ACTIVE -- scrape & consolidate
|   +-- agent2_insight.py         # ACTIVE -- insight extraction
|   +-- agent3_synthesis.py       # ACTIVE -- synthesis
|   +-- agent4_brief.py           # ACTIVE -- product briefs
|   +-- agent5_copilot.py         # ACTIVE -- copilot query handler
|   +-- model_connect.py          # ACTIVE -- unified LLM interface
|   +-- paths.py                  # ACTIVE -- canonical path registry
|   +-- path.py                   # SHIM -- compatibility shim, schedule for removal
|   +-- pipeline_v2.py            # ARCHIVE -- DUPLICATE of root pipeline_v2.py
|   +-- test_llm.py               # MOVE -- dev script, move to /scripts
|
+-- backend/                      # FastAPI application
|   +-- __init__.py
|   +-- app.py                    # ACTIVE -- FastAPI entry point
|   +-- schemas.py                # ACTIVE -- Pydantic request/response models
|   +-- services.py               # ACTIVE -- business logic & job management
|   +-- routes/
|   |   +-- __init__.py
|   |   +-- chat.py               # ACTIVE
|   |   +-- config.py             # ACTIVE
|   |   +-- copilot.py            # ACTIVE
|   |   +-- jobs.py               # ACTIVE
|   |   +-- news.py               # ACTIVE
|   |   +-- projects.py           # ACTIVE
|   |   +-- rag.py                # ACTIVE
|   |   +-- research.py           # ACTIVE
|   |   +-- summaries.py          # ACTIVE
|   +-- static/
|       +-- assets/
|       |   +-- index-BJn0v8Vt.css    # TEMP -- hashed build artifact, replaced by React build
|       |   +-- index-ChDfYcot.js     # TEMP -- hashed build artifact, replaced by React build
|       +-- index.html                # ACTIVE but will be replaced by React
|       +-- frontend_backup.html      # ARCHIVE -- old backup
|       +-- frontend_backup_2.html    # ARCHIVE -- old backup (same size as index.html!)
|       +-- dummy_project.json        # MOVE -- dev fixture, move to /tests/fixtures
|
+-- core/                         # Core shared services
|   +-- __init__.py
|   +-- analyzer.py               # WARN -- DUPLICATE of scrapers/analyzer.py (~10.8KB each)
|   +-- api_run.py                # REVIEW -- unknown usage, needs investigation
|   +-- copilot_service.py        # ACTIVE -- copilot business logic
|   +-- database.py               # ACTIVE -- SQLite ORM layer
|   +-- drive_config.py           # ACTIVE -- Google Drive config
|   +-- pipeline.py               # ARCHIVE -- THIRD pipeline file, likely old/unused
|   +-- rag_service.py            # ACTIVE -- RAG orchestration
|   +-- summary_generator.py      # ACTIVE -- daily summary generation
|   +-- vector_db.py              # ACTIVE -- local ChromaDB vector store
|
+-- scrapers/                     # Data source connectors
|   +-- agent1_internal_cloud.py  # ACTIVE -- internal transcript ingestion
|   +-- analyzer.py               # WARN -- DUPLICATE of core/analyzer.py
|   +-- app_store.py              # ACTIVE
|   +-- company_profile.py        # ACTIVE (largest file: 47KB)
|   +-- google_drive.py           # ACTIVE
|   +-- internal.py               # ACTIVE -- local transcript processor
|   +-- play_store.py             # ACTIVE (largest file: 54KB)
|   +-- reddit.py                 # ACTIVE
|   +-- youtube.py                # ACTIVE
|
+-- data/                         # Runtime data (gitignored content)
|   +-- state/
|       +-- config.json           # Runtime config
|       +-- jobs.json             # Job state persistence
|       +-- news_monitors.json    # News monitor config
|
+-- scripts/                      # Utility & dev scripts
|   +-- smoke_test.py             # ACTIVE -- integration smoke test
|
+-- agents/database_mock/         # MISNAMED & MISPLACED
    +-- {project_name}/           # This is actual project research data storage
        +-- db_document.json      # Should be /data/projects/{project_name}/
        +-- raw/                  # Naming is confusing for a production system
```

---

## 2. Problems Identified

### CRITICAL
| # | Issue | File(s) | Action |
|---|-------|---------|--------|
| 1 | **Leaked API Key in repo** | `instructions_details.md` line 3 | **Revoke key immediately**, remove from file, rotate |
| 2 | **Duplicate pipeline files** | `pipeline_v2.py` (root), `agents/pipeline_v2.py`, `core/pipeline.py` | Keep one canonical version, archive rest |
| 3 | **Duplicate analyzer** | `core/analyzer.py`, `scrapers/analyzer.py` | Merge into one, update all imports |

### STRUCTURAL ISSUES
| # | Issue | File(s) | Action |
|---|-------|---------|--------|
| 4 | **Misnamed data directory** | `agents/database_mock/` | Rename to `data/projects/` |
| 5 | **Backup HTMLs polluting static** | `frontend_backup.html`, `frontend_backup_2.html` | Move to `_archive/` |
| 6 | **Dev scripts inside agent package** | `agents/test_llm.py` | Move to `scripts/` |
| 7 | **Compatibility shim creating confusion** | `agents/path.py` | Schedule for removal after import cleanup |
| 8 | **`core/api_run.py` unknown purpose** | `core/api_run.py` | Review, move to scripts or delete |
| 9 | **Empty file** | `conceptual_diagram.md` | Delete |
| 10 | **Near-duplicate docs with leaked key** | `info.md` vs `instructions_details.md` | Merge into `docs/meeting_notes.md`, archive originals |
| 11 | **Binary blob in repo** | `archive.zip` | Extract useful parts, gitignore zips, delete |

### DOCUMENTATION GAPS
| # | Issue | File(s) | Action |
|---|-------|---------|--------|
| 12 | **Docs scattered at root** | `ARCHITECTURE.md`, `plan.md`, `design_airtable.md` | Move to `/docs/` |
| 13 | **No README at root** | — | Create `README.md` with setup instructions |
| 14 | **No `CHANGELOG.md`** | — | Create for tracking major changes |

---

## 3. Proposed New Structure (Target State)

Design principles:
- All runtime-generated data lives under `/data/` (gitignored)
- All documentation lives under `/docs/`
- All tests live under `/tests/`
- The frontend moves to `/frontend/` as a standalone React/Vite app
- The backend remains a FastAPI service with cleaner internal layout
- Archive preserves old code without polluting active namespaces
- Structure supports Supabase migration, Docker deployment, and multi-environment config

```
insights_platform/
|
+-- README.md                     # [NEW] Setup, local dev, deployment guide
+-- .env.example                  # Updated with all env vars
+-- .gitignore                    # Updated -- exclude /data/projects, zips, build dirs
+-- requirements.txt              # Keep for now; future: split into requirements/
+-- Makefile                      # [NEW] Common commands: make dev, make test, make lint
+-- structure.md                  # This file
|
+-- docs/                         # [NEW] All project documentation
|   +-- ARCHITECTURE.md           # Moved from root
|   +-- plan.md                   # Moved from root -- roadmap & phases
|   +-- CHANGELOG.md              # [NEW] Version history
|   +-- design/
|   |   +-- design_airtable.md    # Moved from root -- UI design system
|   +-- meeting_notes.md          # Merged from info.md + instructions_details.md
|
+-- backend/                      # FastAPI application (minimal changes)
|   +-- app.py                    # Entry point
|   +-- schemas.py                # Pydantic models
|   +-- services.py               # Business logic & job management
|   +-- routes/                   # API route handlers (all files kept as-is)
|   |   +-- chat.py
|   |   +-- config.py
|   |   +-- copilot.py
|   |   +-- jobs.py
|   |   +-- news.py
|   |   +-- projects.py
|   |   +-- rag.py
|   |   +-- research.py
|   |   +-- summaries.py
|   +-- static/                   # Populated by frontend build output
|       +-- .gitkeep
|
+-- frontend/                     # [NEW] Standalone React/Vite app
|   +-- package.json
|   +-- vite.config.ts
|   +-- tsconfig.json
|   +-- index.html
|   +-- src/
|       +-- main.tsx
|       +-- App.tsx
|       +-- pages/
|       |   +-- Dashboard.tsx
|       |   +-- Project.tsx
|       |   +-- Copilot.tsx
|       |   +-- History.tsx
|       |   +-- NewsMonitor.tsx
|       |   +-- DriveConfig.tsx
|       |   +-- Pipeline.tsx
|       +-- components/
|       |   +-- layout/
|       |   +-- cards/
|       |   +-- ui/
|       +-- store/                # State management (Zustand)
|       +-- api/                  # API client layer
|       +-- styles/
|           +-- index.css         # Design system tokens from design_airtable.md
|
+-- agents/                       # AI pipeline agents
|   +-- __init__.py
|   +-- paths.py                  # Canonical path registry
|   +-- model_connect.py          # Unified LLM interface
|   +-- pipeline.py               # [RENAMED] Single canonical pipeline runner
|   +-- agent1_orchestrator.py    # Research ingestion & scraping orchestration
|   +-- agent2_insight.py         # Insight extraction
|   +-- agent3_synthesis.py       # Synthesis
|   +-- agent4_brief.py           # Product brief generation
|   +-- agent5_copilot.py         # Copilot query interface
|
+-- scrapers/                     # Data source connectors
|   +-- __init__.py
|   +-- base.py                   # [NEW] Abstract base class for scrapers
|   +-- company_profile.py
|   +-- play_store.py
|   +-- app_store.py
|   +-- reddit.py
|   +-- youtube.py
|   +-- google_drive.py
|   +-- internal.py               # Local transcript ingestion
|   +-- agent1_internal_cloud.py  # Internal cloud transcript ingestion
|
+-- core/                         # Shared services & utilities
|   +-- __init__.py
|   +-- analyzer.py               # [MERGED] Single canonical analyzer
|   +-- database.py               # SQLite ORM (migrating to Supabase)
|   +-- drive_config.py           # Google Drive credentials
|   +-- rag_service.py            # RAG orchestration
|   +-- vector_db.py              # ChromaDB (migrating to Supabase pgvector)
|   +-- copilot_service.py        # Copilot logic
|   +-- summary_generator.py      # Daily chat summarization
|
+-- data/                         # Runtime data (ALL gitignored below)
|   +-- .gitignore                # [NEW] Gitignore everything inside
|   +-- projects/                 # [RENAMED from agents/database_mock]
|   |   +-- {project_name}/
|   |       +-- db_document.json  # Consolidated research output
|   |       +-- raw/              # Raw scraper outputs
|   +-- sessions/                 # Chat session files
|   +-- summaries/                # Daily summary markdown files
|   +-- vectors/                  # Local ChromaDB vector data
|   +-- transcripts/              # [RENAMED from transcript_input/]
|   +-- state/
|       +-- config.json
|       +-- jobs.json
|       +-- news_monitors.json
|
+-- tests/                        # [NEW] Proper test structure
|   +-- conftest.py               # Shared fixtures
|   +-- unit/
|   |   +-- test_agents.py
|   |   +-- test_scrapers.py
|   |   +-- test_rag.py
|   +-- integration/
|   |   +-- test_api.py           # API integration tests
|   +-- fixtures/
|       +-- dummy_project.json    # Moved from backend/static/
|
+-- scripts/                      # Dev & ops utility scripts
|   +-- smoke_test.py             # Existing integration smoke test
|   +-- test_llm.py               # Moved from agents/
|   +-- migrate_db.py             # [NEW] DB migration helper
|   +-- seed_data.py              # [NEW] Load sample project data
|   +-- deploy_check.py           # [NEW] Pre-deployment environment validation
|
+-- infra/                        # [NEW] Deployment & infrastructure config
|   +-- docker/
|   |   +-- Dockerfile.backend
|   |   +-- Dockerfile.frontend
|   |   +-- docker-compose.yml    # Local full-stack dev setup
|   +-- supabase/
|   |   +-- migrations/           # SQL migration files
|   |   +-- seed.sql              # Initial schema seed
|   +-- hosting/
|       +-- README.md             # Deployment guides (Hostinger, Railway, Vercel)
|
+-- _archive/                     # [NEW] Archived code -- preserved, not active
    +-- README.md                 # Explains what is archived here and why
    +-- pipeline_v2_agents.py     # agents/pipeline_v2.py (duplicate)
    +-- pipeline_core.py          # core/pipeline.py (third pipeline version)
    +-- frontend_backup.html      # backend/static/frontend_backup.html
    +-- frontend_backup_2.html    # backend/static/frontend_backup_2.html
    +-- path_shim.py              # agents/path.py (after imports fixed)
    +-- info_raw.md               # info.md (after merging into docs)
    +-- instructions_raw.md       # instructions_details.md (after merging)
```

---

## 4. Key Changes Explained

### 4.1 `agents/database_mock/` becomes `data/projects/`
The name `database_mock` made sense during prototyping but is misleading in a product.
This directory holds real scraped research data, not mock data. Moving it to `data/projects/`
consolidates all runtime data under one gitignored root and signals production intent.

### 4.2 Three Pipeline Files become One
Three versions of the pipeline runner exist:
- `pipeline_v2.py` (root) -- most complete version, has CLI args
- `agents/pipeline_v2.py` -- near-identical, has try/except for ModuleNotFoundError
- `core/pipeline.py` -- likely an older version, needs review

Resolution: Merge the best parts into `agents/pipeline.py` (single canonical), archive the rest.

### 4.3 Duplicate `analyzer.py` merged into `core/`
`core/analyzer.py` and `scrapers/analyzer.py` are ~10.8KB each — almost certainly identical.
The canonical version belongs in `core/` since it is used by `scrapers/play_store.py` and
`scrapers/app_store.py`. After confirming they are identical: remove `scrapers/analyzer.py`
and update the two scraper imports to use `core.analyzer`.

### 4.4 `frontend/` as Standalone Vite + React App
The current vanilla HTML/JS in `backend/static/index.html` will be replaced by a React/Vite
app built from `/frontend/src/`. The compiled `dist/` output is what gets copied to
`backend/static/` for FastAPI to serve. The design system tokens from `design_airtable.md`
will be translated into CSS custom properties in `frontend/src/styles/index.css`.

### 4.5 `infra/` for Production Readiness
Adding a dedicated `infra/` layer to hold:
- Docker Compose for local full-stack development (backend + frontend + Redis + ChromaDB)
- Supabase migration files for the planned PostgreSQL/pgvector migration
- Deployment guides for Hostinger (backend), Vercel (frontend), Supabase (DB)

### 4.6 `requirements/` Split Strategy (future)
The current `requirements.txt` includes heavy ML libraries (torch, transformers) alongside
lightweight API tools. Future split:
- `requirements/base.txt`  -- runtime production dependencies (FastAPI, scrapers, LLM SDKs)
- `requirements/dev.txt`   -- testing, linting, local dev tools
- `requirements/ml.txt`    -- heavy ML deps (torch, sentence-transformers) -- optional for local RAG

---

## 5. Migration Checklist

Execute in this order to avoid breaking the running application:

- [ ] 1.  Revoke leaked API key (instructions_details.md line 3) and rotate in .env
- [ ] 2.  Diff core/analyzer.py vs scrapers/analyzer.py -- confirm they are identical
- [ ] 3.  Merge analyzer -- update play_store.py + app_store.py imports to use core.analyzer
- [ ] 4.  Create _archive/ folder with README.md
- [ ] 5.  Archive duplicate pipelines: agents/pipeline_v2.py + core/pipeline.py -> _archive/
- [ ] 6.  Archive frontend backups: frontend_backup*.html -> _archive/
- [ ] 7.  Archive info.md + instructions_details.md -> _archive/ (after merging)
- [ ] 8.  Rename agents/database_mock/ -> data/projects/ and update agents/paths.py
- [ ] 9.  Move transcript_input/ -> data/transcripts/ and update agents/paths.py
- [ ] 10. Create docs/ folder and move ARCHITECTURE.md, plan.md, design_airtable.md into it
- [ ] 11. Merge info.md + instructions_details.md into docs/meeting_notes.md
- [ ] 12. Delete empty conceptual_diagram.md
- [ ] 13. Move agents/test_llm.py -> scripts/test_llm.py
- [ ] 14. Move backend/static/dummy_project.json -> tests/fixtures/
- [ ] 15. Create tests/ folder structure (unit/, integration/, fixtures/)
- [ ] 16. Create root README.md with setup + run instructions
- [ ] 17. Create Makefile with common dev commands
- [ ] 18. Create data/.gitignore that ignores everything in /data/
- [ ] 19. Update root .gitignore to reflect new path names
- [ ] 20. Create infra/docker/docker-compose.yml skeleton for local dev

---

## 6. Production Readiness — Current vs. Target

| Concern | Current State | Target |
|---------|--------------|--------|
| **Database** | SQLite (insights.db) + JSON files | Supabase (PostgreSQL + pgvector) |
| **Vector Store** | Local ChromaDB | Supabase pgvector extension |
| **Job Queue** | Background asyncio + jobs.json | Celery + Redis (or Supabase Edge Functions) |
| **Frontend** | Vanilla HTML/JS in backend/static/ | React/Vite app in frontend/ |
| **Auth** | None (single-team tool) | Supabase Auth when multi-user needed |
| **Hosting** | Local/dev only | Backend on Railway/Hostinger, Frontend on Vercel |
| **Config** | Env vars via .env | Same, validated via pydantic-settings |
| **Observability** | Basic Python logging | Structured logging + Sentry (later) |
| **CI/CD** | None | GitHub Actions -- lint, test, build, deploy |
