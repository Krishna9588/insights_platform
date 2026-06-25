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


@router.get("/projects/{project_name}")
def get_project(project_name: str) -> Dict[str, Any]:
    path = project_db_path(project_name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return read_json(path, {})
