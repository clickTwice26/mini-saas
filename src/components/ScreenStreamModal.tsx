import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import {
  ComputerScreenShareIcon,
  FullScreenIcon,
  PictureInPictureOnIcon,
  CallEnd01Icon,
  Cancel01Icon,
  Shield01Icon,
  RadioIcon
} from 'hugeicons-react';

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
  broadcasterName = 'Peer',
  onStopBroadcast,
  onCloseViewer,
}) => {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  return (
    <Dialog
      open={Boolean(stream)}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: { xs: '90vh', sm: '86vh' },
            maxHeight: 820,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#020617',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`
          }
        }
      }}
    >
      <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          ref={containerRef}
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: '#020617',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Top Status Header */}
          <Box
            sx={{
              position: 'absolute',
              top: 14,
              left: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            {/* Live Indicator Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'auto' }}>
              <Chip
                icon={<RadioIcon size={14} color={theme.palette.error.main} />}
                label={isBroadcaster ? "Broadcasting Screen" : `Viewing ${broadcasterName}'s Screen`}
                size="small"
                sx={{
                  backgroundColor: alpha(theme.palette.error.main, 0.15),
                  color: '#ffffff',
                  border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
                  backdropFilter: 'blur(12px)',
                  fontWeight: 700,
                  borderRadius: '6px'
                }}
              />

              <Chip
                icon={<Shield01Icon size={12} color={theme.palette.success.main} />}
                label="Direct P2P E2EE"
                size="small"
                sx={{
                  backgroundColor: alpha('#000000', 0.6),
                  color: theme.palette.success.light,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                  backdropFilter: 'blur(12px)',
                  borderRadius: '6px'
                }}
              />
            </Box>

            {/* Top Right Quick Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, pointerEvents: 'auto' }}>
              <Tooltip title="Picture-in-Picture Mode" arrow>
                <IconButton
                  size="small"
                  onClick={togglePiP}
                  sx={{
                    backgroundColor: alpha('#000000', 0.7),
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) }
                  }}
                >
                  <PictureInPictureOnIcon size={18} />
                </IconButton>
              </Tooltip>

              <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Stage"} arrow>
                <IconButton
                  size="small"
                  onClick={toggleFullscreen}
                  sx={{
                    backgroundColor: alpha('#000000', 0.7),
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) }
                  }}
                >
                  <FullScreenIcon size={18} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Close Stage View" arrow>
                <IconButton
                  size="small"
                  onClick={isBroadcaster ? onStopBroadcast : onCloseViewer}
                  sx={{
                    backgroundColor: alpha('#000000', 0.7),
                    borderRadius: '6px',
                    '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.3) }
                  }}
                >
                  <Cancel01Icon size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Main Video Stream Container */}
          <Box
            sx={{
              flex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000000',
              overflow: 'hidden'
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isBroadcaster}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </Box>

          {/* Bottom Floating Control Bar */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: alpha(theme.palette.background.paper, 0.92),
              backdropFilter: 'blur(20px)',
              px: 2.5,
              py: 1,
              borderRadius: '10px',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              zIndex: 10
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ComputerScreenShareIcon size={18} color={theme.palette.primary.main} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>
                {isBroadcaster ? 'You are sharing your screen' : `${broadcasterName}'s Live Screen`}
              </Typography>
            </Box>

            {isBroadcaster ? (
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<CallEnd01Icon size={16} />}
                onClick={onStopBroadcast}
                sx={{ borderRadius: '6px', py: 0.6 }}
              >
                Stop Sharing
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onCloseViewer}
                sx={{ borderRadius: '6px', py: 0.6 }}
              >
                Exit Stage
              </Button>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
