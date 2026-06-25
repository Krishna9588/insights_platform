from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter

from backend.schemas import NewsMonitorRequest
from backend.services import NEWS_MONITORS_PATH, dump_model, read_json, slug_id, write_json


router = APIRouter()


@router.get("/news/monitors")
def list_news_monitors() -> Dict[str, Any]:
    return {"monitors": list(read_json(NEWS_MONITORS_PATH, {}).values())}


@router.post("/news/monitors")
def upsert_news_monitor(req: NewsMonitorRequest) -> Dict[str, Any]:
    monitors = read_json(NEWS_MONITORS_PATH, {})
    monitor_id = slug_id(req.name)
    monitors[monitor_id] = {
        "id": monitor_id,
        **dump_model(req),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(NEWS_MONITORS_PATH, monitors)
    return monitors[monitor_id]
