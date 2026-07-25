import React from 'react';
import { MdDelete } from 'react-icons/md';

/** Confirmation modal for deleting a project or monitor */
export default function DeleteConfirmModal({
  projectName,
  onConfirm,
  onCancel,
  loading,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        maxWidth: 420, width: '100%', margin: '0 16px',
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <h3 style={{ marginBottom: 8, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}><MdDelete size={18} /> Delete Project</h3>
          <p style={{ color: 'var(--body)', lineHeight: 1.6, fontSize: 14 }}>
            Are you sure you want to delete <strong style={{ color: 'var(--ink)' }}>{projectName}</strong>?
            <br />This will permanently remove all data, chat history, summaries, and agent outputs.
            <strong style={{ color: '#ef4444' }}> This cannot be undone.</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="button secondary compact" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="button compact"
            onClick={onConfirm}
            disabled={loading}
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
          >
            {loading
              ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Deleting…</>
              : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
