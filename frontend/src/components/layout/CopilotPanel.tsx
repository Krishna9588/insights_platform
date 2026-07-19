import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { askChat, getChatSessions, getChatHistory } from '@/api';
import ReactMarkdown from 'react-markdown';
import { ProjectLogo } from '@/components/ProjectLogo';

const FAQ = [
  'What are the top complaints about this app?',
  'What features do competitors offer that we don\'t?',
  'What do SEBI regulations say about our category?',
  'Summarise the latest research findings',
  'What are the highest-rated competitor features?',
];

export default function CopilotPanel() {
  const {
    projects, chatMessages, chatProject, chatProvider, chatLoading, chatSessionId,
    setChatProject, addChatMessage, setChatMessages, setChatLoading, setChatSessionId, clearChat, showToast,
  } = useStore();

  const [input, setInput] = useState('');
  const [showFaq, setShowFaq] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const loadSession = async (id: string) => {
    if (!chatProject) return;
    try {
      const res = await getChatHistory(chatProject, id);
      setChatSessionId(id);
      setChatMessages(res.history || []);
    } catch {
      showToast('Could not load session');
    }
  };

  // Reload sessions when project changes
  useEffect(() => {
    if (chatProject) {
      getChatSessions(chatProject).then(res => {
        setSessions(res.sessions || []);
      }).catch(() => {});
    } else {
      setSessions([]);
    }
  }, [chatProject]);

  const send = async (q: string) => {
    if (!q.trim()) return;

    setInput('');
    setShowFaq(false);
    addChatMessage({ role: 'user', content: q, timestamp: new Date().toISOString() });
    setChatLoading(true);

    try {
      const res = await askChat({
        question: q,
        project_name: chatProject ?? '',
        provider: chatProvider,
        session_id: chatSessionId,
      });
      addChatMessage({
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toISOString(),
      });
      if (res.session_id && res.session_id !== chatSessionId) {
        setChatSessionId(res.session_id);
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
      <div className="copilot-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 700, textAlign: 'left' }}>Copilot</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
          {/* Custom Project Dropdown */}
          <div style={{ flex: 1, position: 'relative' }} ref={dropdownRef}>
            <button 
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '6px 12px', minHeight: 36, textAlign: 'left' }}
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            >
              {chatProject ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ProjectLogo name={chatProject} domain={projects.find((p: any) => p.project_name === chatProject || p.name === chatProject)?.domain} size={20} />
                  <span style={{ fontSize: 14 }}>{chatProject.startsWith('Monitor: ') ? chatProject.substring(9) : chatProject}</span>
                </div>
              ) : (
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>Select project...</span>
              )}
              <span style={{ fontSize: 10 }}>▼</span>
            </button>
            
            {isProjectDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {projects.map((p: any) => {
                    const name = p.project_name || p.name;
                    const cleanName = name.startsWith('Monitor: ') ? name.substring(9) : name;
                    return (
                      <div 
                        key={name}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: chatProject === name ? 'var(--surface-strong)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                        onClick={() => {
                          setChatProject(name);
                          setIsProjectDropdownOpen(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-strong)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = chatProject === name ? 'var(--surface-strong)' : 'transparent'}
                      >
                        <ProjectLogo name={name} domain={p.domain} size={20} />
                        <span style={{ fontSize: 14 }}>{cleanName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => { clearChat(); setChatProject(''); }}
            className="btn btn-secondary"
            title="New Chat"
            style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8 }}
          >
            <img src="/new-chat.png" alt="New Chat" style={{ width: 20, height: 20, objectFit: 'contain' }} />
          </button>
        </div>
      </div>

      {/* Chat log */}
      <div className="chat-log" ref={logRef}>
        {chatMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
              <img src="/assistant.png" alt="Assistant" style={{ width: 40, height: 40, objectFit: 'contain' }} />
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
            <div className="markdown-body">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
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
              placeholder={chatProject ? "Ask about " + (chatProject.startsWith('Monitor: ') ? chatProject.substring(9) : chatProject) + "..." : "Ask a general question or select a project..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button
              className="chat-submit-btn"
              onClick={() => send(input)}
              disabled={chatLoading || !input.trim()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: 0 }}
            >
              <img src="/send.png" alt="Send" style={{ width: 24, height: 24, opacity: (chatLoading || !input.trim()) ? 0.5 : 1, transition: 'opacity 0.2s' }} />
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
