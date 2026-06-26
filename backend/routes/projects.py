from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from agents.paths import DB_ROOT, project_db_path
from backend.services import read_json


router = APIRouter()


@router.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "insights-platform-api"}


@router.get("/projects")
def list_projects() -> Dict[str, Any]:
    projects = []
    if DB_ROOT.exists():
        for db_file in sorted(DB_ROOT.glob("*/db_document.json")):
            doc = read_json(db_file, {})
            projects.append({
                "project_name": doc.get("project_name") or db_file.parent.name,
                "domain": doc.get("domain"),
                "updated_at": doc.get("ingestion_date"),
                "processing_status": doc.get("processing_status", {}),
            })
    return {"projects": projects}


import re

@router.get("/projects/search")
def search_projects(q: str = "") -> Dict[str, Any]:
    if not q:
        return {"results": []}
    
    query = q.lower()
    results = []
    
    def extract_snippet(text: str, match_index: int, context_words: int = 6) -> str:
        words = text.split()
        # Find which word index the match falls into roughly
        char_count = 0
        target_word_idx = 0
        for i, w in enumerate(words):
            char_count += len(w) + 1
            if char_count > match_index:
                target_word_idx = i
                break
        
        start = max(0, target_word_idx - context_words)
        end = min(len(words), target_word_idx + context_words + 1)
        snippet = " ".join(words[start:end])
        return f"...{snippet}..."

    def search_json(data: Any, current_key: str = "") -> str | None:
        if isinstance(data, dict):
            for k, v in data.items():
                res = search_json(v, str(k))
                if res: return res
        elif isinstance(data, list):
            for item in data:
                res = search_json(item, current_key)
                if res: return res
        elif isinstance(data, str):
            # Ignore file paths and urls
            if "path" in current_key.lower() or "url" in current_key.lower() or data.startswith(("C:\\", "/", "http")):
                return None
            idx = data.lower().find(query)
            if idx != -1:
                return extract_snippet(data, idx)
        return None

    if DB_ROOT.exists():
        for db_file in sorted(DB_ROOT.glob("*/db_document.json")):
            doc = read_json(db_file, {})
            snippet = search_json(doc)
            if snippet:
                results.append({
                    "project_name": doc.get("project_name") or db_file.parent.name,
                    "snippet": snippet,
                    "updated_at": doc.get("ingestion_date")
                })
    
    return {"results": results}

@router.get("/projects/{project_name}")
def get_project(project_name: str) -> Dict[str, Any]:
    path = project_db_path(project_name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return read_json(path, {})
