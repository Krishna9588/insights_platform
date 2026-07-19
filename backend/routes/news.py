from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks
from backend.schemas import NewsMonitorRequest
from backend.services import NEWS_MONITORS_PATH, dump_model, read_json, slug_id, write_json

router = APIRouter()

@router.get("/news/monitors")
def list_news_monitors() -> Dict[str, Any]:
    return {"monitors": list(read_json(NEWS_MONITORS_PATH, {}).values())}

@router.post("/news/monitors")
def upsert_news_monitor(req: NewsMonitorRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    monitors = read_json(NEWS_MONITORS_PATH, {})
    monitor_id = slug_id(req.name)
    monitors[monitor_id] = {
        "id": monitor_id,
        **dump_model(req),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(NEWS_MONITORS_PATH, monitors)

    # Automatically trigger a run when the monitor is created
    payload = {}
    if "news" in req.sources:
        payload["news"] = [{"query": req.query, "count": 15}]
    if "reddit" in req.sources:
        payload["reddit"] = [{"query": req.query, "mode": "search", "time_filter": "month"}]
    if "youtube" in req.sources:
        payload["youtube"] = [{"query": req.query, "mode": "search"}]

    if payload:
        project_name = f"Monitor: {req.name}"
        payload["project_name"] = project_name
        run_args = (project_name, "gemini", "agent1", ["agent1", "agent3"], payload)

        from backend.services import create_job
        from backend.routes.research import run_job
        from agents.pipeline_v2 import run_pipeline

        job_id = create_job(f"monitor_{monitor_id}", {"type": "monitor", "project_name": project_name, "name": req.name})
        background_tasks.add_task(run_job, job_id, run_pipeline, *run_args)

    return monitors[monitor_id]

@router.delete("/news/monitors/{monitor_id}")
def remove_news_monitor(monitor_id: str) -> Dict[str, Any]:
    monitors = read_json(NEWS_MONITORS_PATH, {})
    if monitor_id in monitors:
        name = monitors[monitor_id].get("name", "")
        del monitors[monitor_id]
        write_json(NEWS_MONITORS_PATH, monitors)

        if name:
            project_name = f"Monitor: {name}"
            from backend.routes.projects import delete_project
            try:
                delete_project(project_name)
            except Exception:
                pass

    return {"status": "ok", "id": monitor_id}
