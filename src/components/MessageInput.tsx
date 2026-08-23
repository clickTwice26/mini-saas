import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  InputBase,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  Button,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import {
  SentIcon,
  Attachment01Icon,
  Mic01Icon,
  Clock01Icon,
  RadioIcon
} from 'hugeicons-react';

interface MessageInputProps {
  onSendMessage: (text: string, expiresAt?: number) => void;
  onSendFile: (file: File) => void;
  onSendAudioMemo: (blob: Blob, duration: number) => void;
  onTyping: (isTyping: boolean) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onSendAudioMemo,
  onTyping,
}) => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [timerAnchor, setTimerAnchor] = useState<HTMLElement | null>(null);
  const [ephemeralTimer, setEphemeralTimer] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    const expiresAt = ephemeralTimer ? Date.now() + ephemeralTimer * 1000 : undefined;
    onSendMessage(text.trim(), expiresAt);
    setText('');
    onTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingDuration > 0 && audioChunksRef.current.length > 0) {
          onSendAudioMemo(audioBlob, recordingDuration);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone for voice note:', err);
      alert('Could not access microphone. Please verify browser permissions.');
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (!shouldSend) {
      audioChunksRef.current = [];
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.2 },
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${theme.palette.divider}`
      }}
    >
      {/* Hidden File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Input Outer Card */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: '4px 10px',
          backgroundColor: alpha(theme.palette.background.default, 0.6),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
          borderRadius: '8px',
          boxShadow: `0 4px 20px ${alpha('#000000', 0.25)}`
        }}
      >
        {isRecording ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', py: 0.4, px: 0.8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <RadioIcon size={16} color={theme.palette.error.main} />
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                {formatRecordingTime(recordingDuration)}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                Recording voice note...
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <Button size="small" variant="outlined" color="inherit" onClick={() => stopRecording(false)} sx={{ borderRadius: '6px' }}>
                Cancel
              </Button>
              <Button size="small" variant="contained" color="primary" onClick={() => stopRecording(true)} sx={{ borderRadius: '6px' }}>
                Send Voice
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Attachment & Timer Tools */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Tooltip title="Attach file" arrow>
                <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ borderRadius: '6px' }}>
                  <Attachment01Icon size={18} />
                </IconButton>
              </Tooltip>

              <Tooltip title={ephemeralTimer ? `Timer: ${ephemeralTimer}s` : "Self-destruct timer"} arrow>
                <IconButton
                  size="small"
                  onClick={(e) => setTimerAnchor(e.currentTarget)}
                  sx={{
                    borderRadius: '6px',
                    color: ephemeralTimer ? theme.palette.warning.main : undefined,
                    borderColor: ephemeralTimer ? theme.palette.warning.main : undefined
                  }}
                >
                  <Clock01Icon size={18} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Clean Functional Text Input */}
            <InputBase
              multiline
              maxRows={4}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              sx={{
                flex: 1,
                fontSize: '0.88rem',
                color: '#ffffff',
                px: 1,
                '& textarea': {
                  lineHeight: 1.4
                }
              }}
            />

            {/* Mic & Send */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Tooltip title="Voice note" arrow>
                <IconButton size="small" onClick={startRecording} sx={{ borderRadius: '6px' }}>
                  <Mic01Icon size={18} />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                color="primary"
                disabled={!text.trim()}
                onClick={handleSend}
                sx={{
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  p: 0,
                  borderRadius: '6px'
                }}
              >
                <SentIcon size={18} />
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* Ephemeral Timer Tag (Only if active) */}
      {ephemeralTimer && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
          <Chip
            size="small"
            label={`Self-destruct: ${ephemeralTimer}s`}
            onDelete={() => setEphemeralTimer(null)}
            sx={{
              height: 18,
              borderRadius: '4px',
              fontSize: '0.65rem',
              backgroundColor: alpha(theme.palette.warning.main, 0.12),
              color: theme.palette.warning.light
            }}
          />
        </Box>
      )}

      {/* Timer Menu */}
      <Menu
        anchorEl={timerAnchor}
        open={Boolean(timerAnchor)}
        onClose={() => setTimerAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '8px',
              backgroundColor: alpha(theme.palette.background.paper, 0.96),
              backdropFilter: 'blur(16px)',
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 150
            }
          }
        }}
      >
        {[
          { label: 'Off', val: null },
          { label: '10 seconds', val: 10 },
          { label: '30 seconds', val: 30 },
          { label: '5 minutes', val: 300 },
          { label: '1 hour', val: 3600 }
        ].map((item) => (
          <MenuItem
            key={String(item.val)}
            selected={ephemeralTimer === item.val}
            onClick={() => {
              setEphemeralTimer(item.val);
              setTimerAnchor(null);
            }}
            sx={{ fontSize: '0.8rem', fontWeight: 600, borderRadius: '4px', mx: 0.5 }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
