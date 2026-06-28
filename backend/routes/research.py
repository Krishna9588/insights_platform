from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from agents.pipeline_v2 import run_pipeline
from backend.schemas import GoogleDriveRequest, LocalTranscriptRequest, PipelineRunRequest
import backend.schemas
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
    # Support comma-separated paths
    input_paths = [Path(p.strip()) for p in req.input_path.split(",") if p.strip()]
    if not input_paths:
        raise HTTPException(status_code=400, detail="No transcript paths provided")
        
    for path in input_paths:
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Transcript path not found: {path}")

    payload = {
        "project_name": req.project_name,
        "skip_company_profile": True,
        "transcripts": {"input_path": req.input_path},
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
        "transcripts": {
            "input_path": "drive",
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

from typing import List
from fastapi import File, Form, UploadFile
import json
import shutil
import os

@router.post("/ingest/google-drive/list")
def list_google_drive(req: backend.schemas.GoogleDriveListRequest) -> Dict[str, Any]:
    from scrapers.google_drive import fetch_google_drive_list
    try:
        files = fetch_google_drive_list(req.url_or_id)
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ingest/transcripts/combined")
def ingest_combined(
    background_tasks: BackgroundTasks,
    project_name: str = Form(...),
    provider: str = Form("gemini"),
    domain: Optional[str] = Form(None),
    google_drive_files: str = Form("[]"),
    files: List[UploadFile] = File(default=[])
) -> Dict[str, Any]:
    from agents.paths import project_db_path, DB_ROOT
    from scrapers.google_drive import download_google_drive_files

    raw_dir = DB_ROOT / project_name / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    
    local_paths = []
    
    # Process uploaded files
    for f in files:
        if f.filename:
            file_path = raw_dir / f.filename
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            local_paths.append(str(file_path))
            
    # Process Google Drive files
    try:
        drive_metadata = json.loads(google_drive_files)
    except json.JSONDecodeError:
        drive_metadata = []
        
    if drive_metadata:
        # Download immediately? Or queue background job?
        # A background job might be better so it doesn't block the request.
        # But wait, we want to download them and THEN start the pipeline.
        pass # We will pass it to the pipeline payload

    payload = {
        "project_name": project_name,
        "skip_company_profile": True,
        "transcripts": {
            "input_path": "combined",
            "local_paths": local_paths,
            "drive_metadata": drive_metadata,
        },
    }
    if domain:
        payload["domain"] = domain

    run_args = (project_name, provider, "agent1", None, payload)
    
    # We create a dummy model for job storage
    from pydantic import BaseModel
    class DummyReq(BaseModel):
        project_name: str
        provider: str
    req_model = DummyReq(project_name=project_name, provider=provider)
    
    job_id = create_job("combined_transcripts", dump_model(req_model))
    background_tasks.add_task(run_job, job_id, run_pipeline, *run_args)
    return {"job_id": job_id, "status": "queued"}
