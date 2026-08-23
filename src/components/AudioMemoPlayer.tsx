import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import type { AudioMemoData } from '../types';

interface AudioMemoPlayerProps {
  audioData: AudioMemoData;
  isSelf: boolean;
}

export const AudioMemoPlayer: React.FC<AudioMemoPlayerProps> = ({ audioData, isSelf }) => {
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: isSelf ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.05)',
      padding: '8px 14px',
      borderRadius: '16px',
      minWidth: '220px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: 'none',
          background: isSelf ? 'var(--cyan-primary)' : 'var(--violet-primary)',
          color: '#04070d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 12px rgba(0,242,254,0.3)',
          transition: 'transform 0.15s ease'
        }}
      >
        {isPlaying ? <Pause size={16} fill="#04070d" /> : <Play size={16} fill="#04070d" style={{ marginLeft: '2px' }} />}
      </button>

      {/* Waveform Visual Bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, height: '24px' }}>
        {[8, 14, 20, 10, 18, 24, 12, 16, 22, 15, 10, 18, 12, 8].map((h, i) => {
          const activeProgress = (currentTime / (duration || 1)) * 14;
          const isPassed = i <= activeProgress;
          return (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${isPlaying ? Math.max(6, (h * (0.6 + Math.random() * 0.8))) : h}px`,
                background: isPassed ? 'var(--cyan-primary)' : 'rgba(255, 255, 255, 0.25)',
                borderRadius: '999px',
                transition: 'height 0.15s ease, background-color 0.15s ease'
              }}
            />
          );
        })}
      </div>

      {/* Duration Label */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        minWidth: '35px',
        textAlign: 'right'
      }}>
        {formatTime(isPlaying ? currentTime : duration)}
      </div>
    </div>
  );
};
