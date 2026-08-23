import React from 'react';
import {
  Paper,
  Box,
  Typography,
  LinearProgress,
  alpha,
  useTheme
} from '@mui/material';
import {
  Upload01Icon,
  Download01Icon,
  CheckmarkBadge01Icon
} from 'hugeicons-react';
import type { FileMetadata } from '../types';

interface FileProgressWidgetProps {
  transferState: {
    meta: FileMetadata;
    type: 'upload' | 'download';
    progress: number;
  } | null;
}

export const FileProgressWidget: React.FC<FileProgressWidgetProps> = ({ transferState }) => {
  const theme = useTheme();
  if (!transferState) return null;

  const isDone = transferState.progress >= 100;

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        bottom: 90,
        right: 24,
        width: 300,
        p: 2,
        borderRadius: '8px',
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(16px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        zIndex: 1200
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '6px',
            backgroundColor: isDone ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.primary.main, 0.15),
            color: isDone ? theme.palette.success.main : theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isDone ? (
            <CheckmarkBadge01Icon size={20} />
          ) : transferState.type === 'upload' ? (
            <Upload01Icon size={20} />
          ) : (
            <Download01Icon size={20} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {transferState.meta.name}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {isDone ? 'Transfer Complete' : `${transferState.type === 'upload' ? 'Streaming' : 'Receiving'} ${transferState.progress}%`}
          </Typography>
        </Box>
      </Box>

      <LinearProgress
        variant="determinate"
        value={transferState.progress}
        color={isDone ? "success" : "primary"}
        sx={{
          height: 6,
          borderRadius: '3px',
          backgroundColor: alpha('#ffffff', 0.1)
        }}
      />
    </Paper>
  );
};
