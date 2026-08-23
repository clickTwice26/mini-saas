import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Copy, 
  Check, 
  Camera, 
  QrCode, 
  KeyRound, 
  Sparkles, 
  Download, 
  Upload, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap
} from 'lucide-react';
import type { ConnectionTab } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onJoinRoom: (newRoomId: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onJoinRoom,
}) => {
  const [activeTab, setActiveTab] = useState<ConnectionTab>('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrContainerId = 'qr-camera-reader-viewport';

  // Construct invite link
  const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(currentRoomId)}`;

  // Handle camera scanner lifecycle
  useEffect(() => {
    if (isOpen && activeTab === 'scan') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, [isOpen, activeTab]);

  const startCameraScanner = async () => {
    setScanError(null);
    setIsScanning(true);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrContainerId);
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScannedData(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err) {
      console.warn('Camera scan start error:', err);
      setScanError('Camera access unavailable or permission denied. You can also upload a QR image below.');
      setIsScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      setIsScanning(false);
    }
  };

  const handleScannedData = (data: string) => {
    // Extract room from full URL or standalone code
    let extracted = data.trim();
    if (extracted.includes('#room=')) {
      const match = extracted.match(/#room=([^&]+)/);
      if (match && match[1]) {
        extracted = decodeURIComponent(match[1]);
      }
    } else if (extracted.startsWith('http')) {
      try {
        const url = new URL(extracted);
        if (url.hash.includes('room=')) {
          extracted = decodeURIComponent(url.hash.split('room=')[1]);
        }
      } catch {
        // ignore
      }
    }

    if (extracted) {
      stopCameraScanner();
      onJoinRoom(extracted);
      onClose();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrContainerId);
      }
      const result = await html5QrCodeRef.current.scanFile(file, true);
      handleScannedData(result);
    } catch {
      setScanError('Could not decode QR code from the uploaded image. Please try another image.');
    }
  };

  const copyToClipboard = (text: string, isLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    let target = joinInput.trim();
    if (target.startsWith('#')) target = target.substring(1);
    if (target.includes('#room=')) {
      const match = target.match(/#room=([^&]+)/);
      if (match) target = decodeURIComponent(match[1]);
    }
    onJoinRoom(target);
    onClose();
  };

  const generateRandomCode = () => {
    const prefixes = ['NEXUS', 'CYBER', 'SOLAR', 'GHOST', 'SHADOW', 'QUANTUM', 'HYPER', 'PULSE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const newId = `${prefix}-${num}`;
    onJoinRoom(newId);
  };

  const downloadQrCode = () => {
    const svgElement = document.getElementById('ghostlink-qrcode-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    canvas.width = 400;
    canvas.height = 400;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = '#06090e';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `ghostlink-${currentRoomId}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="glass-panel" 
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          position: 'relative',
          background: 'rgba(12, 17, 28, 0.92)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          boxShadow: '0 0 40px rgba(0, 242, 254, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--cyan-primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                P2P Connection Hub
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Connect directly via Room Code, QR Code, or Camera Scanner
            </p>
          </div>

          <button 
            className="btn-cyber-icon"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '12px',
          padding: '4px',
          gap: '4px',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => setActiveTab('code')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'code' ? 'var(--bg-glass-active)' : 'transparent',
              color: activeTab === 'code' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'code' ? '0 0 12px rgba(0,242,254,0.2)' : 'none'
            }}
          >
            <KeyRound size={15} />
            Room Code
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'qr' ? 'var(--bg-glass-active)' : 'transparent',
              color: activeTab === 'qr' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'qr' ? '0 0 12px rgba(0,242,254,0.2)' : 'none'
            }}
          >
            <QrCode size={15} />
            Show QR
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'scan' ? 'var(--bg-glass-active)' : 'transparent',
              color: activeTab === 'scan' ? 'var(--cyan-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'scan' ? '0 0 12px rgba(0,242,254,0.2)' : 'none'
            }}
          >
            <Camera size={15} />
            Scan QR
          </button>
        </div>

        {/* Tab 1: Code-based Connection */}
        {activeTab === 'code' && (
          <div>
            {/* Current Room Code Display Box */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(0, 242, 254, 0.08) 0%, rgba(0, 0, 0, 0.5) 100%)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '16px',
              padding: '18px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Your Active Room Code
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--cyan-primary)',
                letterSpacing: '0.1em',
                marginBottom: '14px',
                textShadow: '0 0 15px rgba(0,242,254,0.5)'
              }}>
                {currentRoomId.toUpperCase()}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  className="btn-cyber-primary"
                  onClick={() => copyToClipboard(currentRoomId, false)}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  {copiedCode ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  className="btn-cyber-secondary"
                  onClick={() => copyToClipboard(inviteUrl, true)}
                  style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                >
                  {copiedLink ? <Check size={15} /> : <Sparkles size={15} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                </button>
              </div>
            </div>

            {/* Quick Join another Room Code */}
            <form onSubmit={handleManualJoin} style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Join Another Room / Enter Friend's Code:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="e.g. CYBER-4819 or paste invite link..."
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--cyan-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
                />
                <button
                  type="submit"
                  className="btn-cyber-primary"
                  disabled={!joinInput.trim()}
                  style={{ padding: '10px 16px', opacity: joinInput.trim() ? 1 : 0.5 }}
                >
                  <span>Join</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* Random New Room */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Want a fresh private room?
              </span>
              <button
                type="button"
                className="btn-cyber-secondary"
                onClick={generateRandomCode}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <RefreshCw size={13} />
                <span>Create New Room</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: QR Code Generation */}
        {activeTab === 'qr' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-block',
              padding: '16px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 0 30px rgba(0, 242, 254, 0.3)',
              marginBottom: '16px'
            }}>
              <QRCodeSVG
                id="ghostlink-qrcode-svg"
                value={inviteUrl}
                size={210}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', maxWidth: '360px', margin: '0 auto 14px' }}>
              Scan this QR code with any mobile phone camera or companion browser to instantly join this encrypted P2P room.
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                className="btn-cyber-primary"
                onClick={downloadQrCode}
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                <Download size={15} />
                <span>Save QR Image</span>
              </button>
              <button
                className="btn-cyber-secondary"
                onClick={() => copyToClipboard(inviteUrl, true)}
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Live Camera / File QR Scanner */}
        {activeTab === 'scan' && (
          <div>
            <div style={{
              position: 'relative',
              width: '100%',
              minHeight: '260px',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#04070d',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              {/* Target Container for html5-qrcode */}
              <div 
                id={qrContainerId} 
                style={{ width: '100%', minHeight: '260px' }}
              />

              {scanError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(10, 14, 23, 0.95)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <p style={{ fontSize: '0.82rem', color: '#fb7185' }}>{scanError}</p>
                  <button
                    className="btn-cyber-secondary"
                    onClick={startCameraScanner}
                    style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  >
                    <RefreshCw size={14} /> Retry Camera
                  </button>
                </div>
              )}
            </div>

            {/* File Drop / Upload Alternative */}
            <div style={{ textAlign: 'center' }}>
              <label 
                className="btn-cyber-secondary" 
                style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '0.8rem', display: 'inline-flex' }}
              >
                <Upload size={15} />
                <span>Upload QR Image File</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                />
              </label>
            </div>
          </div>
        )}

        {/* Privacy Assurance Footer */}
        <div style={{
          marginTop: '20px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: 'var(--text-dim)'
        }}>
          <ShieldCheck size={14} color="var(--emerald-primary)" />
          <span>Zero logs saved • Direct peer-to-peer data channels</span>
        </div>
      </div>
    </div>
  );
};
