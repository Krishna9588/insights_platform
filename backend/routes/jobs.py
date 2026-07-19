from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

import time
from backend.services import JOBS_LOCK, JOBS_PATH, read_json, write_json

router = APIRouter()


@router.get("/jobs")
def list_jobs() -> Dict[str, Any]:
    with JOBS_LOCK:
        jobs = list(read_json(JOBS_PATH, {}).values())
    return {"jobs": jobs}


@router.delete("/jobs")
def clear_jobs() -> Dict[str, Any]:
    """Clears all jobs that are not currently running or queued."""
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
        cleared_count = 0
        active_jobs = {}
        for job_id, job in jobs.items():
            if job.get("status") in ["queued", "running"]:
                active_jobs[job_id] = job
            else:
                cleared_count += 1
        write_json(JOBS_PATH, active_jobs)
    return {"status": "success", "cleared_count": cleared_count}


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@router.delete("/jobs/{job_id}")
def cancel_job(job_id: str) -> Dict[str, Any]:
    with JOBS_LOCK:
        jobs = read_json(JOBS_PATH, {})
        if job_id not in jobs:
            raise HTTPException(status_code=404, detail="Job not found")
        if jobs[job_id]["status"] in ["queued", "running"]:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = "Job manually cancelled by user."
            jobs[job_id]["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            write_json(JOBS_PATH, jobs)
            return {"status": "success", "message": "Job cancelled"}
    raise HTTPException(status_code=400, detail="Job is not in a cancellable state")
