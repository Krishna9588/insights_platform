from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Keep imports stable when uvicorn is launched from different working dirs.
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.paths import ensure_all_dirs
from backend.routes import chat, config, copilot, jobs, news, projects, rag, research, summaries
from core.database import get_db
from core.drive_config import get_drive_config
from core.rag_service import get_rag_service


STATIC_ROOT = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize app services using FastAPI's supported lifespan API."""
    ensure_all_dirs()
    get_db()
    get_drive_config()
    get_rag_service()
    print("✓ Services initialized: Database, Drive Config, Local RAG")
    yield


app = FastAPI(
    title="Insights Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [
    projects.router,
    research.router,
    copilot.router,
    rag.router,
    jobs.router,
    news.router,
    chat.router,
    config.router,
    summaries.router,
]:
    app.include_router(router)


ASSETS_ROOT = STATIC_ROOT / "assets"
if ASSETS_ROOT.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_ROOT)), name="assets")


@app.get("/")
def frontend() -> FileResponse:
    index_path = STATIC_ROOT / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend not built yet")
    return FileResponse(index_path)


@app.get("/{full_path:path}")
def catch_all(full_path: str) -> FileResponse:
    """Serve index.html for client-side routing after all API routes."""
    index_path = STATIC_ROOT / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not found")
