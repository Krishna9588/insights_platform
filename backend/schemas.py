from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class PipelineRunRequest(BaseModel):
    project_name: str
    provider: str = "gemini"
    domain: Optional[str] = None
    start_from: str = "agent1"
    only: Optional[str] = None
    agent1_payload: Optional[Dict[str, Any]] = None


class LocalTranscriptRequest(BaseModel):
    project_name: str
    input_path: str
    provider: str = "gemini"
    domain: Optional[str] = None
    run_async: bool = True


class GoogleDriveRequest(BaseModel):
    project_name: str
    folder_id: str
    provider: str = "gemini"
    domain: Optional[str] = None
    credentials_path: Optional[str] = None
    token_path: Optional[str] = None
    include_existing: bool = False
    run_async: bool = True


class CopilotRequest(BaseModel):
    project_name: str
    question: str
    provider: str = "gemini"
    history: list[dict] = Field(default_factory=list)


class NewsMonitorRequest(BaseModel):
    name: str
    query: str
    schedule_time: str = "20:00"
    timezone: str = "Asia/Kolkata"
    sources: list[str] = Field(default_factory=lambda: ["news"])
    enabled: bool = True


class ChatMessageRequest(BaseModel):
    session_id: str
    content: str
    role: str = "user"


class ChatSessionRequest(BaseModel):
    project_name: str
    provider: str = "gemini"
    domain: Optional[str] = None
    run_async: bool = True


class RAGIndexRequest(BaseModel):
    project_name: Optional[str] = None


class RAGSearchRequest(BaseModel):
    query: str
    project_name: Optional[str] = None
    limit: int = 8


class GroundedCopilotRequest(BaseModel):
    question: str
    project_name: Optional[str] = None
    provider: str = "gemini"
    limit: int = 8
    use_llm: bool = True


class AppConfigRequest(BaseModel):
    values: Dict[str, Any] = Field(default_factory=dict)
