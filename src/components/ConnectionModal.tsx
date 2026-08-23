import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  TextField,
  Button,
  IconButton,
  Box,
  Typography,
  Tooltip,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import {
  Key01Icon,
  QrCodeIcon,
  Camera01Icon,
  Copy01Icon,
  CheckmarkBadge01Icon,
  ViewIcon,
  ViewOffIcon,
  Download01Icon,
  Upload01Icon,
  RefreshIcon,
  ArrowRight01Icon,
  Shield01Icon,
  Cancel01Icon,
  LockIcon
} from 'hugeicons-react';
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
  const theme = useTheme();
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

  const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(currentRoomId)}&key=${encodeURIComponent(currentSecretKey)}`;

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
        () => {}
      );
    } catch {
      setScanError('Camera unavailable. You can upload a QR image below.');
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

    if (trimmed.includes('#room=')) {
      const roomMatch = trimmed.match(/#room=([^&]+)/);
      const keyMatch = trimmed.match(/&key=([^&]+)/);
      if (roomMatch && roomMatch[1]) {
        const rId = decodeURIComponent(roomMatch[1]);
        const sKey = keyMatch && keyMatch[1] ? decodeURIComponent(keyMatch[1]) : '';
        return { roomId: rId, secretKey: sKey };
      }
    }

    if (trimmed.includes('room=') && trimmed.includes('key=')) {
      const parts = new URLSearchParams(trimmed.replace(/^#/, ''));
      const rId = parts.get('room');
      const sKey = parts.get('key');
      if (rId) {
        return { roomId: rId, secretKey: sKey || '' };
      }
    }

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
      setScanError('Could not decode QR code from the uploaded image.');
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
        downloadLink.download = `ghostlink-${currentRoomId}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            p: { xs: 1, sm: 2 }
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Key01Icon size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Invite & Connect
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Share room code or scan QR
            </Typography>
          </Box>
        </Box>

        <IconButton size="small" onClick={onClose} sx={{ borderRadius: '6px' }}>
          <Cancel01Icon size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Navigation Tabs */}
        <Box
          sx={{
            backgroundColor: alpha(theme.palette.background.default, 0.6),
            p: 0.5,
            borderRadius: '8px',
            border: `1px solid ${theme.palette.divider}`,
            mb: 3
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.82rem',
                textTransform: 'none'
              }
            }}
          >
            <Tab icon={<Key01Icon size={16} />} iconPosition="start" label="Room & Key" value="code" />
            <Tab icon={<QrCodeIcon size={16} />} iconPosition="start" label="Show QR" value="qr" />
            <Tab icon={<Camera01Icon size={16} />} iconPosition="start" label="Scan QR" value="scan" />
          </Tabs>
        </Box>

        {/* Tab 1: Room & Secret Key Display */}
        {activeTab === 'code' && (
          <Box>
            {/* Active Room Card */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: '10px',
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                mb: 3
              }}
            >
              {/* Room ID row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Room Code
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#ffffff' }}>
                    #{currentRoomId.toUpperCase()}
                  </Typography>
                </Box>

                <Tooltip title="Copy Room Code" arrow>
                  <IconButton size="small" onClick={() => copyToClipboard(currentRoomId, 'code')} sx={{ borderRadius: '6px' }}>
                    {copiedCode ? <CheckmarkBadge01Icon size={18} color={theme.palette.success.main} /> : <Copy01Icon size={18} />}
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Secret Key Row */}
              <Box
                sx={{
                  backgroundColor: alpha(theme.palette.background.default, 0.8),
                  p: 1.5,
                  borderRadius: '8px',
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  mb: 2.5
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: theme.palette.secondary.main, mb: 0.2 }}>
                    <LockIcon size={13} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem' }}>
                      Encryption Key
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: theme.palette.primary.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showKey ? currentSecretKey : '••••••••••••••••••••••••••••••••'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => setShowKey(!showKey)} sx={{ borderRadius: '6px' }}>
                    {showKey ? <ViewOffIcon size={16} /> : <ViewIcon size={16} />}
                  </IconButton>
                  <IconButton size="small" onClick={() => copyToClipboard(currentSecretKey, 'key')} sx={{ borderRadius: '6px' }}>
                    {copiedKey ? <CheckmarkBadge01Icon size={16} color={theme.palette.success.main} /> : <Copy01Icon size={16} />}
                  </IconButton>
                </Box>
              </Box>

              {/* Copy Full Invite Link Button */}
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={copiedLink ? <CheckmarkBadge01Icon size={18} /> : <Copy01Icon size={18} />}
                onClick={() => copyToClipboard(inviteUrl, 'link')}
                sx={{ py: 1.2, borderRadius: '8px' }}
              >
                {copiedLink ? 'Invite Link Copied!' : 'Copy Invite Link'}
              </Button>
            </Box>

            {/* Manual Join Section */}
            <Box component="form" onSubmit={handleManualJoin} sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
                Join another room:
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={inputRoom}
                  onChange={(e) => setInputRoom(e.target.value)}
                  placeholder="Paste invite link or room code..."
                  sx={{
                    '& input': {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }
                  }}
                />

                {!inputRoom.includes('&key=') && inputRoom.trim().length > 0 && (
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Key (if provided separately)..."
                    sx={{
                      '& input': {
                        fontFamily: 'monospace',
                        fontSize: '0.85rem'
                      }
                    }}
                  />
                )}

                <Button
                  fullWidth
                  type="submit"
                  variant="outlined"
                  color="primary"
                  disabled={!inputRoom.trim()}
                  endIcon={<ArrowRight01Icon size={18} />}
                  sx={{ py: 1, borderRadius: '8px' }}
                >
                  Join Room
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Generate Fresh Room */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Want a new room?
              </Typography>
              <Button
                size="small"
                variant="text"
                color="secondary"
                startIcon={<RefreshIcon size={16} />}
                onClick={onGenerateNewRoom}
                sx={{ borderRadius: '6px' }}
              >
                Create New Room
              </Button>
            </Box>
          </Box>
        )}

        {/* Tab 2: QR Code View */}
        {activeTab === 'qr' && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box
              sx={{
                display: 'inline-block',
                p: 2.5,
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                mb: 2.5
              }}
            >
              <QRCodeSVG
                id="ghostlink-qrcode-svg"
                value={inviteUrl}
                size={210}
                level="H"
                includeMargin={false}
              />
            </Box>

            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3, maxWidth: 360, mx: 'auto', fontSize: '0.85rem' }}>
              Scan with phone camera to instantly connect to this room.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Download01Icon size={18} />}
                onClick={downloadQrCode}
                sx={{ borderRadius: '8px' }}
              >
                Save QR
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={copiedLink ? <CheckmarkBadge01Icon size={18} /> : <Copy01Icon size={18} />}
                onClick={() => copyToClipboard(inviteUrl, 'link')}
                sx={{ borderRadius: '8px' }}
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Tab 3: Camera QR Scanner */}
        {activeTab === 'scan' && (
          <Box>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                minHeight: 260,
                borderRadius: '10px',
                overflow: 'hidden',
                backgroundColor: '#04070d',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2
              }}
            >
              <div id={qrContainerId} style={{ width: '100%', minHeight: '260px' }} />

              {scanError && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: alpha(theme.palette.background.paper, 0.95),
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: 1.5
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                    {scanError}
                  </Typography>
                  <Button size="small" variant="outlined" color="primary" startIcon={<RefreshIcon size={16} />} onClick={startCameraScanner} sx={{ borderRadius: '6px' }}>
                    Retry Camera
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                component="label"
                variant="outlined"
                color="inherit"
                startIcon={<Upload01Icon size={18} />}
                sx={{ borderRadius: '8px' }}
              >
                Upload QR Image
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, color: theme.palette.success.main }}>
          <Shield01Icon size={15} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            End-to-End Encrypted Session
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
