from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from core.database import get_db
from core.summary_generator import summarize_daily_chats


router = APIRouter()


@router.post("/summaries/{project_name}/trigger")
def trigger_daily_summary(project_name: str, provider: str = "gemini") -> Dict[str, Any]:
    """Manually trigger daily summary generation."""
    try:
        summary = summarize_daily_chats(project_name, provider=provider)
        if summary:
            return {
                "status": "success",
                "project_name": project_name,
                "summary_preview": summary[:200],
            }
        return {
            "status": "no_messages",
            "project_name": project_name,
            "message": "No messages to summarize",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summaries/{project_name}/latest")
def get_latest_summary(project_name: str) -> Dict[str, Any]:
    """Get the latest daily summary for a project."""
    try:
        db = get_db()
        summary = db.get_latest_summary(project_name)
        if not summary:
            return {
                "project_name": project_name,
                "summary": None,
                "message": "No summaries yet",
            }
        return {
            "project_name": project_name,
            "date": summary.date,
            "summary": summary.summary_md,
            "messages_count": summary.messages_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summaries/{project_name}/{date_str}")
def get_summary_by_date(project_name: str, date_str: str) -> Dict[str, Any]:
    """Get summary for a specific date (format: YYYY-MM-DD)."""
    try:
        db = get_db()
        summary = db.get_summary(project_name, date_str)
        if not summary:
            return {
                "project_name": project_name,
                "date": date_str,
                "summary": None,
            }
        return {
            "project_name": project_name,
            "date": date_str,
            "summary": summary.summary_md,
            "messages_count": summary.messages_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
