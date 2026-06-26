import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { askChat, getChatSessions, getChatHistory } from '@/api';

const FAQ = [
  'What are the top complaints about this app?',
  'What features do competitors offer that we don\'t?',
  'What do SEBI regulations say about our category?',
  'Summarise the latest research findings',
  'What are the highest-rated competitor features?',
];

export default function CopilotPanel() {
  const {
    chatMessages, chatProject, chatProvider, chatLoading, chatSessionId,
    addChatMessage, setChatMessages, setChatLoading, setChatSessionId, clearChat, showToast,
  } = useStore();

  const [input, setInput] = useState('');
  const [showFaq, setShowFaq] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Load history when project changes
  useEffect(() => {
    if (chatProject) {
      getChatSessions(chatProject).then(res => {
        setSessions(res.data.sessions || []);
      }).catch(console.error);
    } else {
      setSessions([]);
    }
  }, [chatProject, chatSessionId]);

  const loadSession = async (id: string) => {
    if (!id || !chatProject) return;
    try {
      setChatLoading(true);
      const res = await getChatHistory(chatProject, id);
      setChatMessages(res.data.history || []);
      setChatSessionId(id);
      setShowFaq(false);
    } catch (e) {
      showToast('Failed to load history');
    } finally {
      setChatLoading(false);
    }
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || chatLoading) return;
    setInput('');
    setShowFaq(false);
    addChatMessage({ role: 'user', content: q, timestamp: new Date().toISOString() });
    setChatLoading(true);

    try {
      const res = await askChat({
        question: q,
        project_name: chatProject ?? 'Unknown',
        provider: chatProvider,
        session_id: chatSessionId,
      });
      addChatMessage({
        role: 'assistant',
        content: res.data.answer,
        timestamp: new Date().toISOString(),
      });
      if (res.data.session_id && res.data.session_id !== chatSessionId) {
        setChatSessionId(res.data.session_id);
      }
    } catch (err) {
      showToast('Copilot error — check backend');
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I could not get a response. Please check the backend is running.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <aside className="copilot">
      <div className="copilot-header">
        <div>
          <h2>Copilot</h2>
          <p className="muted" style={{ marginTop: 2, fontSize: 13 }}>
            {chatProject ? `Project: ${chatProject}` : 'Insights Assistant'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={chatSessionId || ''}
            onChange={(e) => e.target.value ? loadSession(e.target.value) : clearChat()}
            style={{ minHeight: 32, fontSize: 13, padding: '0 8px', width: 120, borderRadius: 8, background: 'var(--surface-strong)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
          >
            <option value="">New Chat 📝</option>
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>
                {s.title}
              </option>
            ))}
          </select>
          <select
            value={chatProvider}
            onChange={(e) => useStore.getState().setChatProvider(e.target.value)}
            style={{ minHeight: 32, fontSize: 13, padding: '0 8px', width: 'auto', borderRadius: 8 }}
          >
            <option value="gemini">Gemini</option>
            <option value="gemini_2">Gemini 2</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      {/* Chat log */}
      <div className="chat-log" ref={logRef}>
        {chatMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-blue)', display: 'grid', placeItems: 'center', fontSize: 24, marginBottom: 16 }}>
              ✨
            </div>
            <h3 style={{ color: 'var(--ink)', fontSize: 18, marginBottom: 8 }}>How can I help?</h3>
            <p className="muted" style={{ textAlign: 'center', maxWidth: 280, fontSize: 14, marginBottom: 24 }}>
              Ask me about market insights, competitors, or specific details from your synthesized projects.
            </p>
            {/* FAQ shortcuts */}
            {showFaq && (
              <div className="faq-list">
                {FAQ.slice(0, 3).map((q) => (
                  <button key={q} className="faq-btn" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {chatMessages.map((msg, i) => (
          <div key={i} className={`message${msg.role === 'user' ? ' user' : ''}`}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.sources && msg.sources.length > 0 && (
              <small>Sources: {msg.sources.map((s: any) => typeof s === 'string' ? s : (s.title || s.url || s.name || JSON.stringify(s))).join(', ')}</small>
            )}
            {msg.timestamp && <small>{fmt(msg.timestamp)}</small>}
          </div>
        ))}
        {chatLoading && (
          <div className="message" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner" style={{ width: 14, height: 14 }} />
            <span style={{ color: 'var(--muted)' }}>Thinking…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="chat-form-container">
        <div className="chat-form">
          <div className="chat-row">
            <textarea
              className="chat-input"
              placeholder={chatProject ? "Ask about " + chatProject + "..." : "Ask anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button
              className="chat-submit-btn"
              onClick={() => send(input)}
              disabled={chatLoading || !input.trim()}
            >
              ↑
            </button>
          </div>
        </div>
        <p className="muted chat-hint" style={{ fontSize: 11 }}>
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </aside>
  );
}
