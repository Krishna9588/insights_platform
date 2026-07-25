import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store';
import { fetchGoogleDriveFiles, ingestCombined } from '@/api';
import BackButton from '@/components/layout/BackButton';
import { HiLightningBolt, HiInformationCircle, HiUpload, HiFolder, HiDocumentText } from 'react-icons/hi';
import { MdClose } from 'react-icons/md';

function GoogleDriveLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path fill="#FFC107" d="M339 367.6L173 80h166l166 287.6z"/>
      <path fill="#00E676" d="M173 80L7 367.6l83 144.4 166-287.6z"/>
      <path fill="#3D5AFE" d="M7 367.6h332l83 144.4H90z"/>
    </svg>
  );
}

export default function Transcript() {
  const { showToast, pipelineDefaults, googleDriveConfig } = useStore();
  const [projectName, setProjectName] = useState('');
  const [driveUrl, setDriveUrl] = useState(googleDriveConfig?.defaultFolderId || '');
  const [loading, setLoading] = useState(false);
  const [fetchingDrive, setFetchingDrive] = useState(false);
  
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<Set<string>>(new Set());

  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    if (!driveUrl && googleDriveConfig?.defaultFolderId) {
      setDriveUrl(googleDriveConfig.defaultFolderId);
    }
  }, [googleDriveConfig?.defaultFolderId]);

  const provider = pipelineDefaults.provider || 'gemini';

  const fetchDriveFiles = async () => {
    if (!driveUrl.trim()) { showToast('Please enter a Google Drive ID or URL'); return; }
    setFetchingDrive(true);
    try {
      const res = await fetchGoogleDriveFiles(driveUrl);
      setDriveFiles(res.files || []);
      setSelectedDriveFiles(new Set((res.files || []).map((f: any) => f.id)));
      showToast('Fetched Google Drive files');
    } catch {
      showToast('Failed to fetch Google Drive files');
    } finally {
      setFetchingDrive(false);
    }
  };

  const toggleDriveFile = (id: string) => {
    const next = new Set(selectedDriveFiles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDriveFiles(next);
  };

  const submit = async () => {
    if (!projectName.trim()) { showToast('Project name is required'); return; }
    
    if (localFiles.length === 0 && selectedDriveFiles.size === 0) {
      showToast('Please select local files or Google Drive files to ingest');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('project_name', projectName);
      formData.append('provider', provider);
      
      localFiles.forEach((file) => {
        formData.append('files', file);
      });
      
      const driveMetadata = driveFiles.filter(f => selectedDriveFiles.has(f.id));
      formData.append('google_drive_files', JSON.stringify(driveMetadata));
      
      await ingestCombined(formData);
      showToast('Transcript ingestion started');
    } catch {
      showToast('Failed to ingest transcripts');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setLocalFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLocalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  return (
    <>
    <div>
      <header className="topbar">
        <div><p className="eyebrow">Data</p><h1>Documents</h1></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="button" onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Starting…</> : 'Ingest Transcripts'}
          </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form">
          <label>Target Project Name<input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Groww" /></label>
        </div>
      </div>

      <div className="grid cols-2" style={{ gap: 24, alignItems: 'stretch' }}>
        {/* Local Transcripts Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <HiUpload size={22} style={{ color: 'var(--accent-blue)' }} />
              <h3 style={{ margin: 0 }}>Local Transcripts</h3>
            </div>
            <div className="form">
              <label>Upload Files
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: isDragging ? '2px dashed var(--accent-blue)' : '2px dashed var(--hairline)',
                    borderRadius: 8,
                    padding: '28px 16px',
                    textAlign: 'center',
                    background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-strong)',
                    transition: 'all 0.2s',
                    marginTop: 8,
                    marginBottom: 16,
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <HiUpload size={28} style={{ marginBottom: 8, opacity: 0.7, color: 'var(--accent-blue)', display: 'block', margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>Drag and drop transcript files here</p>
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>or click to browse</p>
                  <input type="file" id="file-upload" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                </div>
              </label>
            </div>
            
            {localFiles.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ marginBottom: 8, fontSize: 13 }} className="muted">Selected Local Files ({localFiles.length})</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {localFiles.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-strong)', borderRadius: 6, fontSize: 13 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}><HiDocumentText size={14} /> {f.name}</span>
                      <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }} onClick={() => setLocalFiles(prev => prev.filter((_, idx) => idx !== i))}><MdClose size={14} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Google Drive Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <GoogleDriveLogo size={22} />
              <h3 style={{ margin: 0 }}>Google Drive</h3>
            </div>
            <div className="form">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span>Google Drive Folder ID or URL</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1 }} value={driveUrl} onChange={e => setDriveUrl(e.target.value)} placeholder="Paste the folder ID from the Drive URL" />
                <button className="button secondary" onClick={fetchDriveFiles} disabled={fetchingDrive}>
                  {fetchingDrive ? 'Fetching...' : 'Fetch Files'}
                </button>
              </div>
            </div>
            
            {driveFiles.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '4px 0' }}>
                  <input 
                    type="checkbox" 
                    style={{ cursor: 'pointer', transform: 'scale(0.85)' }} 
                    checked={driveFiles.length > 0 && selectedDriveFiles.size === driveFiles.length}
                    onChange={() => setSelectedDriveFiles(selectedDriveFiles.size === driveFiles.length ? new Set() : new Set(driveFiles.map(f => f.id)))}
                  />
                  <h4 style={{ fontSize: 13, margin: 0, userSelect: 'none' }} className="muted">
                    Select All ({selectedDriveFiles.size} / {driveFiles.length} selected)
                  </h4>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface-strong)' }}>
                  {driveFiles.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--hairline)', cursor: 'pointer', margin: 0, fontWeight: 'normal' }}>
                      <input type="checkbox" style={{ marginTop: 2, cursor: 'pointer', transform: 'scale(0.85)' }} checked={selectedDriveFiles.has(f.id)} onChange={() => toggleDriveFile(f.id)} />
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontSize: 12, wordBreak: 'break-word', lineHeight: 1.4 }}>
                          {f.mimeType?.includes('folder') ? <HiFolder size={13} style={{ flexShrink: 0 }} /> : <HiDocumentText size={13} style={{ flexShrink: 0 }} />} {f.name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 9, opacity: 0.6, whiteSpace: 'nowrap', backgroundColor: 'var(--surface-strong)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)' }}>
                          {f.mimeType?.split('.').pop()?.split('/').pop()?.toUpperCase() || 'FILE'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <BackButton fallback="collection" />
    </>
  );
}
