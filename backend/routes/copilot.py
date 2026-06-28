from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from agents.agent5_copilot import ask_copilot
from backend.schemas import CopilotRequest, GroundedCopilotRequest, ChatAskRequest
from backend.services import answer_with_rag
from core.copilot_service import create_copilot
from core.database import get_db


router = APIRouter()


@router.post("/copilot/ask")
def copilot_ask(req: CopilotRequest) -> Dict[str, Any]:
    try:
        answer, history = ask_copilot(
            project_name=req.project_name,
            question=req.question,
            provider=req.provider,
            conversation_history=req.history,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"answer": answer, "history": history}


@router.post("/copilot/rag")
def copilot_rag(req: GroundedCopilotRequest) -> Dict[str, Any]:
    """Answer from retrieved evidence and return grounding metadata."""
    try:
        result = answer_with_rag(
            question=req.question,
            project_name=req.project_name,
            provider=req.provider,
            limit=req.limit,
            use_llm=req.use_llm,
        )
        log_id = get_db().log_copilot_question(
            project_name=req.project_name,
            question=req.question,
            answer=result["answer"],
            confidence=result["grounding"]["confidence"],
            source_count=len(result["sources"]),
        )
        return {
            "question": req.question,
            "project_name": req.project_name,
            "question_log_id": log_id,
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/copilot/questions")
def list_copilot_questions(project_name: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    """List recent Copilot questions for later FAQ/pattern analysis."""
    try:
        questions = get_db().list_copilot_questions(project_name=project_name, limit=limit)
        return {
            "questions": [
                {
                    "id": item.id,
                    "project_name": item.project_name,
                    "question": item.question,
                    "answer_preview": item.answer_preview,
                    "confidence": item.confidence,
                    "source_count": item.source_count,
                    "created_at": item.created_at,
                }
                for item in questions
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/ask")
def chat_ask(req: ChatAskRequest) -> Dict[str, Any]:
    """Ask a question in a chat session with persistent memory."""
    try:
        copilot = create_copilot(req.project_name, req.provider)
        answer, session_id = copilot.ask(req.question, req.session_id)
        # Get the latest title for the session
        sessions = copilot.get_all_sessions()
        title = "New Chat"
        for s in sessions:
            if s["session_id"] == session_id:
                title = s["title"]
                break
                
        return {
            "session_id": session_id,
            "title": title,
            "question": req.question,
            "answer": answer,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/sessions")
def get_chat_sessions(project_name: str) -> Dict[str, Any]:
    """List all chat sessions for a project."""
    try:
        copilot = create_copilot(project_name)
        sessions = copilot.get_all_sessions()
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/history")
def get_chat_history(project_name: str, session_id: str) -> Dict[str, Any]:
    """Get message history for a specific chat session."""
    try:
        copilot = create_copilot(project_name)
        history = copilot.get_session_history(session_id)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/history/all")
def get_all_chat_history(project_name: str) -> Dict[str, Any]:
    """Get message history for all chat sessions of a project, sorted by most recent."""
    try:
        copilot = create_copilot(project_name)
        sessions = copilot.get_all_sessions()
        all_history = []
        for session in sessions:
            history = copilot.get_session_history(session["session_id"])
            # Format into query/result pairs
            pairs = []
            for i in range(0, len(history) - 1, 2):
                if history[i]["role"] == "user" and history[i+1]["role"] == "assistant":
                    pairs.append({
                        "session_id": session["session_id"],
                        "title": session["title"],
                        "timestamp": history[i].get("timestamp") or session.get("updated_at"),
                        "question": history[i]["content"],
                        "answer": history[i+1]["content"]
                    })
            all_history.extend(pairs)
        
        # Sort by timestamp descending
        all_history.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        return {"history": all_history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
