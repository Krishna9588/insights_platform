"""
youtube_scraper.py
==================
YouTube transcript + metadata scraper — three modes:
  1. Single video URL
  2. Channel URL  (scrapes N most-recent videos)
  3. Search query (scrapes top 5 or 10 results)

Transcript is fetched as plain English text (auto-captions fallback).
Metadata collected: title + description only (as requested).
All output saved as JSON inside  ./youtube_data/

── Quick-start (install deps once) ─────────────────────────────────────────
    pip install youtube-transcript-api yt-dlp

── Call from another script ────────────────────────────────────────────────
    from youtube_scraper import youtube_scraper

    # Single video
    youtube_scraper(mode="video", video_url="https://www.youtube.com/watch?v=XXXXX")

    # Channel  (default count = 5)
    youtube_scraper(mode="channel", channel_url="https://www.youtube.com/@SomeChannel", count=10)

    # Search
    youtube_scraper(mode="search", query="python tutorial beginners", count=5)

── Run directly (edit the CONFIG block at the bottom) ──────────────────────
    Press  Run  in your IDE — no terminal args needed.
"""

import json
import os
import re
import ssl
import time
import urllib.request
import urllib.parse
import subprocess
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
# ── optional: suppress SSL warnings if user has a MITM proxy ─────────────
try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    pass

import logging

# This silently suppresses the specific InsecureRequestWarning
# (urllib3 is already imported guarded above; re-importing unconditionally
# here would crash the whole module on load in an environment where it's
# genuinely missing, defeating the point of that guard)
if "urllib3" in dir():
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.getLogger("urllib3").setLevel(logging.ERROR)

# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

OUTPUT_DIR = Path("youtube_data")
YT_BASE    = "https://www.youtube.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS — low-level
# ═══════════════════════════════════════════════════════════════════════════

def _ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR


def _save_json(data: dict | list, filename: str) -> Path:
    _ensure_output_dir()
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  [SAVED] {path}")
    return path


def _video_id_from_url(url: str) -> Optional[str]:
    """Extract YouTube video ID from any standard URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/|live/)([A-Za-z0-9_-]{11})",
        r"^([A-Za-z0-9_-]{11})$",   # bare ID
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def _fetch_url(url: str, timeout: int = 15) -> str:
    """
    Simple HTTP GET returning page text.
    Tries a normal, certificate-verified request first. Only falls back to
    an unverified request if the verified one fails with an SSL error
    (e.g. behind a corporate MITM proxy) - and says so loudly, since
    disabling certificate verification by default would silently expose
    every request to man-in-the-middle tampering.
    """
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except ssl.SSLError as e:
        print(f"  [WARN] SSL verification failed ({e}); retrying without cert "
              f"verification. Only expected on networks with a MITM proxy.")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read().decode("utf-8", errors="replace")


# ═══════════════════════════════════════════════════════════════════════════
# TRANSCRIPT — via youtube-transcript-api (primary) + yt-dlp (fallback)
# ═══════════════════════════════════════════════════════════════════════════
'''
def _transcript_via_library(video_id: str) -> Optional[str]:
    """
    Try youtube-transcript-api first.
    Prefers manually uploaded English captions; falls back to auto-generated.
    """
    try:
        import requests as _req
        import requests.packages.urllib3 as _u3

        _u3.disable_warnings()
        session = _req.Session()
        session.verify = False

        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi(http_client=session)

        transcript_list = api.list(video_id)

        # Prefer manual EN, then auto EN, then any EN variant
        preferred = None
        for t in transcript_list:
            lang = t.language_code.lower()
            if lang == "en" and not t.is_generated:
                preferred = t
                break
        if preferred is None:
            for t in transcript_list:
                lang = t.language_code.lower()
                if lang.startswith("en"):
                    preferred = t
                    break
        if preferred is None:
            # Grab the first available and try to translate
            for t in transcript_list:
                try:
                    preferred = t.translate("en")
                    break
                except Exception:
                    continue

        if preferred is None:
            return None

        fetched = preferred.fetch()
        # fetched is a list of FetchedTranscriptSnippet objects
        text_parts = [s.text.strip() for s in fetched if s.text.strip()]
        return " ".join(text_parts)

    except ImportError:
        print("  [WARN] youtube-transcript-api not installed — trying yt-dlp fallback")
        return None
    except Exception as e:
        print(f"  [WARN] transcript-api failed: {e}")
        return None
'''

def _transcript_via_library(video_id: str) -> tuple:
    """
    Fetches transcript with multi-stage fallback:
    1. English (Native/Auto) -> 2. Translated to English -> 3. Raw Native (Hindi/etc.)

    Returns (text_or_None, error_reason_or_None). The error reason is only
    meaningful when text is None - it's what lets us diagnose real failures
    without needing console access (transcript failures were previously
    swallowed into a bare None with no trace in the output file).
    """
    try:
        import requests as _req
        import urllib3 as _u3
        _u3.disable_warnings()
        session = _req.Session()
        session.verify = False

        from youtube_transcript_api import YouTubeTranscriptApi
        api = YouTubeTranscriptApi(http_client=session)

        transcript_list = api.list(video_id)
        preferred = None

        # STAGE 1: Try for English
        try:
            preferred = transcript_list.find_transcript(['en', 'en-IN', 'en-US', 'en-GB'])
        except Exception:
            pass

        # STAGE 2: Try to translate to English
        if not preferred:
            try:
                first = list(transcript_list)[0]
                preferred = first.translate('en')
            except Exception:
                pass

        # STAGE 3: Grab raw native language (Hindi, etc.) if all else fails
        if not preferred:
            try:
                preferred = list(transcript_list)[0]
                print(f"  [TRANSCRIPT] Saving raw native track: '{preferred.language_code}'")
            except Exception as e:
                return None, f"no transcript tracks available: {e}"

        fetched = preferred.fetch()

        # FIX: Handle both object (.text) and dictionary (['text']) access
        text_parts = []
        for s in fetched:
            if isinstance(s, dict):
                val = s.get('text', '')
            else:
                val = getattr(s, 'text', '')
            if val.strip():
                text_parts.append(val.strip())

        return " ".join(text_parts), None

    except Exception as e:
        reason = f"{type(e).__name__}: {e}"
        print(f"  [WARN] transcript-api failed: {reason}")
        return None, reason

def _transcript_via_ytdlp(video_id: str) -> tuple:
    """
    Returns (text_or_None, error_reason_or_None) - see _transcript_via_library
    for why the reason is captured instead of just printed.
    """
    try:
        import subprocess
        import glob

        url = f"https://www.youtube.com/watch?v={video_id}"
        out_tmp = f"youtube_data/{video_id}_sub"
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--write-auto-subs",
            "--write-subs",
            "--sub-langs", "en",
            "--skip-download",
            "-o", out_tmp,
            url
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)

        vtt_files = glob.glob(f"{out_tmp}*.vtt")
        if vtt_files:
            vtt_file = vtt_files[0]
            with open(vtt_file, "r", encoding="utf-8") as f:
                content = f.read()
            os.remove(vtt_file)

            lines = content.split('\n')
            text_parts = []
            for line in lines:
                if '-->' in line or line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:') or not line.strip() or re.match(r'^\d{2}:\d{2}:\d{2}', line):
                    continue
                clean_line = re.sub(r'<[^>]+>', '', line).strip()
                if clean_line and (not text_parts or clean_line != text_parts[-1]):
                    text_parts.append(clean_line)
            return " ".join(text_parts), None

        # No .vtt was produced. yt-dlp still returns exit code 0 for "no
        # subtitles found" as well as for real failures, so the exit code
        # alone can't distinguish them - surface stderr either way so we
        # can tell "this video genuinely has no English captions" apart
        # from "yt-dlp itself was blocked/failed".
        stderr_tail = (proc.stderr or "").strip().splitlines()[-3:] if proc.stderr else []
        reason = f"no .vtt produced (exit code {proc.returncode}); stderr: {' | '.join(stderr_tail) or '(empty)'}"
        return None, reason
    except Exception as e:
        reason = f"{type(e).__name__}: {e}"
        print(f"  [WARN] yt-dlp failed: {reason}")
        return None, reason

def get_transcript(video_id: str) -> tuple:
    """
    Public helper: get English transcript for a video.
    Tries youtube-transcript-api first, then yt-dlp.
    Returns (text_or_None, diagnostics_dict) - diagnostics records which
    method(s) were tried and why they failed, so a failure is visible in
    the saved JSON instead of only in console output that may not be kept.
    """
    print(f"  [TRANSCRIPT] Fetching for video: {video_id}")
    diagnostics = {"method_used": None, "attempts": []}

    text, reason = _transcript_via_library(video_id)
    if text:
        print(f"  [TRANSCRIPT] [OK] Got {len(text.split())} words via transcript-api")
        diagnostics["method_used"] = "youtube-transcript-api"
        return text, diagnostics
    diagnostics["attempts"].append({"method": "youtube-transcript-api", "error": reason})

    print("  [TRANSCRIPT] Falling back to yt-dlp ...")
    text, reason = _transcript_via_ytdlp(video_id)
    if text:
        print(f"  [TRANSCRIPT] [OK] Got {len(text.split())} words via yt-dlp")
        diagnostics["method_used"] = "yt-dlp"
        return text, diagnostics
    diagnostics["attempts"].append({"method": "yt-dlp", "error": reason})

    print("  [TRANSCRIPT] [FAIL] No transcript found")
    for attempt in diagnostics["attempts"]:
        print(f"    - {attempt['method']}: {attempt['error']}")
    return None, diagnostics


# ═══════════════════════════════════════════════════════════════════════════
# METADATA — title + description via yt-dlp --dump-json (most reliable)
# ═══════════════════════════════════════════════════════════════════════════

def _get_video_metadata_ytdlp(video_id: str) -> dict:
    """Use yt-dlp --dump-json to get video metadata without downloading."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-check-certificate",
        "--dump-json",
        "--quiet",
        "--no-warnings",
        url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and result.stdout.strip():
            d = json.loads(result.stdout)
            return {
                "video_id":    video_id,
                "title":       d.get("title", ""),
                "description": d.get("description", ""),
                "url":         f"https://www.youtube.com/watch?v={video_id}",
            }
    except Exception as e:
        print(f"  [WARN] yt-dlp metadata failed: {e}")

    return {
        "video_id":    video_id,
        "title":       "",
        "description": "",
        "url":         f"https://www.youtube.com/watch?v={video_id}",
    }


def _get_video_metadata_html(video_id: str) -> dict:
    """
    Fallback: scrape title + description from the YouTube watch page HTML.
    Doesn't need yt-dlp; pure stdlib.
    """
    url  = f"https://www.youtube.com/watch?v={video_id}"
    meta = {
        "video_id":    video_id,
        "title":       "",
        "description": "",
        "url":         url,
    }
    try:
        html = _fetch_url(url)

        # Title — from <title> tag and/or og:title
        m = re.search(r'<title>([^<]+)</title>', html)
        if m:
            raw_title = m.group(1).strip()
            meta["title"] = re.sub(r"\s*[-–]\s*YouTube\s*$", "", raw_title).strip()

        og = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html)
        if og:
            meta["title"] = og.group(1).strip()

        # Description — from ytInitialData JSON blob
        desc_match = re.search(
            r'"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"', html
        )
        if desc_match:
            raw_desc = desc_match.group(1)
            # Unescape JSON string. Using json.loads (rather than the
            # unicode_escape codec) matters here: JSON encodes characters
            # outside the Basic Multilingual Plane (most emoji) as a UTF-16
            # surrogate pair like \ud83d\ude00. unicode_escape decodes each
            # \uXXXX independently and does NOT recombine the pair, leaving
            # two invalid lone-surrogate characters that later crash when
            # writing the JSON output file. json.loads decodes JSON strings
            # correctly, including recombining surrogate pairs.
            try:
                meta["description"] = json.loads(f'"{raw_desc}"')
            except json.JSONDecodeError:
                # Malformed fragment (regex edge case) - fall back to the
                # raw text rather than crashing the whole scrape.
                meta["description"] = raw_desc

    except Exception as e:
        print(f"  [WARN] HTML metadata scrape failed: {e}")

    return meta


def get_video_info(video_id: str) -> dict:
    """
    Public helper: return { video_id, title, description, url }.
    Tries yt-dlp first, HTML scrape as fallback.
    """
    print(f"  [METADATA] Fetching for video: {video_id}")
    meta = _get_video_metadata_ytdlp(video_id)
    if not meta["title"]:
        print("  [METADATA] yt-dlp gave no title, trying HTML fallback ...")
        meta = _get_video_metadata_html(video_id)
    if meta["title"]:
        print(f"  [METADATA] [OK] Title: {meta['title'][:60]}")
    else:
        print("  [METADATA] [FAIL] Could not retrieve title")
    return meta


# ═══════════════════════════════════════════════════════════════════════════
# SCRAPE ONE VIDEO  (combines metadata + transcript)
# ═══════════════════════════════════════════════════════════════════════════

def scrape_single_video(video_id: str) -> dict:
    """
    Fetch title, description, and English transcript for one video.
    Returns a dict; does NOT save to file (caller decides).
    """
    meta = get_video_info(video_id)
    transcript, transcript_diagnostics = get_transcript(video_id)

    result = {
        "scraped_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "video_id":    meta["video_id"],
        "url":         meta["url"],
        "title":       meta["title"],
        "description": meta["description"],
        "transcript":  transcript or "",
        "transcript_words": len(transcript.split()) if transcript else 0,
    }
    # Only include diagnostics when the transcript actually failed, to keep
    # successful output clean.
    if not transcript:
        result["transcript_error"] = transcript_diagnostics
    return result


# ═══════════════════════════════════════════════════════════════════════════
# MODE 1 — SINGLE VIDEO URL
# ═══════════════════════════════════════════════════════════════════════════

def mode_video(video_url: str) -> dict:
    """
    Scrape a single video by its URL.
    Saves to youtube_data/video_<id>.json
    Returns the scraped dict.
    """
    print(f"\n{'='*60}")
    print(f"  MODE: Single Video")
    print(f"  URL:  {video_url}")
    print(f"{'='*60}")

    video_id = _video_id_from_url(video_url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {video_url}")

    data = scrape_single_video(video_id)
    _save_json(data, f"video_{video_id}.json")
    return data


# ═══════════════════════════════════════════════════════════════════════════
# MODE 2 — CHANNEL URL
# ═══════════════════════════════════════════════════════════════════════════

def _get_channel_video_ids(channel_url: str, count: int) -> list[str]:
    """
    Use yt-dlp to list the N most-recent video IDs from a channel.
    channel_url can be any of:
      https://www.youtube.com/@Handle
      https://www.youtube.com/channel/UCxxxxx
      https://www.youtube.com/c/Name
    """
    print(f"  [CHANNEL] Listing up to {count} video IDs ...")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-check-certificate",
        "--flat-playlist",
        "--playlist-end", str(count),
        "--print", "id",
        "--quiet",
        "--no-warnings",
        channel_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        print(f"  [CHANNEL] [OK] Found {len(ids)} video IDs")
        return ids[:count]
    except Exception as e:
        print(f"  [CHANNEL] [FAIL] Failed to list channel videos: {e}")
        return []


def mode_channel(channel_url: str, count: int = 5) -> list[dict]:
    """
    Scrape the N most-recent videos from a YouTube channel.
    Saves to youtube_data/channel_<handle>_<timestamp>.json
    Returns list of scraped dicts.
    """
    print(f"\n{'='*60}")
    print(f"  MODE: Channel")
    print(f"  URL:  {channel_url}")
    print(f"  Count: {count}")
    print(f"{'='*60}")

    video_ids = _get_channel_video_ids(channel_url, count)
    if not video_ids:
        print("  [CHANNEL] No videos found.")
        return []

    results = []
    for i, vid in enumerate(video_ids, 1):
        print(f"\n  ── Video {i}/{len(video_ids)}: {vid} ──")
        try:
            data = scrape_single_video(vid)
            results.append(data)
            time.sleep(1)   # polite pause between requests
        except Exception as e:
            print(f"  [ERROR] Skipping {vid}: {e}")

    # Build filename from channel handle/path
    slug = re.sub(r"[^\w-]", "_", channel_url.rstrip("/").split("/")[-1])[:40]
    from datetime import timezone
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    _save_json(results, f"channel_{slug}_{ts}.json")
    return results


# ═══════════════════════════════════════════════════════════════════════════
# MODE 3 — SEARCH QUERY
# ═══════════════════════════════════════════════════════════════════════════

def _search_youtube(query: str, count: int) -> list[str]:
    """
    Use yt-dlp to search YouTube and return the top N video IDs.
    Uses ytsearch<N>: prefix.
    """
    print(f"  [SEARCH] Querying YouTube: '{query}' (top {count}) ...")
    search_url = f"ytsearch{count}:{query}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-check-certificate",
        "--flat-playlist",
        "--print", "id",
        "--quiet",
        "--no-warnings",
        search_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        ids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        print(f"  [SEARCH] [OK] Got {len(ids)} results")
        return ids[:count]
    except Exception as e:
        print(f"  [SEARCH] [FAIL] Search failed: {e}")
        return []


def mode_search(query: str, count: int = 5) -> list[dict]:
    """
    Search YouTube for a query and scrape the top N results.
    Saves to youtube_data/search_<query_slug>_<timestamp>.json
    Returns list of scraped dicts.
    """
    print(f"\n{'='*60}")
    print(f"  MODE: Search")
    print(f"  Query: {query!r}")
    print(f"  Count: {count}")
    print(f"{'='*60}")

    video_ids = _search_youtube(query, count)
    if not video_ids:
        print("  [SEARCH] No results found.")
        return []

    results = []
    for i, vid in enumerate(video_ids, 1):
        print(f"\n  -- Result {i}/{len(video_ids)}: {vid} --")
        try:
            data = scrape_single_video(vid)
            results.append(data)
            time.sleep(1)
        except Exception as e:
            print(f"  [ERROR] Skipping {vid}: {e}")

    slug = re.sub(r"\s+", "_", query.lower())[:40]
    slug = re.sub(r"[^\w-]", "", slug)
    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    _save_json(results, f"search_{slug}_{ts}.json")
    return results


# ═══════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — callable as  youtube_scraper(...)  from outside
# ═══════════════════════════════════════════════════════════════════════════

def youtube_clean_scraper(user_input: str, count: int = 5) -> dict | list[dict] | None:
    """
    A simplified entry point that automatically detects the input type.

    Logic:
    1. If it contains '/@' or '/channel/' or '/c/', it's treated as a Channel.
    2. If it contains 'watch?v=', 'youtu.be/', 'shorts/', or is an 11-char ID, it's a Video.
    3. Otherwise, it's treated as a Search Query.
    """
    input_stripped = user_input.strip()

    # 1. Check for Channel patterns
    if "youtube.com/@" in input_stripped or "/channel/" in input_stripped or "/c/" in input_stripped:
        print(f"[ROUTER] Detected Channel URL: {input_stripped}")
        return mode_channel(input_stripped, count=count)

    # 2. Check for Video patterns
    video_id = _video_id_from_url(input_stripped)
    if video_id and ("http" in input_stripped or len(input_stripped) == 11):
        print(f"[ROUTER] Detected Video URL/ID: {video_id}")
        return mode_video(input_stripped)

    # 3. Default to Search
    print(f"[ROUTER] Detected Search Query: {input_stripped!r}")
    return mode_search(input_stripped, count=count)


def youtube_scraper(
    mode: str = "auto",
    *,
    video_url:   Optional[str] = None,
    channel_url: Optional[str] = None,
    query:       Optional[str] = None,
    user_input:  Optional[str] = None,
    count:       int = 5,
) -> dict | list[dict] | None:
    """
    Unified entry point.

    Parameters
    ----------
    mode        : "video" | "channel" | "search" | "auto"
    video_url   : full YouTube video URL  (used for mode="video")
    channel_url : YouTube channel URL     (used for mode="channel")
    query       : search term             (used for mode="search")
    user_input  : generic input string    (used for mode="auto")
    count       : how many videos to scrape (used for channel / search modes)

    Returns
    -------
    dict          → for mode="video"
    list[dict]    → for mode="channel" or "search"
    None          → on error
    """
    mode = mode.strip().lower()

    if mode == "auto":
        target = user_input or query or video_url or channel_url
        if not target:
            raise ValueError("No input provided for mode='auto'")
        return youtube_clean_scraper(target, count=count)

    elif mode == "video":
        if not video_url:
            raise ValueError("video_url is required for mode='video'")
        return mode_video(video_url)

    elif mode == "channel":
        if not channel_url:
            raise ValueError("channel_url is required for mode='channel'")
        return mode_channel(channel_url, count=count)

    elif mode == "search":
        if not query:
            raise ValueError("query is required for mode='search'")
        if "youtube.com/" in query or "youtu.be/" in query:
            return youtube_clean_scraper(query, count=count)
        return mode_search(query, count=count)

    else:
        raise ValueError(f"Unknown mode: {mode!r}. Use 'video', 'channel', 'search', or 'auto'.")