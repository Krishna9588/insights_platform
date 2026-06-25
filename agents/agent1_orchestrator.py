"""
agent1_orchestrator_v2.py
=========================
Agent 1 — Intelligence Gathering Orchestrator

Runs all scrapers concurrently and saves output to:
    database_mock/{project_name}/db_document.json
    database_mock/{project_name}/raw/            (individual scraper files)

Supports every mode for Reddit and YouTube:

    Reddit modes    : auto | subreddit | user | search | post
    YouTube modes   : video | channel | search

Callable from other scripts:
    from agent1_orchestrator_v2 import orchestrate_agent_1
    import asyncio
    asyncio.run(orchestrate_agent_1(payload))

Full payload example:
    {
        "project_name": "Groww",
        "domain": "groww.in",
        "play_store": {"link_or_id": "com.nextbillion.groww", "reviews_count": 100},
        "app_store":  {"link_or_id": "1434524388",             "reviews_count": 100},

        "reddit": [
            {"input": "r/groww",       "mode": "subreddit", "limit": 20, "category": "top"},
            {"input": "Groww app",     "mode": "search",    "limit": 15},
            {"input": "u/GrowwWealth", "mode": "user",      "limit": 10}
        ],

        "youtube": [
            {"mode": "search",  "query": "Groww app review",                    "count": 5},
            {"mode": "channel", "channel_url": "https://www.youtube.com/@Groww", "count": 5},
            {"mode": "video",   "video_url": "https://www.youtube.com/watch?v=XXXXX"}
        ],

        "transcripts": {"input_path": "path/to/transcripts/"}
    }

Minimal payload (only mandatory field):
    {"project_name": "Groww"}
"""

import os
import sys
import json
import asyncio
import shutil
import dataclasses
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# PATH CORRECTION
# ─────────────────────────────────────────────────────────────────────────────
# Add the project's root directory to the Python path.
# This allows the script to be run from anywhere.
try:
    _project_root = Path(__file__).resolve().parents[1]
    if str(_project_root) not in sys.path:
        sys.path.insert(0, str(_project_root))
except NameError:
    # If __file__ is not defined (e.g., in a Jupyter notebook)
    _project_root = Path.cwd()
    if str(_project_root) not in sys.path:
        sys.path.insert(0, str(_project_root))

try:
    from agents.paths import DB_ROOT, ensure_all_dirs
except ModuleNotFoundError:
    from paths import DB_ROOT, ensure_all_dirs

try:
    ensure_all_dirs()
except Exception as e:
    print(f"Could not initialize project directories. Error: {e}")
    sys.exit(1)


log = logging.getLogger("agent1_orchestrator")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

DB_FOLDER = str(DB_ROOT)

# Folders that scrapers write to by default (we consolidate them into raw/)
HARDCODED_SCRAPER_FOLDERS = ["reddit_data", "youtube_data", "signals"]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def make_json_serializable(obj):
    """Recursively convert dataclasses → dicts so everything can be JSON-saved."""
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    elif isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    return obj


async def run_scraper_safe(scraper_func, *args, **kwargs) -> Any:
    """
    Wraps any synchronous scraper in an async thread.
    Never crashes the pipeline — returns an error dict on failure.
    """
    try:
        return await asyncio.to_thread(scraper_func, *args, **kwargs)
    except Exception as e:
        log.error(f"[{scraper_func.__name__}] failed: {e}")
        return {"status": "error", "error": str(e)}


def _consolidate_scraper_files(raw_dir: str):
    """
    Move any files that scrapers dropped in hardcoded root folders
    (reddit_data/, youtube_data/, signals/) into raw_dir.
    """
    for folder_name in HARDCODED_SCRAPER_FOLDERS:
        folder_path = _project_root / folder_name
        if folder_path.exists():
            try:
                for filename in os.listdir(folder_path):
                    src  = folder_path / filename
                    dest = Path(raw_dir) / filename
                    shutil.move(str(src), str(dest))
                os.rmdir(folder_path)
                log.info(f"Consolidated {folder_name}/ into raw/")
            except Exception as e:
                log.warning(f"Could not consolidate {folder_name}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# REDDIT TASK BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_reddit_tasks(reddit_configs: List[Dict]) -> Dict[str, Any]:
    """
    Returns a dict of {task_key: coroutine} for all reddit configs.
    """
    try:
        from scrapers.reddit import reddit as reddit_scraper
    except ImportError:
        log.warning("scrapers.reddit not found — skipping all Reddit tasks")
        return {}

    tasks = {}
    for idx, cfg in enumerate(reddit_configs):
        user_input = cfg.get("input", "").strip()
        if not user_input:
            log.warning(f"Reddit config #{idx} has no 'input' field — skipping")
            continue

        task_key = f"reddit_{idx}"
        log.info(f"Reddit task [{task_key}]: input={user_input!r} mode={cfg.get('mode','auto')}")

        tasks[task_key] = run_scraper_safe(
            reddit_scraper,
            user_input,
            mode            = cfg.get("mode"),
            limit           = cfg.get("limit", 10),
            category        = cfg.get("category", "hot"),
            time_filter     = cfg.get("time_filter", "week"),
            scrape_comments = cfg.get("scrape_comments", True),
            verbose         = False,
            save            = True,
        )
    return tasks


# ─────────────────────────────────────────────────────────────────────────────
# YOUTUBE TASK BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _build_youtube_tasks(youtube_configs: List[Dict]) -> Dict[str, Any]:
    """
    Returns a dict of {task_key: coroutine} for all youtube configs.
    """
    try:
        from scrapers.youtube import youtube_scraper as yt_scraper
    except ImportError:
        log.warning("scrapers.youtube not found — skipping all YouTube tasks")
        return {}

    tasks = {}
    for idx, cfg in enumerate(youtube_configs):
        mode = (cfg.get("mode") or "").strip().lower()
        if not mode:
            log.warning(f"YouTube config #{idx} missing 'mode' — skipping")
            continue

        task_key = f"youtube_{idx}"

        if mode == "video":
            video_url = cfg.get("video_url", "").strip()
            if not video_url:
                log.warning(f"YouTube config #{idx}: mode=video requires 'video_url' — skipping")
                continue
            log.info(f"YouTube task [{task_key}]: mode=video url={video_url[:60]}")
            tasks[task_key] = run_scraper_safe(yt_scraper, mode="video", video_url=video_url)

        elif mode == "channel":
            channel_url = cfg.get("channel_url", "").strip()
            if not channel_url:
                log.warning(f"YouTube config #{idx}: mode=channel requires 'channel_url' — skipping")
                continue
            count = cfg.get("count", 5)
            log.info(f"YouTube task [{task_key}]: mode=channel url={channel_url[:60]} count={count}")
            tasks[task_key] = run_scraper_safe(yt_scraper, mode="channel", channel_url=channel_url, count=count)

        elif mode == "search":
            query = cfg.get("query", "").strip()
            if not query:
                log.warning(f"YouTube config #{idx}: mode=search requires 'query' — skipping")
                continue
            count = cfg.get("count", 5)
            log.info(f"YouTube task [{task_key}]: mode=search query={query!r} count={count}")
            tasks[task_key] = run_scraper_safe(yt_scraper, mode="search", query=query, count=count)

        else:
            log.warning(f"YouTube config #{idx}: unknown mode={mode!r} — use video|channel|search")

    return tasks


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────────────

async def orchestrate_agent_1(payload: Dict[str, Any]) -> str:
    """
    Main entry point. Accepts a payload dict, runs all scrapers concurrently,
    saves everything to database_mock/{project_name}/db_document.json.
    """
    project_name = (payload.get("project_name") or "").strip()
    if not project_name:
        raise ValueError("'project_name' is required in the payload.")

    log.info(f"\n{'='*55}")
    log.info(f"  Agent 1 — {project_name}")
    log.info(f"{'='*55}")

    project_dir = DB_ROOT / project_name
    raw_dir     = project_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_dir_str = str(raw_dir)

    domain     = (payload.get("domain") or "").strip() or None
    task_map   = {}

    # ── Company Profile ──────────────────────────────────────────
    if not payload.get("skip_company_profile"):
        try:
            from scrapers.company_profile import run_research_task
            log.info("Task: company_profile")
            task_map["company_profile"] = run_scraper_safe(
                run_research_task,
                company_input=project_name,
                company_domain=domain,
                storage_folder=raw_dir_str,
            )
        except ImportError:
            log.warning("scrapers.company_profile not found — skipping company profile")

    # ── Play Store ───────────────────────────────────────────────
    if "play_store" in payload:
        try:
            from scrapers.play_store import play_store
            ps = payload["play_store"]
            log.info(f"Task: play_store  id={ps.get('link_or_id')}")
            task_map["play_store"] = run_scraper_safe(
                play_store,
                input_str=ps.get("link_or_id"),
                reviews=ps.get("reviews_count", 100),
                output=raw_dir_str,
                interactive=False,
                verbose=False,
            )
        except ImportError:
            log.warning("scrapers.play_store not found — skipping Play Store")

    # ── App Store ────────────────────────────────────────────────
    if "app_store" in payload:
        try:
            from scrapers.app_store import app_store
            ap = payload["app_store"]
            log.info(f"Task: app_store  id={ap.get('link_or_id')}")
            task_map["app_store"] = run_scraper_safe(
                app_store,
                input_str=ap.get("link_or_id"),
                reviews=ap.get("reviews_count", 100),
                output=raw_dir_str,
                interactive=False,
                verbose=False,
            )
        except ImportError:
            log.warning("scrapers.app_store not found — skipping App Store")

    # ── Reddit ───────────────────────────────────────────────────
    if "reddit" in payload:
        reddit_cfg = payload["reddit"]
        if isinstance(reddit_cfg, dict):
            reddit_cfg = [reddit_cfg]
        task_map.update(_build_reddit_tasks(reddit_cfg))

    # ── YouTube ──────────────────────────────────────────────────
    if "youtube" in payload:
        youtube_cfg = payload["youtube"]
        if isinstance(youtube_cfg, dict):
            youtube_cfg = [youtube_cfg]
        task_map.update(_build_youtube_tasks(youtube_cfg))

    # ── Internal Transcripts (Local, or Google Drive) ────────────
    if "transcripts" in payload:
        ts_data    = payload.get("transcripts", {})
        input_path = (ts_data.get("input_path") or "").strip()

        if not input_path:
            log.warning("Transcript 'input_path' is empty, skipping.")
        else:
            try:
                from scrapers.agent1_internal_cloud import agent1_internal, agent1_internal_batch, agent1_internal_drive

                if input_path.lower() == 'drive':
                    log.info("Task: internal_transcripts (Google Drive)")
                    task_map["internal_transcripts"] = run_scraper_safe(
                        agent1_internal_drive,
                        output_dir=raw_dir_str
                    )
                elif os.path.exists(input_path):
                    if os.path.isdir(input_path):
                        log.info(f"Task: internal_transcripts (batch) path={input_path}")
                        task_map["internal_transcripts"] = run_scraper_safe(
                            agent1_internal_batch,
                            input_dir=input_path,
                            output_dir=raw_dir_str,
                        )
                    else:
                        log.info(f"Task: internal_transcripts (single) path={input_path}")
                        task_map["internal_transcripts"] = run_scraper_safe(
                            agent1_internal,
                            input_path=input_path,
                            output_dir=raw_dir_str,
                        )
                else:
                    log.warning(f"Transcript path not found: {input_path!r}")

            except ImportError as e:
                log.error(f"Failed to import transcript processor: {e}")
                log.warning("scrapers.agent1_internal_cloud.py not found — skipping transcripts")

    # ── Run all tasks concurrently ────────────────────────────────
    if not task_map:
        log.warning("No tasks were queued. Check payload keys and scraper imports.")
        return "" # Return empty string if no tasks ran

    log.info(f"\nDispatching {len(task_map)} task(s): {list(task_map.keys())}")
    keys         = list(task_map.keys())
    results_list = await asyncio.gather(*task_map.values())
    scraped_data = make_json_serializable(dict(zip(keys, results_list)))
    _consolidate_scraper_files(raw_dir_str)

    # ── Build final document ──────────────────────────────────
    merged_reddit  = {k: v for k, v in scraped_data.items() if k.startswith("reddit_")}
    merged_youtube = {k: v for k, v in scraped_data.items() if k.startswith("youtube_")}
    clean_data     = {k: v for k, v in scraped_data.items() if not k.startswith(("reddit_", "youtube_"))}

    if merged_reddit:
        clean_data["reddit"]  = merged_reddit
    if merged_youtube:
        clean_data["youtube"] = merged_youtube

    db_filepath = project_dir / "db_document.json"
    existing_document: Dict[str, Any] = {}
    if db_filepath.exists():
        try:
            with open(db_filepath, "r", encoding="utf-8") as f:
                existing_document = json.load(f)
        except Exception as e:
            log.warning(f"Could not read existing db_document for merge: {e}")

    merged_sources = existing_document.get("data_sources", {})
    merged_sources.update(clean_data)

    final_document = {
        "project_name"     : project_name,
        "domain"           : domain or existing_document.get("domain"),
        "ingestion_date"   : datetime.now().isoformat(),
        "data_sources"     : merged_sources,
        "processing_status": {
            "agent2_insights_extracted" : False,
            "agent3_synthesis_done"     : False,
            "agent4_product_brief_done" : False,
        },
        "agent2_output": {},
        "agent3_output": {},
        "agent4_output": {},
    }

    with open(db_filepath, "w", encoding="utf-8") as f:
        json.dump(final_document, f, indent=4, ensure_ascii=False)

    log.info(f"\n{'='*55}")
    log.info(f"  Agent 1 complete")
    log.info(f"  db_document : {db_filepath}")
    log.info(f"  raw files   : {raw_dir_str}")
    log.info(f"  tasks ran   : {len(keys)}")
    log.info(f"{'='*55}\n")

    return str(db_filepath)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC HELPER — build a payload interactively (CLI)
# ─────────────────────────────────────────────────────────────────────────────

def build_payload_interactive() -> Dict:
    """
    Interactive CLI to build a full payload.
    Guides the user through every option including multiple reddit/youtube targets.
    """
    print("=" * 55)
    print("  AGENT 1: INTELLIGENCE GATHERING")
    print("=" * 55)

    project_name = input("\nProject / Company Name (required): ").strip()
    while not project_name:
        project_name = input("  Cannot be empty. Enter name: ").strip()

    payload: Dict[str, Any] = {"project_name": project_name}

    domain = input(f"Domain for {project_name} (optional, press Enter to skip): ").strip()
    if domain:
        payload["domain"] = domain

    ps_id = input("Play Store App ID or link (optional): ").strip()
    if ps_id:
        try:
            n = int(input("  How many reviews? [default 100]: ").strip() or "100")
        except ValueError:
            n = 100
        payload["play_store"] = {"link_or_id": ps_id, "reviews_count": n}

    as_id = input("App Store App ID or link (optional): ").strip()
    if as_id:
        try:
            n = int(input("  How many reviews? [default 100]: ").strip() or "100")
        except ValueError:
            n = 100
        payload["app_store"] = {"link_or_id": as_id, "reviews_count": n}

    reddit_configs = []
    print("\nReddit (you can add multiple targets).")
    print("  Input can be: r/name  |  u/name  |  search phrase  |  post URL")
    print("  Modes       : auto (default) | subreddit | user | search | post")
    while True:
        rd_input = input("  Reddit input (or press Enter to skip/finish): ").strip()
        if not rd_input:
            break
        rd_mode  = input("  Mode [auto]: ").strip() or None
        try:
            rd_limit = int(input("  Limit [10]: ").strip() or "10")
        except ValueError:
            rd_limit = 10
        rd_cat   = input("  Category for subreddit [hot]: ").strip() or "hot"
        cfg = {"input": rd_input, "limit": rd_limit, "category": rd_cat}
        if rd_mode:
            cfg["mode"] = rd_mode
        reddit_configs.append(cfg)
        another = input("  Add another Reddit target? [y/N]: ").strip().lower()
        if another != "y":
            break
    if reddit_configs:
        payload["reddit"] = reddit_configs

    youtube_configs = []
    print("\nYouTube (you can add multiple targets).")
    print("  Modes: search | channel | video")
    while True:
        yt_mode = input("  YouTube mode (or press Enter to skip/finish): ").strip().lower()
        if not yt_mode:
            break
        if yt_mode == "video":
            url = input("  Video URL: ").strip()
            youtube_configs.append({"mode": "video", "video_url": url})
        elif yt_mode == "channel":
            url = input("  Channel URL: ").strip()
            try:
                count = int(input("  Number of videos [5]: ").strip() or "5")
            except ValueError:
                count = 5
            youtube_configs.append({"mode": "channel", "channel_url": url, "count": count})
        elif yt_mode == "search":
            query = input("  Search query: ").strip()
            try:
                count = int(input("  Number of results [5]: ").strip() or "5")
            except ValueError:
                count = 5
            youtube_configs.append({"mode": "search", "query": query, "count": count})
        else:
            print("  Unknown mode. Use: search | channel | video")
            continue
        another = input("  Add another YouTube target? [y/N]: ").strip().lower()
        if another != "y":
            break
    if youtube_configs:
        payload["youtube"] = youtube_configs

    ts_path = input("\nPath to internal transcripts ('drive' for Google Drive, or local path): ").strip()
    if ts_path:
        payload["transcripts"] = {"input_path": ts_path}

    return payload


# ─────────────────────────────────────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    payload = build_payload_interactive()

    print("\nPayload to be used:")
    print(json.dumps(payload, indent=2))
    confirm = input("\nRun Agent 1 with this payload? [Y/n]: ").strip().lower()
    if confirm in ("", "y"):
        asyncio.run(orchestrate_agent_1(payload))
    else:
        print("Cancelled.")
