from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from backend.services import JOBS_LOCK, JOBS_PATH, read_json


router = APIRouter()


@router.get("/jobs")
def list_jobs() -> Dict[str, Any]:
    with JOBS_LOCK:
        jobs = list(read_json(JOBS_PATH, {}).values())
    return {"jobs": jobs}


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]
