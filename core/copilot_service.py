"""
copilot_service.py
==================
Enhanced Copilot service with persistent chat memory via vector DB.

Replaces the old ask_copilot function with stateful sessions that persist
across API calls and load past context automatically.
"""

import json
import logging
from typing import Optional, Tuple, List, Dict, Any
from datetime import date

try:
    from core.database import get_db
    from core.vector_db import get_vector_db
    from agents.paths import project_db_path, summary_file
    from agents.model_connect import call_llm
except ModuleNotFoundError:
    from database import get_db
    from vector_db import get_vector_db
    from paths import project_db_path, summary_file
    from model_connect import call_llm

log = logging.getLogger("copilot_service")


class EnhancedCopilot:
    """Copilot with persistent memory, vector search, and daily context."""

    def __init__(self, project_name: str, provider: str = "gemini"):
        self.project_name = project_name
        self.project_names = [p.strip() for p in project_name.split(",") if p.strip()]
        self.provider = provider
        self.db = get_db()
        self.vector_db = get_vector_db()
        self.db_docs = self._load_db_documents()

    def _load_db_documents(self) -> dict:
        """Load the full research knowledge base for all projects."""
        docs = {}
        for pname in self.project_names:
            path = project_db_path(pname)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    docs[pname] = json.load(f)
        return docs

    def _build_enhanced_knowledge_base(self) -> dict:
        """Build knowledge base with vector similarities and past context for all projects."""
        combined_kb = {}

        for pname in self.project_names:
            if pname not in self.db_docs:
                continue
                
            db_doc = self.db_docs[pname]
            kb = {}

            # Basic profile and structures (from original)
            cp = db_doc.get("data_sources", {}).get("company_profile", {})
            profile = cp.get("data") or cp

            if isinstance(profile, dict) and not profile.get("error"):
                kb["company_profile"] = {
                    "company_name": profile.get("company_name"),
                    "domain": profile.get("domain"),
                    "positioning": profile.get("key_positioning"),
                    "revenue_model": profile.get("revenue_model"),
                    "competitors": profile.get("competitors", []),
                }

            # Problems, insights, briefs
            agent2 = db_doc.get("agent2_output", {})
            if agent2.get("problems"):
                kb["validated_problems"] = agent2.get("problems", [])[:10]

            agent3 = db_doc.get("agent3_output", {})
            if agent3.get("insights"):
                kb["strategic_insights"] = agent3.get("insights", [])[:10]

            agent4 = db_doc.get("agent4_output", {})
            if agent4.get("briefs"):
                kb["product_briefs"] = agent4.get("briefs", [])[:5]

            # Latest daily summary (if exists)
            today = date.today().isoformat()
            summary = self.db.get_summary(pname, today)
            if summary:
                kb["today_summary"] = summary.summary_md

            # Transcripts / Calls / Signals
            data_sources = db_doc.get("data_sources", {})
            transcripts = data_sources.get("internal_transcripts_drive", [])
            if isinstance(transcripts, dict):
                transcripts = [transcripts]
                
            local_ts = data_sources.get("internal_transcripts", [])
            if isinstance(local_ts, dict):
                local_ts = [local_ts]
                
            transcripts = transcripts + local_ts
            if transcripts:
                kb["transcripts_signals"] = []
                for t in transcripts:
                    signals = t.get("signals", [])
                    for s in signals:
                        kb["transcripts_signals"].append({
                            "content": s.get("content"),
                            "type": s.get("signal_type")
                        })
                        
            combined_kb[pname] = kb

        return combined_kb

    def _get_rich_context(self, query: str) -> str:
        """Get context from vector search + daily summary + knowledge base."""
        context_parts = []

        # 1. Similar past messages from vector DB (aggregate across projects)
        if self.project_names and self.vector_db.is_enabled():
            for pname in self.project_names:
                similar = self.vector_db.search_similar(pname, query, limit=3)
                if similar:
                    context_parts.append(f"--- SIMILAR PAST DISCUSSIONS ({pname}) ---")
                    for item in similar:
                        context_parts.append(f"({item['role']}) {item['content'][:150]}...")

        # 2. Today's summary if available (aggregate across projects)
        if self.project_names:
            today = date.today().isoformat()
            for pname in self.project_names:
                summary = self.db.get_summary(pname, today)
                if summary:
                    context_parts.append(f"\n--- TODAY'S SUMMARY ({pname}) ---")
                    context_parts.append(summary.summary_md[:500])

        # 3. Knowledge base
        kb = self._build_enhanced_knowledge_base()
        kb_str = json.dumps(kb, indent=2)[:100000]  # Allow much larger context for modern LLMs
        context_parts.append("\n--- RESEARCH KNOWLEDGE BASE ---")
        context_parts.append(kb_str)

        return "\n".join(context_parts)

    def ask(self, question: str, session_id: Optional[str] = None) -> Tuple[str, str]:
        """
        Ask a question and get an answer with persistent memory.

        If session_id not provided, creates new session.

        Returns:
            (answer, session_id)
        """
        # Create or get session
        if not session_id:
            # Generate a brief title from the first question
            title_prompt = f"Summarize this question in 2-4 words for a chat session title: {question}"
            try:
                title_response = call_llm(
                    prompt=title_prompt,
                    system_prompt="You are a helpful assistant. Output ONLY the short title.",
                    provider=self.provider,
                    json_mode=False
                )
                title = title_response.strip().replace('"', '')
            except Exception:
                title = "New Chat"
                
            session_id = self.db.create_session(self.project_name, title=title)
            log.info(f"Created new session {session_id} with title {title}")

        # Get session messages (conversation history)
        messages = self.db.get_session_messages(session_id)
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        # Get rich context from vectors + summaries + KB
        context = self._get_rich_context(question)

        # Build system prompt
        proj_display = ", ".join(self.project_names)
        system_prompt = f"""You are a Product Research Copilot analyzing: {proj_display}.

If multiple projects are listed, you are expected to compare them, synthesize information across them, and answer questions based on the combined data.

You have access to:
- Full research knowledge base with company profile, problems, insights, briefs
- Similar past discussions from this project (via semantic search)
- Today's conversation summary
- Previous conversation history

CONTEXT:
{context}

INSTRUCTIONS:
1. Try to ground your answer in the research data and conversation history first
2. Reference specific problems, insights, or briefs when relevant
3. If asked about something not in the data, state in one single line that this is out of scope of our research, and then provide the answer using your general knowledge capabilities.
4. Use the past context to avoid repeating discussions
5. Be concise and actionable"""

        # Call LLM with full history
        try:
            history.append({"role": "user", "content": question})

            response = call_llm(
                prompt=question,
                system_prompt=system_prompt,
                provider=self.provider,
                messages=history,
                json_mode=False,
            )
            answer = response.strip()
        except TypeError:
            # Fallback: build history into prompt
            history_text = "\n".join([f"{m['role']}: {m['content'][:200]}" for m in history[:-1]])
            response = call_llm(
                prompt=f"{history_text}\n\nUser: {question}",
                system_prompt=system_prompt,
                provider=self.provider,
                json_mode=False,
            )
            answer = response.strip()

        # Store in database
        self.db.add_message(session_id, "user", question)
        self.db.add_message(session_id, "assistant", answer)

        # Store in vector DB (async in production, sync for MVP)
        if self.vector_db.is_enabled():
            self.vector_db.store_chat_message(
                self.project_name,
                session_id,
                f"{session_id}_user_{len(messages)}",
                "user",
                question,
            )
            self.vector_db.store_chat_message(
                self.project_name,
                session_id,
                f"{session_id}_asst_{len(messages)}",
                "assistant",
                answer,
            )

        log.info(f"Copilot: answered for {self.project_name} session {session_id}")
        return answer, session_id

    def get_session_history(self, session_id: str) -> List[Dict[str, str]]:
        """Retrieve full conversation history for a session."""
        messages = self.db.get_session_messages(session_id)
        return [
            {"role": msg.role, "content": msg.content, "timestamp": msg.timestamp}
            for msg in messages
        ]

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """List all active sessions for this project."""
        sessions = self.db.list_project_sessions(self.project_name)
        result = []
        for session in sessions:
            messages = self.db.get_session_messages(session.id)
            result.append({
                "session_id": session.id,
                "title": getattr(session, 'title', "New Chat"),
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "messages_count": len(messages),
                "preview": messages[-1].content[:100] if messages else "No messages",
            })
        return result


def create_copilot(project_name: str, provider: str = "gemini") -> EnhancedCopilot:
    """Factory function to create a copilot instance."""
    return EnhancedCopilot(project_name, provider)

