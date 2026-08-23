import React from 'react';
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
  Activity
} from 'lucide-react';
import type { PeerInfo } from '../types';

interface HeaderProps {
  roomId: string;
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

  return (
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
            <span className="pill-badge pill-badge-emerald" title="Hardware-level WebRTC DTLS encryption">
              <ShieldCheck size={13} />
              Zero DB • Pure P2P
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Direct browser-to-browser encrypted mesh
          </p>
        </div>
      </div>

      {/* Center Room Code & Peer Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Room Code Badge */}
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
          title="Click to copy invite link"
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Room:
          </span>
          <span className="code-tag" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            #{roomId.toUpperCase()}
          </span>
          <Share2 size={14} color="var(--cyan-primary)" style={{ opacity: 0.8 }} />
        </div>

        {/* Connected Peers Counter */}
        <div 
          onClick={onToggleMeshVisualizer}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isMeshVisualizerOpen ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: isMeshVisualizerOpen ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '6px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title="Toggle Mesh Visualizer"
        >
          <span className={peerCount > 0 ? "status-pulse" : "status-pulse-cyan"} />
          <Users size={15} color={peerCount > 0 ? "var(--emerald-primary)" : "var(--text-muted)"} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: peerCount > 0 ? 'var(--emerald-primary)' : 'var(--text-muted)' }}>
            {peerCount} {peerCount === 1 ? 'Peer Online' : 'Peers Online'}
          </span>
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
          title={peerCount === 0 ? "Connect with at least 1 peer to start a call" : "Start P2P HD Video Call"}
        >
          <Video size={18} />
        </button>

        {/* Audio Call Trigger */}
        <button 
          className="btn-cyber-icon"
          onClick={() => onStartCall('audio')}
          disabled={peerCount === 0}
          style={{ opacity: peerCount === 0 ? 0.45 : 1, cursor: peerCount === 0 ? 'not-allowed' : 'pointer' }}
          title={peerCount === 0 ? "Connect with at least 1 peer to start an audio call" : "Start P2P Voice Call"}
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
          title="Panic Nuke: Instantly disconnect WebRTC & wipe session memory"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </header>
  );
};
