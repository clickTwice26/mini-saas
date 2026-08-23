import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import {
  Mic01Icon,
  MicOff01Icon,
  Video01Icon,
  VideoOffIcon,
  ComputerScreenShareIcon,
  CallEnd01Icon,
  Shield01Icon
} from 'hugeicons-react';
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
  const theme = useTheme();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Bind local stream to video tag
  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream, callState.isCameraOff, callState.active]);

  // Bind remote streams to video tags
  useEffect(() => {
    Object.entries(callState.remoteStreams).forEach(([peerId, stream]) => {
      const el = remoteVideoRefs.current[peerId];
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    });
  }, [callState.remoteStreams]);

  if (!callState.active) return null;

  const remotePeerEntries = Object.entries(callState.remoteStreams);
  const isAudioOnly = callState.mode === 'audio';

  return (
    <Dialog
      open={callState.active}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: { xs: '90vh', sm: '85vh' },
            maxHeight: 760,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#040711',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
          }
        }
      }}
    >
      <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Top Floating Security Header */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          <Chip
            icon={<Shield01Icon size={14} color={theme.palette.success.main} />}
            label="SRTP / WebRTC End-to-End Encrypted"
            size="small"
            sx={{
              backgroundColor: alpha('#000000', 0.7),
              color: theme.palette.success.light,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              backdropFilter: 'blur(10px)',
              pointerEvents: 'auto',
              borderRadius: '6px'
            }}
          />

          <Chip
            label={callState.isScreenSharing ? "Screen Sharing Active" : (isAudioOnly ? "Encrypted Audio Call" : "HD Video Call")}
            size="small"
            sx={{
              backgroundColor: alpha('#000000', 0.7),
              color: '#ffffff',
              border: `1px solid ${theme.palette.divider}`,
              backdropFilter: 'blur(10px)',
              pointerEvents: 'auto',
              borderRadius: '6px'
            }}
          />
        </Box>

        {/* Video Grid Canvas */}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: remotePeerEntries.length > 0 ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
            gap: 1.5,
            p: 2,
            pb: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020617'
          }}
        >
          {/* 1. Remote Peers View */}
          {remotePeerEntries.length > 0 ? (
            remotePeerEntries.map(([peerId]) => {
              const peerMeta = peers.find((p) => p.id === peerId);
              const peerName = peerMeta?.name || 'Remote Peer';

              return (
                <Box
                  key={peerId}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: 240,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#070d1d',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <video
                    ref={(el) => { remoteVideoRefs.current[peerId] = el; }}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />

                  {/* Peer Name Tag */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      backgroundColor: alpha('#000000', 0.75),
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '6px',
                      border: `1px solid ${theme.palette.divider}`
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffffff' }}>
                      {peerName}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#070d1d',
                borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                p: 3,
                textAlign: 'center'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main, mb: 0.5 }}>
                Waiting for Peer to Connect...
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Direct encrypted media pipe ready. Once the second participant joins, their feed will appear.
              </Typography>
            </Box>
          )}

          {/* 2. Local Self View */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              minHeight: 240,
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: '#070d1d',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {callState.isCameraOff && !callState.isScreenSharing ? (
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '8px',
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                    color: theme.palette.primary.main,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1
                  }}
                >
                  <VideoOffIcon size={28} />
                </Box>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                  Camera Disabled
                </Typography>
              </Box>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: callState.isScreenSharing ? 'none' : 'scaleX(-1)'
                }}
              />
            )}

            {/* Self Label */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: alpha('#000000', 0.75),
                px: 1.5,
                py: 0.4,
                borderRadius: '6px',
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {selfName} (You)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Bottom Floating Control Bar with Hugeicons */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: 'blur(20px)',
            p: '8px 16px',
            borderRadius: '10px',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
          }}
        >
          {/* Mute Mic */}
          <Tooltip title={callState.isMuted ? "Unmute Microphone" : "Mute Microphone"} arrow>
            <IconButton
              onClick={onToggleMic}
              sx={{
                backgroundColor: callState.isMuted ? alpha(theme.palette.error.main, 0.2) : undefined,
                color: callState.isMuted ? theme.palette.error.main : undefined,
                borderColor: callState.isMuted ? theme.palette.error.main : undefined,
                borderRadius: '8px'
              }}
            >
              {callState.isMuted ? <MicOff01Icon size={20} /> : <Mic01Icon size={20} />}
            </IconButton>
          </Tooltip>

          {/* Toggle Camera */}
          {!isAudioOnly && (
            <Tooltip title={callState.isCameraOff ? "Turn Camera On" : "Turn Camera Off"} arrow>
              <IconButton
                onClick={onToggleCamera}
                sx={{
                  backgroundColor: callState.isCameraOff ? alpha(theme.palette.error.main, 0.2) : undefined,
                  color: callState.isCameraOff ? theme.palette.error.main : undefined,
                  borderColor: callState.isCameraOff ? theme.palette.error.main : undefined,
                  borderRadius: '8px'
                }}
              >
                {callState.isCameraOff ? <VideoOffIcon size={20} /> : <Video01Icon size={20} />}
              </IconButton>
            </Tooltip>
          )}

          {/* Share Screen */}
          <Tooltip title={callState.isScreenSharing ? "Stop Screen Share" : "Share Screen"} arrow>
            <IconButton
              onClick={onToggleScreenShare}
              sx={{
                backgroundColor: callState.isScreenSharing ? alpha(theme.palette.primary.main, 0.2) : undefined,
                color: callState.isScreenSharing ? theme.palette.primary.main : undefined,
                borderColor: callState.isScreenSharing ? theme.palette.primary.main : undefined,
                borderRadius: '8px'
              }}
            >
              <ComputerScreenShareIcon size={20} />
            </IconButton>
          </Tooltip>

          {/* End Call */}
          <Tooltip title="End Call" arrow>
            <IconButton
              onClick={onEndCall}
              sx={{
                backgroundColor: theme.palette.error.main,
                color: '#ffffff',
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: theme.palette.error.dark
                }
              }}
            >
              <CallEnd01Icon size={20} />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
