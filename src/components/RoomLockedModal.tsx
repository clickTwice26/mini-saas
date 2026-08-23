import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import {
  LockIcon,
  Shield01Icon,
  Key01Icon
} from 'hugeicons-react';

interface RoomLockedModalProps {
  isOpen: boolean;
  onGenerateNewRoom: () => void;
}

export const RoomLockedModal: React.FC<RoomLockedModalProps> = ({
  isOpen,
  onGenerateNewRoom,
}) => {
  const theme = useTheme();
  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            p: 3,
            textAlign: 'center',
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
            boxShadow: `0 0 50px ${alpha(theme.palette.error.main, 0.25)}`
          }
        }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '12px',
            backgroundColor: alpha(theme.palette.error.main, 0.15),
            border: `2px solid ${theme.palette.error.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            boxShadow: `0 0 30px ${alpha(theme.palette.error.main, 0.4)}`
          }}
        >
          <LockIcon size={32} color={theme.palette.error.main} />
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Private Vault Locked (2/2 Peers)
        </Typography>

        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, lineHeight: 1.5, mb: 3 }}>
          This encrypted room has reached its maximum capacity of <strong>2 verified participants</strong>.
          To guarantee zero-knowledge confidentiality, 3rd party access is strictly prohibited.
        </Typography>

        <Box
          sx={{
            backgroundColor: alpha(theme.palette.background.default, 0.6),
            p: 1.5,
            borderRadius: '8px',
            border: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            mb: 3,
            color: theme.palette.primary.main
          }}
        >
          <Shield01Icon size={18} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Strict 1-on-1 AES-GCM-256 E2E Encryption
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Key01Icon size={18} />}
          onClick={onGenerateNewRoom}
          sx={{ py: 1.3, borderRadius: '8px' }}
        >
          Create My Own 2-Person Vault
        </Button>
      </DialogContent>
    </Dialog>
  );
};
