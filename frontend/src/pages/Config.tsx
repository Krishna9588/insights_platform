import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import type { ApiKeyEntry } from '@/store';
import { getHealth, getAppConfig, saveAppConfig, getKeyStatus } from '@/api';
import BackButton from '@/components/layout/BackButton';
import { HiEye, HiEyeOff, HiChevronUp, HiChevronDown, HiInformationCircle } from 'react-icons/hi';
import { MdClose } from 'react-icons/md';

// Provider catalog — name, color, placeholder pattern, logo
const LOGO_TOKEN = 'pk_Tw38O-4_RNinmXOwNIgagQ';
const PROVIDERS: { id: string; label: string; color: string; placeholder: string; docs: string; logo: string }[] = [
  { id: 'gemini',       label: 'Google Gemini',   color: '#4285F4', placeholder: 'AIzaSy...',                         docs: 'https://aistudio.google.com/apikey',                  logo: `https://img.logo.dev/google.com?token=${LOGO_TOKEN}&size=32` },
  { id: 'openai',       label: 'OpenAI',           color: '#10A37F', placeholder: 'sk-...',                             docs: 'https://platform.openai.com/api-keys',                logo: `https://img.logo.dev/openai.com?token=${LOGO_TOKEN}&size=32` },
  { id: 'huggingface',  label: 'HuggingFace',      color: '#FF9D00', placeholder: 'hf_...',                            docs: 'https://huggingface.co/settings/tokens',              logo: `https://img.logo.dev/huggingface.co?token=${LOGO_TOKEN}&size=32` },
  { id: 'apify',        label: 'Apify',            color: '#1DB954', placeholder: 'apify_api_...',                     docs: 'https://console.apify.com/account/integrations',      logo: `https://img.logo.dev/apify.com?token=${LOGO_TOKEN}&size=32` },
  { id: 'serper',       label: 'Serper (Google)',  color: '#EA4335', placeholder: 'serper_...',                        docs: 'https://serper.dev/api-key',                          logo: `https://img.logo.dev/serper.dev?token=${LOGO_TOKEN}&size=32` },
  { id: 'youtube',      label: 'YouTube Data API', color: '#FF0000', placeholder: 'AIzaSy... (Google Cloud project)', docs: 'https://console.cloud.google.com/apis',               logo: `https://img.logo.dev/youtube.com?token=${LOGO_TOKEN}&size=32` },
  { id: 'reddit',       label: 'Reddit API',       color: '#FF4500', placeholder: 'client_id:client_secret',          docs: 'https://www.reddit.com/prefs/apps',                   logo: `https://img.logo.dev/reddit.com?token=${LOGO_TOKEN}&size=32` },
];

function maskKey(key: string) {
  if (!key || key.length < 8) return '●●●●●●●●';
  return key.slice(0, 6) + '●●●●●●●●' + key.slice(-4);
}

function SlideToggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="slide-toggle" onClick={onToggle}>
      <div className={`slide-toggle-track${on ? ' on' : ''}`}>
        <div className="slide-toggle-thumb" />
      </div>
      <span className="slide-toggle-label">{label}</span>
    </div>
  );
}

function ApiProviderCard({
  provider,
  label,
  color,
  placeholder,
  docs,
  logo,
  keys,
  onAdd,
  onRemove,
  onSetDefault,
}: {
  provider: string;
  label: string;
  color: string;
  placeholder: string;
  docs: string;
  logo: string;
  keys: ApiKeyEntry[];
  onAdd: (name: string, key: string, provider: string, isDefault: boolean) => void;
  onRemove: (id: string) => void;
  onSetDefault: (id: string, provider: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDefault, setNewDefault] = useState(keys.length === 0);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const toggle = (id: string) =>
    setShowKeys((s) => ({ ...s, [id]: !s[id] }));

  const submit = () => {
    if (!newKey.trim()) return;
    onAdd(newName || `Key ${keys.length + 1}`, newKey.trim(), provider, newDefault);
    setNewName(''); setNewKey(''); setAdding(false); setNewDefault(keys.length === 0);
  };

  return (
    <div className="api-key-card">
      <div
        className="api-key-card-header"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="api-key-card-title">
          <img src={logo} alt={label} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', background: '#fff' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          {label}
          {keys.length > 0 && (
            <span style={{
              background: color + '22', color, border: `1px solid ${color}44`,
              borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 600,
            }}>
              {keys.length} key{keys.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href={docs} target="_blank" rel="noopener noreferrer"
            className="button ghost compact"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--muted)' }}
          >
            Get key ↗
          </a>
          <span style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>
            {expanded ? <HiChevronUp size={18} /> : <HiChevronDown size={18} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div>
          <div className="api-key-list">
            {keys.length === 0 && (
              <p className="muted" style={{ padding: '4px 2px', fontSize: 13 }}>
                No keys added yet. Add one below.
              </p>
            )}
            {keys.map((k) => (
              <div className="api-key-row" key={k.id}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{k.name}</span>
                    {k.isDefault && (
                      <span style={{
                        background: 'var(--sage)', color: 'var(--success)', border: '1px solid rgba(21,128,61,0.2)',
                        borderRadius: 999, padding: '0 8px', fontSize: 11, fontWeight: 700,
                      }}>DEFAULT</span>
                    )}
                  </div>
                  <div className="api-key-value">
                    {showKeys[k.id] ? k.key : maskKey(k.key)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Added {new Date(k.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    className="button ghost compact"
                    onClick={() => toggle(k.id)}
                    title={showKeys[k.id] ? 'Hide key' : 'Reveal key'}
                  >
                    {showKeys[k.id] ? <HiEyeOff size={15} /> : <HiEye size={15} />}
                  </button>
                  {!k.isDefault && (
                    <button
                      className="button secondary compact"
                      onClick={() => onSetDefault(k.id, provider)}
                      style={{ fontSize: 12 }}
                    >
                      Set default
                    </button>
                  )}
                  <button
                    className="button danger compact"
                    onClick={() => onRemove(k.id)}
                    title="Remove key"
                  >
                    <MdClose size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {adding ? (
            <div style={{ padding: '0 10px 12px', display: 'grid', gap: 10 }}>
              <hr className="divider" />
              <div className="form-grid">
                <label>
                  Key name <span className="muted">(optional)</span>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder={`e.g. Production key`} />
                </label>
                <label>
                  API Key <span style={{ color: 'var(--danger)' }}>*</span>
                  <input type="password" className="input-masked" value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={(e) => e.key === 'Enter' && submit()} />
                </label>
              </div>
              <SlideToggle
                on={newDefault}
                onToggle={() => setNewDefault((v) => !v)}
                label="Set as default key for this provider"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="button compact" onClick={submit} disabled={!newKey.trim()}>
                  Add Key
                </button>
                <button className="button secondary compact" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '0 10px 12px' }}>
              <button className="button secondary compact" onClick={() => setAdding(true)}>
                + Add key
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Config() {
  const { apiKeys, addApiKey, removeApiKey, setApiKeys, pipelineDefaults, setPipelineDefaults, showToast, setGoogleDriveConfig } = useStore();
  const [health, setHealth] = useState<{ status: string; ok: boolean } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [testDriveId, setTestDriveId] = useState('');
  const [testDriveLoading, setTestDriveLoading] = useState(false);
  const [driveFileCount, setDriveFileCount] = useState<number | null>(null);

  // Clipboard copy utility
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const r = await getHealth();
      setHealth({ status: r.status ?? 'ok', ok: true });
    } catch {
      setHealth({ status: 'Cannot reach backend — is it running on port 8000?', ok: false });
    } finally {
      setHealthLoading(false);
    }
  };

  const handleTestDrive = async () => {
    if (!testDriveId.trim()) {
      showToast('Please enter a Folder ID to test');
      return;
    }
    setTestDriveLoading(true);
    try {
      const { testDriveConnection } = await import('@/api');
      const res: any = await testDriveConnection(testDriveId.trim());
      setDriveFileCount(res.file_count || 0);
      showToast(res.message || 'Drive connection successful!');
    } catch (err: any) {
      setDriveFileCount(null);
      showToast('Drive connection failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setTestDriveLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const r = await getAppConfig() as { values: Record<string, unknown> };
      const v = r.values ?? {};
      // Load saved API keys
      if (Array.isArray(v.api_keys)) {
        setApiKeys(v.api_keys as ApiKeyEntry[]);
      }
      // Load pipeline defaults
      if (v.pipeline_defaults) {
        setPipelineDefaults(v.pipeline_defaults as typeof pipelineDefaults);
      }
      if (v.google_drive) {
        setGoogleDriveConfig(v.google_drive as { defaultFolderId: string });
        setTestDriveId((v.google_drive as { defaultFolderId: string }).defaultFolderId || '');
      }
      setConfigLoaded(true);
    } catch {
      setConfigLoaded(true);
    }
  };

  const saveConfig = async () => {
    try {
      await saveAppConfig({
        api_keys: apiKeys,
        pipeline_defaults: pipelineDefaults,
        google_drive: { defaultFolderId: testDriveId },
      });
      setGoogleDriveConfig({ defaultFolderId: testDriveId });
      showToast('Configuration saved');
    } catch {
      showToast('Failed to save — is backend running?');
    }
  };

  const handleSetDefault = (id: string, provider: string) => {
    setApiKeys(
      apiKeys.map((k) =>
        k.provider === provider
          ? { ...k, isDefault: k.id === id }
          : k
      )
    );
  };

  useEffect(() => {
    checkHealth();
    loadConfig();
  }, []);

  return (
    <>
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">System</p>
          <h1>Settings</h1>
        </div>
        <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="button secondary" onClick={checkHealth} disabled={healthLoading}>
            {healthLoading ? <span className="spinner dark" /> : 'Check Status'}
          </button>

          {health && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: health.ok ? 'var(--success)' : 'var(--danger)' }}>
              <div className={`dot ${health.ok ? 'ok' : 'bad'}`} />
              <span>Backend: {health.status}</span>
            </div>
          )}

          <button className="button" onClick={saveConfig}>
            Save
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 24 }}>

        {/* ── Pipeline Defaults ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>Pipeline Defaults</h3>
            <SlideToggle
              on={pipelineDefaults.enabled}
              onToggle={() => setPipelineDefaults({ enabled: !pipelineDefaults.enabled })}
              label={pipelineDefaults.enabled ? 'Defaults active — data pages will use these' : 'Defaults disabled — pages show all options'}
            />
          </div>

          <div className={`settings-panel`} style={{ opacity: pipelineDefaults.enabled ? 1 : 0.5 }}>
            <div className="form-grid">
              <label>
                Global Model (Pipeline & Deep Research)
                <select
                  value={pipelineDefaults.provider}
                  onChange={(e) => setPipelineDefaults({ provider: e.target.value })}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="gemini_2">Gemini 2.0</option>
                  <option value="openai">OpenAI GPT-4</option>
                  <option value="huggingface">HuggingFace</option>
                </select>
              </label>
              <label>
                Chat Model (Copilot)
                <select
                  value={useStore((s: any) => s.chatProvider)}
                  onChange={(e) => useStore.getState().setChatProvider(e.target.value)}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="gemini_2">Gemini 2.0</option>
                  <option value="openai">OpenAI GPT-4</option>
                  <option value="huggingface">HuggingFace</option>
                </select>
              </label>
              <label>
                Default Start From
                <select
                  value={pipelineDefaults.start_from}
                  onChange={(e) => setPipelineDefaults({ start_from: e.target.value })}
                  disabled={!pipelineDefaults.enabled}
                >
                  <option value="agent1">Agent 1 — Scrape & Orchestrate</option>
                  <option value="agent2">Agent 2 — Insight Extraction</option>
                  <option value="agent3">Agent 3 — Synthesis</option>
                  <option value="agent4">Agent 4 — Product Brief</option>
                </select>
              </label>
            </div>
            <label>
              Run Only One Agent <span className="muted">(optional — overrides Start From)</span>
              <select
                value={pipelineDefaults.only}
                onChange={(e) => setPipelineDefaults({ only: e.target.value })}
                disabled={!pipelineDefaults.enabled}
              >
                <option value="">Run full pipeline (default)</option>
                <option value="agent1">Agent 1 only</option>
                <option value="agent2">Agent 2 only</option>
                <option value="agent3">Agent 3 only</option>
                <option value="agent4">Agent 4 only</option>
              </select>
            </label>
            <div className="soft-band" style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <HiInformationCircle size={16} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: 2 }} />
              <span> When defaults are <strong>enabled</strong>, the Deep Research and other data pages will
              use these settings automatically — the advanced options panel will still be available to override them.
              </span>
            </div>
          </div>
        </div>

        {/* ── API Keys ── */}
        <div>
          <div className="section-head">
            <h2>API Keys</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Keys are stored locally and sent to the backend config. Never shared externally.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {PROVIDERS.map((p) => (
              <ApiProviderCard
                key={p.id}
                provider={p.id}
                label={p.label}
                color={p.color}
                placeholder={p.placeholder}
                docs={p.docs}
                logo={p.logo}
                keys={apiKeys.filter((k) => k.provider === p.id)}
                onAdd={(name, key, provider, isDefault) =>
                  addApiKey({ name, key, provider, isDefault })
                }
                onRemove={removeApiKey}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        </div>

        {/* ── Google Drive ── */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Google Drive Integration</h3>
          <div className="form" style={{ maxWidth: 560 }}>
            <label>
              Credentials JSON Path
              <input placeholder="e.g. credentials/google_credentials.json" />
            </label>
            <label>
              Default Folder ID
              <input 
                placeholder="Paste a Google Drive folder ID" 
                value={testDriveId} 
                onChange={(e) => { setTestDriveId(e.target.value); setDriveFileCount(null); }} 
              />
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button 
                className="button secondary compact" 
                onClick={handleTestDrive}
                disabled={testDriveLoading}
              >
                {testDriveLoading ? 'Testing...' : 'Test Connection'}
              </button>
              <button className="button compact" onClick={saveConfig}>Save Drive</button>
              {driveFileCount !== null && (
                <span style={{ 
                  color: 'var(--success)', 
                  border: '1px solid var(--success)', 
                  padding: '4px 10px', 
                  borderRadius: 6, 
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}>
                  {driveFileCount} files found — connection successful
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Save reminder ── */}
        <div className="soft-band" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Changes are saved to the backend config file when you click <strong>Save</strong>.
          </span>
          <button className="button" onClick={saveConfig}>Save</button>
        </div>
      </div>
    </div>
    <BackButton fallback="dashboard" />
    </>
  );
}
