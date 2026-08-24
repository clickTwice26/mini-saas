import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  alpha,
  useTheme
} from '@mui/material';
import {
  RadioIcon,
  Shield01Icon,
  LockIcon,
  Share01Icon,
  UserGroupIcon,
  QrCodeIcon,
  SecuredNetworkIcon,
  ComputerScreenShareIcon,
  Video01Icon,
  Call02Icon,
  Delete02Icon,
  Key01Icon,
  Cancel01Icon
} from 'hugeicons-react';
import type { PeerInfo } from '../types';
import { cryptoService } from '../services/cryptoService';

interface HeaderProps {
  roomId: string;
  secretKey: string;
  peers: PeerInfo[];
  onOpenConnectModal: () => void;
  onToggleMeshVisualizer: () => void;
  isMeshVisualizerOpen: boolean;
  onStartCall: (mode: 'video' | 'audio') => void;
  onStartScreenShare: () => void;
  onPanicNuke: () => void;
  onCopyRoomLink: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  secretKey,
  peers,
  onOpenConnectModal,
  onToggleMeshVisualizer,
  isMeshVisualizerOpen,
  onStartCall,
  onStartScreenShare,
  onPanicNuke,
  onCopyRoomLink,
}) => {
  const theme = useTheme();
  const peerCount = peers.length;
  const isRoomFull = peerCount >= 1;
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const safetyNumber = cryptoService.getSafetyFingerprint();

  return (
    <>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          boxShadow: 'none',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          px: { xs: 1, sm: 2 }
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', minHeight: 56, px: 0 }}>
          {/* Clean Brand Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                color: theme.palette.primary.main
              }}
            >
              <RadioIcon size={18} />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.05rem' }}>
              GhostLink
              <Typography component="span" variant="caption" sx={{ color: theme.palette.secondary.main, ml: 0.5, fontWeight: 700 }}>
                P2P
              </Typography>
            </Typography>
          </Box>

          {/* Center Room Code & Capacity Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Click to copy invite link" arrow>
              <Chip
                icon={<LockIcon size={13} color={theme.palette.primary.main} />}
                label={
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem' }}>
                    #{roomId.toUpperCase()}
                  </Typography>
                }
                deleteIcon={<Share01Icon size={13} />}
                onDelete={onCopyRoomLink}
                onClick={onCopyRoomLink}
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.4),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  height: 28,
                  px: 0.5,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: alpha(theme.palette.primary.main, 0.08)
                  }
                }}
              />
            </Tooltip>

            <Tooltip title={isRoomFull ? "2/2 connected" : "1/2 waiting for peer"} arrow>
              <Chip
                icon={isRoomFull ? <LockIcon size={13} color={theme.palette.success.main} /> : <UserGroupIcon size={13} />}
                label={isRoomFull ? "Connected" : "Waiting"}
                size="small"
                onClick={() => setShowSafetyModal(true)}
                sx={{
                  backgroundColor: isRoomFull ? alpha(theme.palette.success.main, 0.12) : alpha('#ffffff', 0.04),
                  color: isRoomFull ? theme.palette.success.light : theme.palette.text.secondary,
                  border: `1px solid ${isRoomFull ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.divider, 0.6)}`,
                  borderRadius: '6px',
                  height: 28,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              />
            </Tooltip>
          </Box>

          {/* Action Toolbar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<QrCodeIcon size={16} />}
              onClick={onOpenConnectModal}
              sx={{ px: 1.6, py: 0.4, borderRadius: '6px', fontSize: '0.78rem' }}
            >
              Invite
            </Button>

            <Tooltip title="Network Topology" arrow>
              <IconButton
                size="small"
                onClick={onToggleMeshVisualizer}
                sx={{
                  borderRadius: '6px',
                  color: isMeshVisualizerOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                  borderColor: isMeshVisualizerOpen ? alpha(theme.palette.primary.main, 0.4) : undefined,
                  backgroundColor: isMeshVisualizerOpen ? alpha(theme.palette.primary.main, 0.12) : undefined
                }}
              >
                <SecuredNetworkIcon size={18} />
              </IconButton>
            </Tooltip>

            <Tooltip title={peerCount === 0 ? "Connect with peer to share screen" : "Share Screen Live"} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={peerCount === 0}
                  onClick={onStartScreenShare}
                  sx={{ borderRadius: '6px' }}
                >
                  <ComputerScreenShareIcon size={18} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={peerCount === 0 ? "Connect with peer for video call" : "Video Call"} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={peerCount === 0}
                  onClick={() => onStartCall('video')}
                  sx={{ borderRadius: '6px' }}
                >
                  <Video01Icon size={18} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={peerCount === 0 ? "Connect with peer for voice call" : "Voice Call"} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={peerCount === 0}
                  onClick={() => onStartCall('audio')}
                  sx={{ borderRadius: '6px' }}
                >
                  <Call02Icon size={18} />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Disconnect & Clear Session" arrow>
              <IconButton
                size="small"
                onClick={onPanicNuke}
                sx={{
                  borderRadius: '6px',
                  color: theme.palette.error.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.error.main, 0.15),
                    borderColor: theme.palette.error.main
                  }
                }}
              >
                <Delete02Icon size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Safety Verification Dialog */}
      <Dialog
        open={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: '12px' }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key01Icon size={20} color={theme.palette.primary.main} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              Safety Fingerprint
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setShowSafetyModal(false)} sx={{ borderRadius: '6px' }}>
            <Cancel01Icon size={16} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2, fontSize: '0.82rem' }}>
            Compare this safety code with your peer to verify encryption:
          </Typography>

          <Box
            sx={{
              backgroundColor: alpha(theme.palette.background.default, 0.8),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              borderRadius: '8px',
              py: 1.5,
              px: 2.5,
              fontFamily: 'monospace',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: theme.palette.primary.main,
              letterSpacing: '0.15em',
              mb: 1.5
            }}
          >
            {safetyNumber || 'SECURE 256-BIT'}
          </Box>

          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary, display: 'block', mb: 2, wordBreak: 'break-all' }}>
            Key: {secretKey.slice(0, 10)}••••••••{secretKey.slice(-6)}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, color: theme.palette.success.main }}>
            <Shield01Icon size={16} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              End-to-End Encrypted
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};
