import React, { useRef, useEffect, useState } from 'react';
import { 
  Monitor, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  X, 
  ShieldCheck, 
  StopCircle,
  PictureInPicture,
  Tv
} from 'lucide-react';

interface ScreenStreamModalProps {
  stream: MediaStream | null;
  isBroadcaster: boolean;
  broadcasterName?: string;
  onStopBroadcast: () => void;
  onCloseViewer: () => void;
}

export const ScreenStreamModal: React.FC<ScreenStreamModalProps> = ({
  stream,
  isBroadcaster,
  broadcasterName,
  onStopBroadcast,
  onCloseViewer,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div 
        className="glass-panel"
        style={{
          width: isFullscreen ? '100vw' : '94vw',
          maxWidth: isFullscreen ? '100vw' : '1100px',
          height: isFullscreen ? '100vh' : '88vh',
          background: 'rgba(8, 12, 22, 0.98)',
          border: isFullscreen ? 'none' : '1px solid rgba(0, 242, 254, 0.4)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isFullscreen ? '0' : '24px',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Stream Header */}
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="status-pulse" />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--rose-primary)', fontWeight: 800 }}>
                  <Tv size={15} /> LIVE STREAM
                </span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span>{isBroadcaster ? 'Broadcasting Your Screen' : `${broadcasterName || 'Peer'}'s Screen`}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--emerald-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={12} /> Direct P2P Stream • Zero Call Acceptance Needed
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* PiP Button */}
            <button
              className="btn-cyber-icon"
              onClick={togglePiP}
              style={{ width: '34px', height: '34px' }}
              title="Picture-in-Picture Floating Window"
            >
              <PictureInPicture size={16} />
            </button>

            {/* Fullscreen Button */}
            <button
              className="btn-cyber-icon"
              onClick={toggleFullscreen}
              style={{ width: '34px', height: '34px' }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Stage"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close / Stop Button */}
            {isBroadcaster ? (
              <button
                className="btn-cyber-primary"
                onClick={onStopBroadcast}
                style={{
                  background: 'var(--grad-panic-red)',
                  borderColor: 'var(--rose-primary)',
                  padding: '6px 14px',
                  fontSize: '0.78rem'
                }}
              >
                <StopCircle size={15} />
                <span>Stop Broadcast</span>
              </button>
            ) : (
              <button
                className="btn-cyber-icon"
                onClick={onCloseViewer}
                style={{ width: '34px', height: '34px' }}
                title="Close Stream View"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Video Canvas Stage */}
        <div style={{
          flex: 1,
          background: '#02050a',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '8px'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isBroadcaster || isMuted}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '12px'
            }}
          />

          {/* Broadcaster watermark / status */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: '#ffffff',
            backdropFilter: 'blur(8px)'
          }}>
            <Monitor size={14} color="var(--cyan-primary)" />
            <span>{isBroadcaster ? 'You are sharing live in 1080p' : `Watching ${broadcasterName || 'Peer'}`}</span>
          </div>

          {/* Viewer Mute/Unmute sound toggle */}
          {!isBroadcaster && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: '#ffffff',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
            >
              {isMuted ? <VolumeX size={14} color="var(--rose-primary)" /> : <Volume2 size={14} color="var(--cyan-primary)" />}
              <span>{isMuted ? 'Unmute Audio' : 'Audio On'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
