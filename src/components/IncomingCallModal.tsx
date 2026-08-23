import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import {
  Video01Icon,
  Call02Icon,
  CallEnd01Icon
} from 'hugeicons-react';

interface IncomingCallModalProps {
  incomingCall: {
    callerId: string;
    callerName: string;
    mode: 'video' | 'audio';
  } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onDecline,
}) => {
  const theme = useTheme();
  if (!incomingCall) return null;

  const isVideo = incomingCall.mode === 'video';

  return (
    <Dialog
      open={Boolean(incomingCall)}
      onClose={onDecline}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            p: 3,
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
            boxShadow: `0 0 50px ${alpha(theme.palette.primary.main, 0.3)}`
          }
        }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Avatar Icon */}
        <Box
          sx={{
            width: 76,
            height: 76,
            borderRadius: '12px',
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
            border: `2px solid ${theme.palette.primary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            boxShadow: `0 0 30px ${alpha(theme.palette.primary.main, 0.5)}`
          }}
        >
          {isVideo ? (
            <Video01Icon size={36} color={theme.palette.primary.main} />
          ) : (
            <Call02Icon size={36} color={theme.palette.primary.main} />
          )}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          {incomingCall.callerName}
        </Typography>

        <Typography variant="body2" sx={{ color: theme.palette.primary.main, mb: 4 }}>
          Incoming P2P {isVideo ? 'HD Video Call' : 'Encrypted Audio Call'}...
        </Typography>

        {/* Action Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
          {/* Decline Button */}
          <IconButton
            onClick={onDecline}
            sx={{
              width: 56,
              height: 56,
              borderRadius: '8px',
              backgroundColor: theme.palette.error.main,
              color: '#ffffff',
              boxShadow: `0 0 20px ${alpha(theme.palette.error.main, 0.5)}`,
              '&:hover': {
                backgroundColor: theme.palette.error.dark,
                transform: 'scale(1.08)'
              }
            }}
          >
            <CallEnd01Icon size={24} />
          </IconButton>

          {/* Accept Button */}
          <IconButton
            onClick={onAccept}
            sx={{
              width: 56,
              height: 56,
              borderRadius: '8px',
              backgroundColor: theme.palette.success.main,
              color: '#ffffff',
              boxShadow: `0 0 25px ${alpha(theme.palette.success.main, 0.5)}`,
              '&:hover': {
                backgroundColor: theme.palette.success.dark,
                transform: 'scale(1.08)'
              }
            }}
          >
            <Call02Icon size={24} />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
