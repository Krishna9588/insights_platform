import { useState } from 'react';
import { useStore } from '@/store';
import { ingestTranscripts, ingestGoogleDrive } from '@/api';

export default function Transcript() {
  const { showToast, pipelineDefaults } = useStore();
  const [tab, setTab] = useState<'local' | 'drive'>('local');
  const [form, setForm] = useState({ project_name: '', input_path: '' });
  const [drive, setDrive] = useState({ project_name: '', folder_id: '' });
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const provider = pipelineDefaults.provider || 'gemini';

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setD = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDrive((f) => ({ ...f, [k]: e.target.value }));

  const submitLocal = async () => {
    if (!form.project_name || !form.input_path) { showToast('Fill in all fields'); return; }
    setLoading(true);
    try {
      await ingestTranscripts({ project_name: form.project_name, input_path: form.input_path, provider });
      showToast('Transcript ingestion started');
    } catch { showToast('Failed to ingest transcripts'); }
    finally { setLoading(false); }
  };

  const submitDrive = async () => {
    if (!drive.project_name || !drive.folder_id) { showToast('Fill in all fields'); return; }
    setLoading(true);
    try {
      await ingestGoogleDrive({ project_name: drive.project_name, folder_id: drive.folder_id, provider });
      showToast('Google Drive ingestion started');
    } catch { showToast('Failed to connect to Drive'); }
    finally { setLoading(false); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      // In a local Electron/Chromium environment this might provide the absolute path.
      // Otherwise, it provides the name.
      const path = (file as unknown as { path?: string }).path || file.name;
      setForm((f) => ({ ...f, input_path: path }));
    }
  };

  return (
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>Transcript Ingestion</h1></div>
        {pipelineDefaults.enabled && (
          <div className="soft-band" style={{ padding: '8px 14px', fontSize: 13 }}>
            ⚡ Using defaults from Configurations
          </div>
        )}
      </header>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Transcripts</h3>
          <div className="form">
            <label>Project Name<input value={form.project_name} onChange={setF('project_name')} placeholder="e.g. Groww" /></label>
            
            <label>Input Folder or File Path
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '2px dashed var(--accent-blue)' : '2px dashed var(--hairline)',
                  borderRadius: 8,
                  padding: 32,
                  textAlign: 'center',
                  background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-strong)',
                  transition: 'all 0.2s',
                  marginTop: 8,
                  marginBottom: 16
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📥</div>
                <p style={{ margin: 0, fontWeight: 500 }}>Drag and drop transcript file or folder here</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>or type the absolute path below</p>
              </div>
              <input value={form.input_path} onChange={setF('input_path')} placeholder="e.g. C:/data/transcripts/groww" />
            </label>
            
            <div><button className="button" onClick={submitLocal} disabled={loading}>
              {loading ? 'Processing…' : 'Ingest Transcripts'}
            </button></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Google Drive</h3>
          <div className="soft-band" style={{ marginBottom: 16 }}>
            <p className="muted">Make sure your Google Drive credentials are configured in Configurations.</p>
          </div>
          <div className="form">
            <label>Project Name<input value={drive.project_name} onChange={setD('project_name')} placeholder="e.g. Groww" /></label>
            <label>Google Drive Folder ID<input value={drive.folder_id} onChange={setD('folder_id')} placeholder="Paste the folder ID from the Drive URL" /></label>
            <div><button className="button" onClick={submitDrive} disabled={loading}>
              {loading ? 'Connecting…' : 'Ingest from Drive'}
            </button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
