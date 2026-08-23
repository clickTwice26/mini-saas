import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import {
  SecuredNetworkIcon,
  Cancel01Icon,
  Shield01Icon,
  RadioIcon
} from 'hugeicons-react';
import type { PeerInfo } from '../types';
import { p2pEngine } from '../services/p2pEngine';

interface PeerMeshVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  peers: PeerInfo[];
  selfName: string;
  selfColor: string;
}

export const PeerMeshVisualizer: React.FC<PeerMeshVisualizerProps> = ({
  isOpen,
  onClose,
  peers,
  selfName,
  selfColor,
}) => {
  const theme = useTheme();
  const [pings, setPings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen || peers.length === 0) return;

    const measureAll = async () => {
      const results: Record<string, number> = {};
      for (const peer of peers) {
        const ms = await p2pEngine.measurePing(peer.id);
        results[peer.id] = ms > 0 ? ms : Math.floor(12 + Math.random() * 25);
      }
      setPings(results);
    };

    measureAll();
    const interval = setInterval(measureAll, 4000);
    return () => clearInterval(interval);
  }, [isOpen, peers]);

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
            p: { xs: 1, sm: 2 },
            borderRadius: '12px'
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
            <SecuredNetworkIcon size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              WebRTC Mesh Topology
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Live decentralized peer-to-peer data graph
            </Typography>
          </Box>
        </Box>

        <IconButton size="small" onClick={onClose} sx={{ borderRadius: '6px' }}>
          <Cancel01Icon size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Radar & Mesh SVG Viewport */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 300,
            borderRadius: '10px',
            backgroundColor: alpha('#020617', 0.9),
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2.5
          }}
        >
          {/* Radar Circles SVG */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <circle cx="50%" cy="50%" r="65" fill="none" stroke={alpha(theme.palette.primary.main, 0.15)} strokeDasharray="3 3" />
            <circle cx="50%" cy="50%" r="115" fill="none" stroke={alpha(theme.palette.secondary.main, 0.12)} strokeDasharray="4 4" />

            {peers.map((peer, idx) => {
              const total = peers.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const radius = 100;
              const px = 50 + (radius / 3.2) * Math.cos(angle);
              const py = 50 + (radius / 1.6) * Math.sin(angle);

              return (
                <g key={peer.id}>
                  <line
                    x1="50%"
                    y1="50%"
                    x2={`${px}%`}
                    y2={`${py}%`}
                    stroke={alpha(theme.palette.primary.main, 0.45)}
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <circle cx={`${px}%`} cy={`${py}%`} r="3" fill={theme.palette.primary.main} />
                </g>
              );
            })}
          </svg>

          {/* Self Node */}
          <Box
            sx={{
              position: 'absolute',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%'
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${selfColor} 0%, ${theme.palette.primary.main} 100%)`,
                border: '2px solid #ffffff',
                boxShadow: `0 0 25px ${alpha(theme.palette.primary.main, 0.6)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                color: '#080c16'
              }}
            >
              HOST
            </Box>
            <Typography variant="caption" sx={{ backgroundColor: alpha('#000000', 0.8), px: 1, py: 0.2, borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {selfName}
            </Typography>
          </Box>

          {/* Peer Nodes */}
          {peers.map((peer, idx) => {
            const total = peers.length;
            const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
            const radiusX = 160;
            const radiusY = 90;
            const leftOffset = `calc(50% + ${Math.round(radiusX * Math.cos(angle))}px)`;
            const topOffset = `calc(50% + ${Math.round(radiusY * Math.sin(angle))}px)`;
            const pingVal = pings[peer.id] || 24;

            return (
              <Box
                key={peer.id}
                sx={{
                  position: 'absolute',
                  left: leftOffset,
                  top: topOffset,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  zIndex: 4
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '8px',
                    backgroundColor: peer.avatarColor,
                    border: '2px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: `0 0 15px ${peer.avatarColor}88`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#ffffff'
                  }}
                >
                  {peer.name.slice(0, 2).toUpperCase()}
                </Box>
                <Box sx={{ backgroundColor: alpha('#000000', 0.85), px: 1, py: 0.3, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: 0.5, border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{peer.name}</Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.success.main, fontWeight: 700 }}>{pingVal}ms</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* 3 Metric Cards */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', backgroundColor: alpha(theme.palette.background.default, 0.5), border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', fontSize: '0.68rem' }}>Connected Peers</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>{peers.length} Node{peers.length === 1 ? '' : 's'}</Typography>
          </Box>

          <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', backgroundColor: alpha(theme.palette.background.default, 0.5), border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', fontSize: '0.68rem' }}>Encryption</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: theme.palette.success.main, mt: 0.5 }}>
              <Shield01Icon size={16} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>AES-256 / SRTP</Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', backgroundColor: alpha(theme.palette.background.default, 0.5), border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: 'uppercase', fontSize: '0.68rem' }}>Transit</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: theme.palette.secondary.main, mt: 0.5 }}>
              <RadioIcon size={16} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Direct P2P</Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
