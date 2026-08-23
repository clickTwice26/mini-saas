import React from 'react';
import { Video, PhoneCall, Phone, PhoneOff } from 'lucide-react';

interface IncomingCallModalProps {
  incomingCall: {
    callerId: string;
    callerName: string;
    mode: 'video' | 'audio';
  } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onDecline,
}) => {
  if (!incomingCall) return null;

  const isVideo = incomingCall.mode === 'video';

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div 
        className="glass-panel"
        style={{
          width: '90vw',
          maxWidth: '420px',
          padding: '28px 24px',
          background: 'rgba(8, 12, 22, 0.96)',
          border: '1px solid rgba(0, 242, 254, 0.45)',
          boxShadow: '0 0 50px rgba(0, 242, 254, 0.35)',
          borderRadius: '24px',
          textAlign: 'center',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        {/* Pulsing Avatar Icon */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(168,85,247,0.3) 100%)',
          border: '2px solid var(--cyan-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 0 30px rgba(0, 242, 254, 0.5)',
          animation: 'pulseGlow 1.5s infinite ease-in-out'
        }}>
          {isVideo ? (
            <Video size={36} color="var(--cyan-primary)" />
          ) : (
            <PhoneCall size={36} color="var(--cyan-primary)" />
          )}
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
          {incomingCall.callerName}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--cyan-primary)', marginBottom: '24px' }}>
          Incoming P2P {isVideo ? 'HD Video Call' : 'Encrypted Audio Call'}...
        </p>

        {/* Action Buttons: Accept / Decline */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
          {/* Decline Button */}
          <button
            onClick={onDecline}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--grad-panic-red)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(244, 63, 94, 0.4)',
              transition: 'transform 0.15s ease'
            }}
            title="Decline Call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--grad-emerald-teal)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.5)',
              transition: 'transform 0.15s ease',
              animation: 'pulseGlow 1.2s infinite alternate'
            }}
            title="Accept Call"
          >
            <Phone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
