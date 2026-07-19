from __future__ import annotations

import shutil
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from datetime import datetime
from agents.paths import DB_ROOT, SESSIONS_ROOT, SUMMARIES_ROOT, VECTORS_ROOT, project_db_path
from backend.services import read_json, write_json, JOBS_PATH, JOBS_LOCK
from backend.schemas import RequestedDataRequest
from agents.agent5_copilot import ask_copilot

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


@router.post("/projects/requested-data")
def request_fresh_data(req: RequestedDataRequest) -> Dict[str, Any]:
    path = project_db_path(req.project_name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
        
    doc = read_json(path, {})
    
    # Run the copilot with instructions to be structured
    question = f"User has requested specific data: {req.query}. Please provide a structured, detailed answer based on the knowledge base."
    try:
        answer, _ = ask_copilot(
            project_name=req.project_name,
            question=question,
            provider=req.provider,
            conversation_history=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    requested_data = doc.get("requested_data", [])
    requested_data.append({
        "query": req.query,
        "response": answer,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    doc["requested_data"] = requested_data
    write_json(path, doc)
    
    return {"status": "success", "requested_data": requested_data}


@router.delete("/projects/{project_name}")
def delete_project(project_name: str) -> Dict[str, Any]:
    """
    Permanently delete a project and ALL associated data:
    - data/projects/{name}/  (db_document + raw files)
    - data/sessions/{name}/  (chat history)
    - data/summaries/{name}/ (AI summaries)
    - data/vectors/{name}/   (RAG embeddings, if present)
    - Jobs referencing this project are removed from jobs.json
    """
    project_folder = DB_ROOT / project_name
    if not project_folder.exists():
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")

    deleted = []
    errors = []

    # 1. Remove project DB folder (db_document.json + raw/)
    try:
        shutil.rmtree(project_folder)
        deleted.append(str(project_folder))
    except Exception as e:
        errors.append(f"project folder: {e}")

    # 2. Remove sessions
    sessions_dir = SESSIONS_ROOT / project_name
    if sessions_dir.exists():
        try:
            shutil.rmtree(sessions_dir)
            deleted.append(str(sessions_dir))
        except Exception as e:
            errors.append(f"sessions: {e}")

    # 3. Remove summaries
    summaries_dir = SUMMARIES_ROOT / project_name
    if summaries_dir.exists():
        try:
            shutil.rmtree(summaries_dir)
            deleted.append(str(summaries_dir))
        except Exception as e:
            errors.append(f"summaries: {e}")

    # 4. Remove vectors (RAG index)
    vectors_dir = VECTORS_ROOT / project_name
    if vectors_dir.exists():
        try:
            shutil.rmtree(vectors_dir)
            deleted.append(str(vectors_dir))
        except Exception as e:
            errors.append(f"vectors: {e}")

    # 5. Remove from jobs.json
    try:
        with JOBS_LOCK:
            jobs = read_json(JOBS_PATH, {})
            before = len(jobs)
            jobs = {
                jid: j for jid, j in jobs.items()
                if (j.get("payload") or {}).get("project_name") != project_name
                and (j.get("result") or {}).get("project_name") != project_name
            }
            if len(jobs) < before:
                write_json(JOBS_PATH, jobs)
    except Exception as e:
        errors.append(f"jobs cleanup: {e}")

    return {
        "status": "deleted",
        "project_name": project_name,
        "deleted_paths": deleted,
        "errors": errors,
    }
