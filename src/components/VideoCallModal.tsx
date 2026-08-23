import React, { useRef, useEffect, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Monitor, 
  ShieldCheck,
  Radio,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { CallState, PeerInfo } from '../types';

interface VideoCallModalProps {
  callState: CallState;
  peers: PeerInfo[];
  selfName: string;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  callState,
  peers,
  selfName,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  if (!callState.active) return null;

  const remotePeerIds = Object.keys(callState.remoteStreams);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050 }}>
      <div 
        className="glass-panel"
        style={{
          width: isFullscreen ? '100vw' : '92vw',
          maxWidth: isFullscreen ? '100vw' : '1050px',
          height: isFullscreen ? '100vh' : '86vh',
          background: 'rgba(8, 12, 20, 0.97)',
          border: isFullscreen ? 'none' : '1px solid rgba(0, 242, 254, 0.4)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isFullscreen ? '0' : '24px',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Header Bar */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-pulse" />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>1-on-1 Encrypted {callState.mode === 'video' ? 'HD Video & Screenshare' : 'Voice Call'}</span>
                {callState.isScreenSharing && (
                  <span className="pill-badge pill-badge-cyan" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    <Monitor size={11} /> You are Sharing Screen
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--emerald-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={12} /> DTLS-SRTP Hardware Encrypted • Zero Server Relays
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-cyber-icon"
              onClick={toggleFullscreen}
              style={{ width: '34px', height: '34px' }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Stage"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Video Stage Grid */}
        <div style={{
          flex: 1,
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '14px',
          position: 'relative',
          background: '#04070d',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Remote Peer Stream */}
          {remotePeerIds.length > 0 ? (
            remotePeerIds.map((peerId) => {
              const stream = callState.remoteStreams[peerId];
              const peer = peers.find((p) => p.id === peerId);

              return (
                <div
                  key={peerId}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    background: '#0a0f18',
                    border: '1px solid rgba(0, 242, 254, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el) {
                        el.srcObject = stream;
                        remoteVideoRefs.current[peerId] = el;
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain' // High clarity for screen share & video
                    }}
                  />

                  {/* Peer Name Tag */}
                  <div style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: '14px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(8px)'
                  }}>
                    {peer ? peer.name : `Peer-${peerId.slice(0, 4)}`}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              height: '100%'
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(0, 242, 254, 0.1)',
                border: '2px solid var(--cyan-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulseGlow 2s infinite ease-in-out'
              }}>
                <Radio size={32} color="var(--cyan-primary)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  Calling Paired Peer...
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Awaiting WebRTC media stream
                </p>
              </div>
            </div>
          )}

          {/* Local User Stream (Picture in Picture) */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: callState.isScreenSharing ? '220px' : '180px',
            height: callState.isScreenSharing ? '130px' : '120px',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#111724',
            border: '2px solid rgba(0, 242, 254, 0.5)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.85)',
            zIndex: 10,
            transition: 'all 0.2s ease'
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // IMPORTANT: Only mirror webcam, never mirror screen sharing!
                transform: callState.isScreenSharing ? 'none' : 'scaleX(-1)'
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '6px',
              left: '6px',
              background: 'rgba(0, 0, 0, 0.75)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.65rem',
              color: '#ffffff'
            }}>
              {callState.isScreenSharing ? '🖥️ Your Screen' : `You (${selfName})`}
            </div>
          </div>
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Mute Mic */}
          <button
            className="btn-cyber-icon"
            onClick={onToggleMic}
            style={{
              width: '46px',
              height: '46px',
              background: callState.isMuted ? 'rgba(244, 63, 94, 0.2)' : undefined,
              borderColor: callState.isMuted ? 'var(--rose-primary)' : undefined,
              color: callState.isMuted ? 'var(--rose-primary)' : undefined
            }}
            title={callState.isMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {callState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Toggle Camera */}
          <button
            className="btn-cyber-icon"
            onClick={onToggleCamera}
            style={{
              width: '46px',
              height: '46px',
              background: callState.isCameraOff ? 'rgba(244, 63, 94, 0.2)' : undefined,
              borderColor: callState.isCameraOff ? 'var(--rose-primary)' : undefined,
              color: callState.isCameraOff ? 'var(--rose-primary)' : undefined
            }}
            title={callState.isCameraOff ? "Turn Video On" : "Turn Video Off"}
          >
            {callState.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Screen Share Toggle */}
          <button
            className="btn-cyber-icon"
            onClick={onToggleScreenShare}
            style={{
              width: '46px',
              height: '46px',
              background: callState.isScreenSharing ? 'rgba(0, 242, 254, 0.25)' : undefined,
              borderColor: callState.isScreenSharing ? 'var(--cyan-primary)' : undefined,
              color: callState.isScreenSharing ? 'var(--cyan-primary)' : undefined,
              boxShadow: callState.isScreenSharing ? '0 0 15px rgba(0, 242, 254, 0.4)' : undefined
            }}
            title={callState.isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            <Monitor size={20} />
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--grad-panic-red)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(244, 63, 94, 0.4)',
              transition: 'transform 0.15s ease'
            }}
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
