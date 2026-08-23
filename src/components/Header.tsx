import React, { useState } from 'react';
import { 
  ShieldCheck, 
  QrCode, 
  Users, 
  Radio, 
  Video, 
  PhoneCall, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Share2,
  Activity,
  Lock,
  KeyRound,
  X
} from 'lucide-react';
import type { PeerInfo } from '../types';
import { cryptoService } from '../services/cryptoService';

interface HeaderProps {
  roomId: string;
  secretKey: string;
  peers: PeerInfo[];
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenConnectModal: () => void;
  onToggleMeshVisualizer: () => void;
  isMeshVisualizerOpen: boolean;
  onStartCall: (mode: 'video' | 'audio') => void;
  onPanicNuke: () => void;
  onCopyRoomLink: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  secretKey,
  peers,
  isMuted,
  onToggleMute,
  onOpenConnectModal,
  onToggleMeshVisualizer,
  isMeshVisualizerOpen,
  onStartCall,
  onPanicNuke,
  onCopyRoomLink,
}) => {
  const peerCount = peers.length;
  const isRoomFull = peerCount >= 1;
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const safetyNumber = cryptoService.getSafetyFingerprint();

  return (
    <>
      <header className="glass-panel" style={{
        margin: '12px 16px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        zIndex: 10
      }}>
        {/* Brand & Security Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(168,85,247,0.2) 100%)',
            border: '1px solid rgba(0,242,254,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0,242,254,0.2)'
          }}>
            <Radio size={22} color="var(--cyan-primary)" style={{ animation: 'spinSlow 12s linear infinite' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                letterSpacing: '-0.02em',
                background: 'linear-gradient(90deg, #ffffff 0%, #00f2fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                GhostLink<span style={{ fontSize: '0.8rem', color: 'var(--violet-primary)', marginLeft: '4px' }}>P2P</span>
              </h1>
              <span 
                className="pill-badge pill-badge-emerald" 
                onClick={() => setShowSafetyModal(true)}
                style={{ cursor: 'pointer' }}
                title="Click to view AES-GCM-256 Safety Verification Fingerprint"
              >
                <ShieldCheck size={13} />
                AES-256 E2EE
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Strict 1-on-1 Encrypted Vault (Max 2 Peers)
            </p>
          </div>
        </div>

        {/* Center Room Code & Capacity Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Room Code & Key Badge */}
          <div 
            onClick={onCopyRoomLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              borderRadius: '12px',
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Click to copy E2EE invite link with key"
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Room:
            </span>
            <span className="code-tag" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              #{roomId.toUpperCase()}
            </span>
            <Lock size={12} color="var(--violet-primary)" />
            <Share2 size={14} color="var(--cyan-primary)" style={{ opacity: 0.8 }} />
          </div>

          {/* 2-Person Vault Status Indicator */}
          <div 
            onClick={() => setShowSafetyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isRoomFull ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: isRoomFull ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '6px 14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title={isRoomFull ? "Vault is locked (2/2 members active)" : "Awaiting 2nd peer"}
          >
            {isRoomFull ? (
              <>
                <Lock size={14} color="var(--emerald-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--emerald-primary)' }}>
                  Locked (2/2)
                </span>
              </>
            ) : (
              <>
                <Users size={14} color="var(--cyan-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  1/2 Waiting
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* QR & Invite Button */}
          <button 
            className="btn-cyber-primary" 
            onClick={onOpenConnectModal}
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            title="Open QR Code & Room Setup"
          >
            <QrCode size={16} />
            <span>Connect / QR</span>
          </button>

          {/* Mesh Visualizer Button */}
          <button
            className="btn-cyber-icon"
            onClick={onToggleMeshVisualizer}
            style={{
              borderColor: isMeshVisualizerOpen ? 'var(--cyan-primary)' : undefined,
              color: isMeshVisualizerOpen ? 'var(--cyan-primary)' : undefined,
              background: isMeshVisualizerOpen ? 'rgba(0,242,254,0.1)' : undefined
            }}
            title="Live Peer Topology Visualizer"
          >
            <Activity size={18} />
          </button>

          {/* Video Call Trigger */}
          <button 
            className="btn-cyber-icon"
            onClick={() => onStartCall('video')}
            disabled={peerCount === 0}
            style={{ opacity: peerCount === 0 ? 0.45 : 1, cursor: peerCount === 0 ? 'not-allowed' : 'pointer' }}
            title={peerCount === 0 ? "Connect with your peer to start a video call" : "Start P2P HD Video Call"}
          >
            <Video size={18} />
          </button>

          {/* Audio Call Trigger */}
          <button 
            className="btn-cyber-icon"
            onClick={() => onStartCall('audio')}
            disabled={peerCount === 0}
            style={{ opacity: peerCount === 0 ? 0.45 : 1, cursor: peerCount === 0 ? 'not-allowed' : 'pointer' }}
            title={peerCount === 0 ? "Connect with your peer to start an audio call" : "Start P2P Voice Call"}
          >
            <PhoneCall size={18} />
          </button>

          {/* Sound Toggle */}
          <button 
            className="btn-cyber-icon"
            onClick={onToggleMute}
            title={isMuted ? "Unmute UI Sounds" : "Mute UI Sounds"}
          >
            {isMuted ? <VolumeX size={18} color="var(--text-dim)" /> : <Volume2 size={18} color="var(--cyan-primary)" />}
          </button>

          {/* Panic Nuke Button */}
          <button 
            className="btn-cyber-icon btn-panic"
            onClick={onPanicNuke}
            title="Panic Nuke: Instantly disconnect & wipe session memory"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Safety Number Fingerprint Verification Modal */}
      {showSafetyModal && (
        <div className="modal-backdrop" onClick={() => setShowSafetyModal(false)} style={{ zIndex: 1150 }}>
          <div 
            className="glass-panel"
            style={{
              width: '90vw',
              maxWidth: '460px',
              padding: '24px',
              background: 'rgba(10, 14, 24, 0.98)',
              border: '1px solid var(--border-glow)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '24px',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--cyan-primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  Safety Fingerprint
                </h3>
              </div>
              <button className="btn-cyber-icon" onClick={() => setShowSafetyModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '16px' }}>
              Compare this cryptographic safety number with your peer to verify that all communications are <strong>100% End-to-End Encrypted with AES-GCM-256</strong>:
            </p>

            <div style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '14px',
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--cyan-primary)',
              letterSpacing: '0.15em',
              marginBottom: '16px',
              textShadow: '0 0 12px rgba(0,242,254,0.4)'
            }}>
              {safetyNumber || 'SECURE 256-BIT'}
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '0.73rem',
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              marginBottom: '18px',
              wordBreak: 'break-all'
            }}>
              Key: {secretKey.slice(0, 10)}••••••••{secretKey.slice(-6)}
            </div>

            <div style={{
              fontSize: '0.75rem',
              color: 'var(--emerald-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <ShieldCheck size={16} />
              <span>Strict 2-Person Vault • Zero Server Decryption</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
