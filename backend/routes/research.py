from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from agents.pipeline_v2 import run_pipeline
from backend.schemas import GoogleDriveRequest, LocalTranscriptRequest, PipelineRunRequest
from backend.services import create_job, dump_model, pipeline_payload, run_job, summarize_result


router = APIRouter()


@router.post("/pipeline/run")
def start_pipeline(req: PipelineRunRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    payload = pipeline_payload(req)
    job_id = create_job("pipeline", dump_model(req))
    background_tasks.add_task(
        run_job,
        job_id,
        run_pipeline,
        req.project_name,
        req.provider,
        req.start_from,
        req.only,
        payload if req.start_from == "agent1" or req.only == "agent1" else None,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/ingest/transcripts/local")
def ingest_local_transcripts(req: LocalTranscriptRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    input_path = Path(req.input_path)
    if not input_path.exists():
        raise HTTPException(status_code=404, detail="Transcript path not found")

    payload = {
        "project_name": req.project_name,
        "skip_company_profile": True,
        "transcripts": {"input_path": str(input_path)},
    }
    if req.domain:
        payload["domain"] = req.domain

    run_args = (req.project_name, req.provider, "agent1", None, payload)
    if not req.run_async:
        return {"status": "complete", "result": summarize_result(run_pipeline(*run_args))}

    job_id = create_job("local_transcripts", dump_model(req))
    background_tasks.add_task(run_job, job_id, run_pipeline, *run_args)
    return {"job_id": job_id, "status": "queued"}


@router.post("/ingest/google-drive")
def ingest_google_drive(req: GoogleDriveRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    payload = {
        "project_name": req.project_name,
        "skip_company_profile": True,
        "google_drive": {
            "folder_id": req.folder_id,
            "credentials_path": req.credentials_path,
            "token_path": req.token_path,
            "include_existing": req.include_existing,
        },
    }
    if req.domain:
        payload["domain"] = req.domain

    run_args = (req.project_name, req.provider, "agent1", None, payload)
    if not req.run_async:
        return {"status": "complete", "result": summarize_result(run_pipeline(*run_args))}

    job_id = create_job("google_drive_transcripts", dump_model(req))
    background_tasks.add_task(run_job, job_id, run_pipeline, *run_args)
    return {"job_id": job_id, "status": "queued"}
