import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, alpha, useTheme } from '@mui/material';
import {
  PlayIcon,
  PauseIcon
} from 'hugeicons-react';
import type { AudioMemoData } from '../types';

interface AudioMemoPlayerProps {
  audioData: AudioMemoData;
  isSelf: boolean;
}

export const AudioMemoPlayer: React.FC<AudioMemoPlayerProps> = ({ audioData, isSelf }) => {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audioData.duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioData.blobUrl);
    audioRef.current = audio;

    const handleLoaded = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioData.blobUrl, audioData.duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const barHeights = [8, 14, 20, 10, 18, 24, 12, 16, 22, 15, 10, 18, 12, 8];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        backgroundColor: isSelf ? alpha(theme.palette.background.default, 0.4) : alpha('#ffffff', 0.05),
        px: 1.5,
        py: 0.8,
        borderRadius: '6px',
        minWidth: 220,
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`
      }}
    >
      <IconButton
        size="small"
        onClick={togglePlay}
        sx={{
          width: 32,
          height: 32,
          backgroundColor: isSelf ? theme.palette.primary.main : theme.palette.secondary.main,
          color: '#080c16',
          borderRadius: '6px',
          '&:hover': {
            backgroundColor: isSelf ? theme.palette.primary.light : theme.palette.secondary.light,
            transform: 'scale(1.05)'
          }
        }}
      >
        {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </IconButton>

      {/* Waveform Bars */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flex: 1, height: 24 }}>
        {barHeights.map((h, i) => {
          const activeProgress = (currentTime / (duration || 1)) * barHeights.length;
          const isPassed = i <= activeProgress;
          return (
            <Box
              key={i}
              sx={{
                width: 3,
                height: isPlaying ? Math.max(6, h * (0.6 + Math.random() * 0.8)) : h,
                backgroundColor: isPassed ? theme.palette.primary.main : alpha('#ffffff', 0.25),
                borderRadius: '2px',
                transition: 'height 0.15s ease, background-color 0.15s ease'
              }}
            />
          );
        })}
      </Box>

      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary, minWidth: 32, textAlign: 'right' }}>
        {formatTime(isPlaying ? currentTime : duration)}
      </Typography>
    </Box>
  );
};
