"""
Local RAG service for project evidence search and answer grounding.

This is intentionally dependency-light for the application MVP. It indexes
project db_document.json files into SQLite FTS and exposes a stable interface
that can later be backed by pgvector, Supabase, or a hosted embedding service.
"""

from __future__ import annotations

import json
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from agents.paths import DB_FILE, DB_ROOT, project_db_path


MAX_CHUNK_CHARS = 1400
MIN_CHUNK_CHARS = 80


@dataclass
class EvidenceChunk:
    id: str
    project_name: str
    source_type: str
    source_name: str
    section: str
    content: str
    metadata: Dict[str, Any]
    score: float = 0.0


@dataclass
class GroundingResult:
    confidence: str
    score: float
    warnings: List[str]
    sources: List[Dict[str, Any]]


def _now() -> str:
    return datetime.utcnow().isoformat()


def _stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _tokenize(value: str) -> List[str]:
    return re.findall(r"[a-zA-Z0-9]{3,}", value.lower())


def _flatten(value: Any, prefix: str = "") -> Iterable[tuple[str, str]]:
    if value is None:
        return
    if isinstance(value, dict):
        for key, nested in value.items():
            section = f"{prefix}.{key}" if prefix else str(key)
            yield from _flatten(nested, section)
        return
    if isinstance(value, list):
        for index, nested in enumerate(value):
            section = f"{prefix}[{index}]"
            yield from _flatten(nested, section)
        return

    text = _clean_text(str(value))
    if text:
        yield prefix or "value", text


def _chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> Iterable[str]:
    text = _clean_text(text)
    if len(text) <= max_chars:
        if len(text) >= MIN_CHUNK_CHARS:
            yield text
        return

    sentences = re.split(r"(?<=[.!?])\s+", text)
    current: List[str] = []
    current_len = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if current and current_len + len(sentence) + 1 > max_chars:
            chunk = " ".join(current)
            if len(chunk) >= MIN_CHUNK_CHARS:
                yield chunk
            current = []
            current_len = 0
        current.append(sentence)
        current_len += len(sentence) + 1

    if current:
        chunk = " ".join(current)
        if len(chunk) >= MIN_CHUNK_CHARS:
            yield chunk


class LocalRAGService:
    """SQLite-backed evidence index for project-level and global search."""

    def __init__(self, db_path: Path = DB_FILE):
        self.db_path = db_path
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_documents (
                    id TEXT PRIMARY KEY,
                    project_name TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    section TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS rag_documents_fts
                USING fts5(
                    content,
                    project_name UNINDEXED,
                    source_type UNINDEXED,
                    source_name UNINDEXED,
                    section UNINDEXED,
                    content='rag_documents',
                    content_rowid='rowid'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_index_runs (
                    project_name TEXT PRIMARY KEY,
                    chunk_count INTEGER NOT NULL,
                    indexed_at TEXT NOT NULL
                )
                """
            )
            conn.commit()
            self._rebuild_fts(conn)

    def _rebuild_fts(self, conn: sqlite3.Connection) -> None:
        conn.execute("INSERT INTO rag_documents_fts(rag_documents_fts) VALUES('rebuild')")

    def status(self) -> Dict[str, Any]:
        with self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM rag_documents").fetchone()[0]
            projects = conn.execute(
                """
                SELECT project_name, COUNT(*) AS chunk_count
                FROM rag_documents
                GROUP BY project_name
                ORDER BY project_name
                """
            ).fetchall()
            runs = conn.execute(
                "SELECT project_name, chunk_count, indexed_at FROM rag_index_runs ORDER BY indexed_at DESC"
            ).fetchall()
        return {
            "enabled": True,
            "backend": "sqlite_fts",
            "total_chunks": total,
            "projects": [dict(row) for row in projects],
            "last_index_runs": [dict(row) for row in runs],
        }

    def index_all_projects(self) -> Dict[str, Any]:
        indexed = []
        if DB_ROOT.exists():
            for db_file in sorted(DB_ROOT.glob("*/db_document.json")):
                indexed.append(self.index_project(db_file.parent.name))
        return {"indexed_projects": indexed, "status": self.status()}

    def index_project(self, project_name: str) -> Dict[str, Any]:
        path = project_db_path(project_name)
        if not path.exists():
            raise FileNotFoundError(f"Project not found: {project_name}")

        with path.open("r", encoding="utf-8") as f:
            db_document = json.load(f)

        chunks = list(self._build_project_chunks(project_name, db_document, path))
        now = _now()
        with self._connect() as conn:
            conn.execute("DELETE FROM rag_documents WHERE project_name = ?", (project_name,))
            for chunk in chunks:
                conn.execute(
                    """
                    INSERT INTO rag_documents (
                        id, project_name, source_type, source_name, section,
                        content, metadata, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chunk.id,
                        chunk.project_name,
                        chunk.source_type,
                        chunk.source_name,
                        chunk.section,
                        chunk.content,
                        _stable_json(chunk.metadata),
                        now,
                        now,
                    ),
                )
            conn.execute(
                """
                INSERT OR REPLACE INTO rag_index_runs (project_name, chunk_count, indexed_at)
                VALUES (?, ?, ?)
                """,
                (project_name, len(chunks), now),
            )
            self._rebuild_fts(conn)
            conn.commit()

        return {"project_name": project_name, "chunk_count": len(chunks), "indexed_at": now}

    def _build_project_chunks(
        self,
        project_name: str,
        db_document: Dict[str, Any],
        source_path: Path,
    ) -> Iterable[EvidenceChunk]:
        base_metadata = {"file": str(source_path)}

        project_summary = {
            "project_name": db_document.get("project_name"),
            "domain": db_document.get("domain"),
            "ingestion_date": db_document.get("ingestion_date"),
            "processing_status": db_document.get("processing_status"),
        }
        yield from self._chunks_from_value(
            project_name,
            "project",
            "db_document",
            "project_summary",
            project_summary,
            base_metadata,
        )

        for source_name, source_value in (db_document.get("data_sources") or {}).items():
            yield from self._chunks_from_value(
                project_name,
                "data_source",
                source_name,
                f"data_sources.{source_name}",
                source_value,
                base_metadata,
            )

        for output_name in ["agent2_output", "agent3_output", "agent4_output"]:
            yield from self._chunks_from_value(
                project_name,
                "agent_output",
                output_name,
                output_name,
                db_document.get(output_name) or {},
                base_metadata,
            )

    def _chunks_from_value(
        self,
        project_name: str,
        source_type: str,
        source_name: str,
        section: str,
        value: Any,
        metadata: Dict[str, Any],
    ) -> Iterable[EvidenceChunk]:
        if value in ({}, [], None, ""):
            return

        if isinstance(value, (dict, list)):
            flattened = list(_flatten(value, section))
            if not flattened:
                return
            text = "\n".join(f"{path}: {content}" for path, content in flattened)
        else:
            text = str(value)

        for index, content in enumerate(_chunk_text(text)):
            yield EvidenceChunk(
                id=str(uuid.uuid4()),
                project_name=project_name,
                source_type=source_type,
                source_name=source_name,
                section=f"{section}#{index + 1}",
                content=content,
                metadata=metadata,
            )

    def search(
        self,
        query: str,
        project_name: Optional[str] = None,
        limit: int = 8,
    ) -> List[EvidenceChunk]:
        safe_query = " OR ".join(_tokenize(query)[:12])
        if not safe_query:
            return []

        with self._connect() as conn:
            params: List[Any] = [safe_query]
            where = "rag_documents_fts MATCH ?"
            if project_name:
                where += " AND d.project_name = ?"
                params.append(project_name)
            params.append(limit)
            rows = conn.execute(
                f"""
                SELECT
                    d.id,
                    d.project_name,
                    d.source_type,
                    d.source_name,
                    d.section,
                    d.content,
                    d.metadata,
                    bm25(rag_documents_fts) AS rank_score
                FROM rag_documents_fts
                JOIN rag_documents d ON d.rowid = rag_documents_fts.rowid
                WHERE {where}
                ORDER BY rank_score
                LIMIT ?
                """,
                params,
            ).fetchall()

        chunks = []
        for row in rows:
            score = max(0.0, min(1.0, 1.0 / (1.0 + abs(float(row["rank_score"] or 0)))))
            chunks.append(
                EvidenceChunk(
                    id=row["id"],
                    project_name=row["project_name"],
                    source_type=row["source_type"],
                    source_name=row["source_name"],
                    section=row["section"],
                    content=row["content"],
                    metadata=json.loads(row["metadata"] or "{}"),
                    score=score,
                )
            )
        return chunks

    def build_context(self, chunks: List[EvidenceChunk], max_chars: int = 5000) -> str:
        lines: List[str] = []
        size = 0
        for index, chunk in enumerate(chunks, start=1):
            label = (
                f"[{index}] project={chunk.project_name}; "
                f"source={chunk.source_type}/{chunk.source_name}; section={chunk.section}"
            )
            block = f"{label}\n{chunk.content}"
            if size + len(block) > max_chars:
                break
            lines.append(block)
            size += len(block)
        return "\n\n".join(lines)

    def validate_answer(self, answer: str, chunks: List[EvidenceChunk]) -> GroundingResult:
        warnings: List[str] = []
        if not chunks:
            return GroundingResult(
                confidence="low",
                score=0.0,
                warnings=["No evidence was retrieved for this question."],
                sources=[],
            )

        answer_terms = set(_tokenize(answer))
        evidence_terms = set(_tokenize(" ".join(chunk.content for chunk in chunks)))
        overlap = len(answer_terms & evidence_terms)
        score = min(1.0, overlap / max(8, len(answer_terms) * 0.35))

        if len(answer.strip()) < 40:
            warnings.append("Answer is very short; review whether it is useful enough.")
        if score < 0.25:
            warnings.append("Answer has weak lexical overlap with retrieved evidence.")
        if len(chunks) < 2:
            warnings.append("Only one evidence source was retrieved.")

        if score >= 0.65 and len(chunks) >= 2:
            confidence = "high"
        elif score >= 0.35:
            confidence = "medium"
        else:
            confidence = "low"

        return GroundingResult(
            confidence=confidence,
            score=round(score, 3),
            warnings=warnings,
            sources=[self.chunk_to_dict(chunk, include_content=False) for chunk in chunks],
        )

    @staticmethod
    def chunk_to_dict(chunk: EvidenceChunk, include_content: bool = True) -> Dict[str, Any]:
        data = {
            "id": chunk.id,
            "project_name": chunk.project_name,
            "source_type": chunk.source_type,
            "source_name": chunk.source_name,
            "section": chunk.section,
            "score": round(chunk.score, 4),
            "metadata": chunk.metadata,
        }
        if include_content:
            data["content"] = chunk.content
        return data


_rag_service_instance: Optional[LocalRAGService] = None


def get_rag_service() -> LocalRAGService:
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = LocalRAGService()
    return _rag_service_instance
