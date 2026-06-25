from __future__ import annotations

import asyncio
import inspect
import json
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import BaseModel

from agents.model_connect import call_llm
from agents.paths import STATE_ROOT
from backend.schemas import PipelineRunRequest
from core.rag_service import get_rag_service


JOBS_PATH = STATE_ROOT / "jobs.json"
JOBS_LOCK = threading.Lock()
NEWS_MONITORS_PATH = STATE_ROOT / "news_monitors.json"


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def dump_model(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def slug_id(value: str) -> str:
    safe = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    return safe or str(uuid.uuid4())


def create_job(kind: str, payload: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
        jobs[job_id] = {
            "id": job_id,
            "kind": kind,
            "status": "queued",
            "payload": payload,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "result": None,
            "error": None,
        }
        write_json(JOBS_PATH, jobs)
    return job_id


def update_job(job_id: str, **fields: Any) -> None:
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
        if job_id not in jobs:
            return
        jobs[job_id].update(fields)
        jobs[job_id]["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        write_json(JOBS_PATH, jobs)


async def run_job(job_id: str, fn, *args, **kwargs) -> None:
    update_job(job_id, status="running")
    try:
        if inspect.iscoroutinefunction(fn):
            result = await fn(*args, **kwargs)
        else:
            result = await asyncio.to_thread(fn, *args, **kwargs)
        if isinstance(result, dict) and result.get("project_name"):
            try:
                get_rag_service().index_project(result["project_name"])
            except Exception as rag_exc:
                result.setdefault("warnings", []).append(f"RAG indexing failed: {rag_exc}")
        update_job(job_id, status="complete", result=summarize_result(result))
    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


def summarize_result(result: Any) -> Any:
    if not isinstance(result, dict):
        return result
    status = result.get("processing_status", {})
    return {
        "project_name": result.get("project_name"),
        "domain": result.get("domain"),
        "processing_status": status,
        "data_sources": list((result.get("data_sources") or {}).keys()),
        "problem_count": len((result.get("agent2_output") or {}).get("problems", [])),
        "insight_count": len((result.get("agent3_output") or {}).get("insights", [])),
        "brief_count": len((result.get("agent4_output") or {}).get("briefs", [])),
    }


def pipeline_payload(req: PipelineRunRequest) -> Dict[str, Any]:
    if req.agent1_payload:
        payload = dict(req.agent1_payload)
        payload.setdefault("project_name", req.project_name)
    else:
        payload = {"project_name": req.project_name}
    if req.domain:
        payload["domain"] = req.domain
    return payload


def fallback_grounded_answer(question: str, evidence_context: str) -> str:
    if not evidence_context:
        return "I could not find enough stored evidence to answer this yet."
    return (
        "I found related evidence, but the LLM answer step was skipped or unavailable. "
        "Review the returned sources for the grounded context behind this question."
    )


def answer_with_rag(
    question: str,
    project_name: Optional[str],
    provider: str,
    limit: int,
    use_llm: bool,
) -> Dict[str, Any]:
    rag = get_rag_service()
    chunks = rag.search(question, project_name=project_name, limit=limit)
    context = rag.build_context(chunks)

    answer = fallback_grounded_answer(question, context)
    if use_llm and context:
        system_prompt = """You are Insight Copilot for an internal research platform.

Answer only from the supplied evidence. If the evidence is weak or absent, say that.
Do not invent facts, metrics, sources, dates, or recommendations. Keep the answer concise.
Mention source numbers like [1], [2] when making claims."""
        prompt = f"""Question:
{question}

Evidence:
{context}

Write the answer now."""
        answer = call_llm(
            prompt=prompt,
            system_prompt=system_prompt,
            provider=provider,
            json_mode=False,
        ).strip()

    grounding = rag.validate_answer(answer, chunks)
    return {
        "answer": answer,
        "grounding": {
            "confidence": grounding.confidence,
            "score": grounding.score,
            "warnings": grounding.warnings,
        },
        "sources": grounding.sources,
        "evidence": [rag.chunk_to_dict(chunk) for chunk in chunks],
    }
