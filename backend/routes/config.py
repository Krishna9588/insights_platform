from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from agents.paths import CONFIG_FILE
from backend.schemas import AppConfigRequest
from backend.services import read_json, write_json
from core.drive_config import get_drive_config


router = APIRouter()


@router.get("/config/app")
def get_app_config() -> Dict[str, Any]:
    """Get saved frontend/application defaults."""
    return {"values": read_json(CONFIG_FILE, {})}


@router.post("/config/app")
def save_app_config(req: AppConfigRequest) -> Dict[str, Any]:
    """Save frontend/application defaults for future runs."""
    write_json(CONFIG_FILE, req.values)
    return {"status": "saved", "values": req.values}


@router.post("/config/drive/add")
def add_drive_folder(
    project_name: str,
    folder_id: str,
    credentials_path: Optional[str] = None,
    token_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Add or update a Google Drive folder configuration."""
    try:
        drive_config = get_drive_config()
        entry = drive_config.add_folder(project_name, folder_id, credentials_path, token_path)
        return entry
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/drive")
def list_drive_folders() -> Dict[str, Any]:
    """List all configured Google Drive folders."""
    try:
        drive_config = get_drive_config()
        folders = drive_config.list_folders()
        return {"folders": folders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/drive/{project_name}")
def get_drive_folder(project_name: str) -> Dict[str, Any]:
    """Get Google Drive folder configuration for a project."""
    try:
        drive_config = get_drive_config()
        entry = drive_config.get_folder(project_name)
        if not entry:
            raise HTTPException(status_code=404, detail="Drive folder not configured for this project")
        return entry
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config/drive/{project_name}")
def remove_drive_folder(project_name: str) -> Dict[str, Any]:
    """Remove a Google Drive folder configuration."""
    try:
        drive_config = get_drive_config()
        if drive_config.remove_folder(project_name):
            return {"status": "removed", "project_name": project_name}
        raise HTTPException(status_code=404, detail="Drive folder not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
