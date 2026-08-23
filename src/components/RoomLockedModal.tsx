import React from 'react';
import { Lock, ShieldAlert, PlusCircle } from 'lucide-react';

interface RoomLockedModalProps {
  isOpen: boolean;
  onGenerateNewRoom: () => void;
}

export const RoomLockedModal: React.FC<RoomLockedModalProps> = ({
  isOpen,
  onGenerateNewRoom,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }}>
      <div 
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: '460px',
          padding: '32px 24px',
          background: 'rgba(10, 14, 24, 0.98)',
          border: '1px solid var(--border-violet)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '24px',
          textAlign: 'center',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(244, 63, 94, 0.15)',
          border: '2px solid var(--rose-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: 'var(--shadow-red-glow)'
        }}>
          <Lock size={32} color="var(--rose-primary)" />
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
          Private Vault Locked (2/2 Peers)
        </h3>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '24px' }}>
          This encrypted room has reached its maximum capacity of <strong>2 verified participants</strong>. 
          To guarantee zero-knowledge confidentiality, 3rd party access is strictly prohibited.
        </p>

        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '12px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '24px',
          fontSize: '0.78rem',
          color: 'var(--cyan-primary)'
        }}>
          <ShieldAlert size={16} />
          <span>Strict 1-on-1 AES-GCM-256 E2E Encryption</span>
        </div>

        <button
          className="btn-cyber-primary"
          onClick={onGenerateNewRoom}
          style={{ width: '100%', padding: '12px 18px', fontSize: '0.9rem' }}
        >
          <PlusCircle size={18} />
          <span>Create My Own 2-Person Vault</span>
        </button>
      </div>
    </div>
  );
};
