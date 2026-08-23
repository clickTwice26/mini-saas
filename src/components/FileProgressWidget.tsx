import React from 'react';
import { UploadCloud, DownloadCloud, CheckCircle2 } from 'lucide-react';
import type { FileMetadata } from '../types';

interface FileProgressWidgetProps {
  transferState: {
    meta: FileMetadata;
    type: 'upload' | 'download';
    progress: number;
  } | null;
}

export const FileProgressWidget: React.FC<FileProgressWidgetProps> = ({ transferState }) => {
  if (!transferState) return null;

  const isDone = transferState.progress >= 100;

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      right: '24px',
      background: 'rgba(12, 17, 28, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--border-glow)',
      borderRadius: '16px',
      padding: '14px 18px',
      boxShadow: 'var(--shadow-lg)',
      width: '300px',
      zIndex: 100,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 242, 254, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isDone ? (
            <CheckCircle2 size={18} color="var(--emerald-primary)" />
          ) : transferState.type === 'upload' ? (
            <UploadCloud size={18} color="var(--cyan-primary)" />
          ) : (
            <DownloadCloud size={18} color="var(--cyan-primary)" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {transferState.meta.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isDone ? 'Transfer Complete' : `${transferState.type === 'upload' ? 'Streaming' : 'Receiving'} ${transferState.progress}%`}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '4px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '999px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${transferState.progress}%`,
          height: '100%',
          background: isDone ? 'var(--emerald-primary)' : 'var(--grad-cyan-blue)',
          borderRadius: '999px',
          transition: 'width 0.15s ease'
        }} />
      </div>
    </div>
  );
};
