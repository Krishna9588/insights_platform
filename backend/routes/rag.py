from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from backend.schemas import RAGIndexRequest, RAGSearchRequest
from core.rag_service import get_rag_service


router = APIRouter()


@router.get("/rag/status")
def rag_status() -> Dict[str, Any]:
    """Inspect local RAG index health and indexed projects."""
    try:
        return get_rag_service().status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/index")
def rag_index(req: RAGIndexRequest) -> Dict[str, Any]:
    """Index one project, or all projects when project_name is omitted."""
    try:
        rag = get_rag_service()
        if req.project_name:
            return rag.index_project(req.project_name)
        return rag.index_all_projects()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/search")
def rag_search(req: RAGSearchRequest) -> Dict[str, Any]:
    """Search stored project evidence."""
    try:
        rag = get_rag_service()
        chunks = rag.search(req.query, project_name=req.project_name, limit=req.limit)
        return {
            "query": req.query,
            "project_name": req.project_name,
            "results": [rag.chunk_to_dict(chunk) for chunk in chunks],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
