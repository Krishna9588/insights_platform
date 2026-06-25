from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from core.database import get_db


router = APIRouter()


@router.post("/chat/session/create")
def create_chat_session(project_name: str) -> Dict[str, Any]:
    """Create a new chat session for a project."""
    try:
        db = get_db()
        session_id = db.create_session(project_name)
        return {
            "session_id": session_id,
            "project_name": project_name,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions/{project_name}")
def list_chat_sessions(project_name: str) -> Dict[str, Any]:
    """List all chat sessions for a project."""
    try:
        db = get_db()
        sessions = db.list_project_sessions(project_name)
        return {
            "project_name": project_name,
            "sessions": [
                {
                    "session_id": s.id,
                    "created_at": s.created_at,
                    "updated_at": s.updated_at,
                    "messages_count": s.messages_count,
                    "is_active": s.is_active,
                }
                for s in sessions
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions/{project_name}/{session_id}")
def get_chat_session(project_name: str, session_id: str) -> Dict[str, Any]:
    """Get messages for a specific chat session."""
    try:
        db = get_db()
        session = db.get_session(session_id)
        if not session or session.project_name != project_name:
            raise HTTPException(status_code=404, detail="Session not found")

        messages = db.get_session_messages(session_id)
        return {
            "session_id": session_id,
            "project_name": project_name,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.timestamp,
                }
                for m in messages
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
