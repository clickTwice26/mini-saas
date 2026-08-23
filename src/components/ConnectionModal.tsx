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
  Zap,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';
import type { ConnectionTab } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  currentSecretKey: string;
  onJoinRoom: (newRoomId: string, newSecretKey: string) => void;
  onGenerateNewRoom: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  currentSecretKey,
  onJoinRoom,
  onGenerateNewRoom,
}) => {
  const [activeTab, setActiveTab] = useState<ConnectionTab>('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Manual Join Fields
  const [inputRoom, setInputRoom] = useState('');
  const [inputKey, setInputKey] = useState('');

  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrContainerId = 'qr-camera-reader-viewport';

  // Construct full Zero-Knowledge Invite URL with both Room & Secret Key in URL fragment
  const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(currentRoomId)}&key=${encodeURIComponent(currentSecretKey)}`;

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

  const parseRoomAndKey = (text: string): { roomId: string; secretKey: string } | null => {
    const trimmed = text.trim();

    // Check if URL with #room=...&key=...
    if (trimmed.includes('#room=')) {
      const roomMatch = trimmed.match(/#room=([^&]+)/);
      const keyMatch = trimmed.match(/&key=([^&]+)/);
      if (roomMatch && roomMatch[1]) {
        const rId = decodeURIComponent(roomMatch[1]);
        const sKey = keyMatch && keyMatch[1] ? decodeURIComponent(keyMatch[1]) : '';
        return { roomId: rId, secretKey: sKey };
      }
    }

    // Check if plain query string format
    if (trimmed.includes('room=') && trimmed.includes('key=')) {
      const parts = new URLSearchParams(trimmed.replace(/^#/, ''));
      const rId = parts.get('room');
      const sKey = parts.get('key');
      if (rId) {
        return { roomId: rId, secretKey: sKey || '' };
      }
    }

    // If just a room code string without URL
    if (trimmed) {
      return { roomId: trimmed, secretKey: '' };
    }

    return null;
  };

  const handleScannedData = (data: string) => {
    const parsed = parseRoomAndKey(data);
    if (parsed && parsed.roomId) {
      stopCameraScanner();
      onJoinRoom(parsed.roomId, parsed.secretKey || currentSecretKey);
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

  const copyToClipboard = (text: string, type: 'code' | 'key' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRoom.trim()) return;

    // Check if input is full invite URL
    const parsed = parseRoomAndKey(inputRoom);
    if (parsed && parsed.secretKey) {
      onJoinRoom(parsed.roomId, parsed.secretKey);
      onClose();
      return;
    }

    const targetRoom = parsed ? parsed.roomId : inputRoom.trim();
    const targetKey = inputKey.trim() || currentSecretKey;

    onJoinRoom(targetRoom, targetKey);
    onClose();
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
        downloadLink.download = `ghostlink-${currentRoomId}-vault-qr.png`;
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
          maxWidth: '540px',
          padding: '24px',
          position: 'relative',
          background: 'rgba(10, 14, 24, 0.96)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          boxShadow: 'var(--shadow-lg)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--cyan-primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                Encrypted Vault Pairing
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Separate Room Handle + 256-bit Secret Key (Zero-Knowledge Exchange)
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
            Room & Key
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

        {/* Tab 1: Room Code + Secret Encryption Key */}
        {activeTab === 'code' && (
          <div>
            {/* Active Room Code & Secret Key Box */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(0, 242, 254, 0.08) 0%, rgba(0, 0, 0, 0.5) 100%)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '16px'
            }}>
              {/* Room Identifier */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Public Room Handle
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '0.05em'
                  }}>
                    #{currentRoomId.toUpperCase()}
                  </div>
                </div>

                <button
                  className="btn-cyber-icon"
                  onClick={() => copyToClipboard(currentRoomId, 'code')}
                  title="Copy Room Handle"
                >
                  {copiedCode ? <Check size={16} color="var(--emerald-primary)" /> : <Copy size={16} />}
                </button>
              </div>

              {/* Secret Key Token */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '12px',
                padding: '10px 14px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--violet-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> 256-bit Secret Key Token
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                    color: 'var(--cyan-primary)',
                    letterSpacing: '0.05em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {showKey ? currentSecretKey : '••••••••••••••••••••••••••••••••'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn-cyber-icon"
                    onClick={() => setShowKey(!showKey)}
                    style={{ width: '32px', height: '32px' }}
                    title={showKey ? "Hide Key" : "Reveal Key"}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  <button
                    className="btn-cyber-icon"
                    onClick={() => copyToClipboard(currentSecretKey, 'key')}
                    style={{ width: '32px', height: '32px' }}
                    title="Copy 256-bit Secret Key"
                  >
                    {copiedKey ? <Check size={14} color="var(--emerald-primary)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Copy Full E2EE Invite Link */}
              <button
                className="btn-cyber-primary"
                onClick={() => copyToClipboard(inviteUrl, 'link')}
                style={{ width: '100%', padding: '10px 16px', fontSize: '0.85rem' }}
              >
                {copiedLink ? <Check size={16} /> : <Sparkles size={16} />}
                <span>{copiedLink ? 'Full Encrypted Invite Link Copied!' : 'Copy Full E2EE Invite Link'}</span>
              </button>
            </div>

            {/* Quick Join another Room Code + Secret Key */}
            <form onSubmit={handleManualJoin} style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Join another 2-Person Vault (Paste Full Link or Enter Code + Key):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  value={inputRoom}
                  onChange={(e) => setInputRoom(e.target.value)}
                  placeholder="Paste full invite link (or enter Room Code e.g. VAULT-4819)..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />

                {!inputRoom.includes('&key=') && inputRoom.trim().length > 0 && (
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Secret Key Token (if provided separately)..."
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                )}

                <button
                  type="submit"
                  className="btn-cyber-primary"
                  disabled={!inputRoom.trim()}
                  style={{ padding: '10px 16px', opacity: inputRoom.trim() ? 1 : 0.5, marginTop: '4px' }}
                >
                  <span>Connect & Decrypt Vault</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* Random New Room */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Want a fresh 2-person vault?
              </span>
              <button
                type="button"
                className="btn-cyber-secondary"
                onClick={onGenerateNewRoom}
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <RefreshCw size={13} />
                <span>Generate New Room & Key</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: QR Code Generation (Includes both Room and Key) */}
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

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', maxWidth: '380px', margin: '0 auto 14px' }}>
              Scanning this QR automatically exchanges the <strong>Room Handle + 256-bit AES Encryption Key</strong> via URL fragment with zero server contact.
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
                onClick={() => copyToClipboard(inviteUrl, 'link')}
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Full Invite'}</span>
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
          <span>Keys never touch the server • RFC 3986 URL Fragment Encryption</span>
        </div>
      </div>
    </div>
  );
};
