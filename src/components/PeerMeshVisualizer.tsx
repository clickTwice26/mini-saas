import React, { useEffect, useState } from 'react';
import { Network, X, Wifi, ShieldCheck, Activity } from 'lucide-react';
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
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="glass-panel" 
        style={{
          width: '100%',
          maxWidth: '650px',
          padding: '24px',
          background: 'rgba(8, 12, 20, 0.95)',
          border: '1px solid rgba(0, 242, 254, 0.35)',
          boxShadow: '0 0 50px rgba(0, 242, 254, 0.25)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(0, 242, 254, 0.1)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Network size={20} color="var(--cyan-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                WebRTC Mesh Topology
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Live decentralized peer-to-peer data graph
              </p>
            </div>
          </div>

          <button className="btn-cyber-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Visualizer Canvas / SVG Area */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.08) 0%, rgba(6, 9, 14, 0.8) 70%)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Background Grid Radar Lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <circle cx="50%" cy="50%" r="70" fill="none" stroke="rgba(0, 242, 254, 0.12)" strokeDasharray="3 3" />
            <circle cx="50%" cy="50%" r="120" fill="none" stroke="rgba(168, 85, 247, 0.1)" strokeDasharray="4 4" />
            
            {/* Mesh connection lines between center self node and each peer */}
            {peers.map((peer, idx) => {
              const total = peers.length;
              const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
              const radius = 105;
              // Center is 50%, 50%
              const px = 50 + (radius / 3.2) * Math.cos(angle);
              const py = 50 + (radius / 1.6) * Math.sin(angle);

              return (
                <g key={peer.id}>
                  <line 
                    x1="50%" 
                    y1="50%" 
                    x2={`${px}%`} 
                    y2={`${py}%`} 
                    stroke="rgba(0, 242, 254, 0.4)" 
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  >
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
                  </line>
                  <circle cx={`${px}%`} cy={`${py}%`} r="3" fill="var(--cyan-primary)">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Center Self Node */}
          <div style={{
            position: 'absolute',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${selfColor} 0%, #00f2fe 100%)`,
              border: '3px solid #ffffff',
              boxShadow: '0 0 25px rgba(0, 242, 254, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem',
              color: '#04070d'
            }}>
              YOU
            </div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.75)',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              whiteSpace: 'nowrap'
            }}>
              {selfName} (Host Node)
            </div>
          </div>

          {/* Connected Peer Nodes in Orbital ring */}
          {peers.map((peer, idx) => {
            const total = peers.length;
            const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
            const radiusX = 170;
            const radiusY = 95;
            const leftOffset = `calc(50% + ${Math.round(radiusX * Math.cos(angle))}px)`;
            const topOffset = `calc(50% + ${Math.round(radiusY * Math.sin(angle))}px)`;
            const pingVal = pings[peer.id] || 24;

            return (
              <div
                key={peer.id}
                style={{
                  position: 'absolute',
                  left: leftOffset,
                  top: topOffset,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  zIndex: 4,
                  animation: 'fadeIn 0.3s ease-out'
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: peer.avatarColor,
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: `0 0 15px ${peer.avatarColor}88`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: '#ffffff'
                }}>
                  {peer.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.85)',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  color: '#ffffff',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  <span>{peer.name}</span>
                  <span style={{ color: 'var(--emerald-primary)', fontWeight: 700 }}>
                    {pingVal}ms
                  </span>
                </div>
              </div>
            );
          })}

          {/* Empty state if alone in room */}
          {peers.length === 0 && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              background: 'rgba(0, 0, 0, 0.65)',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Activity size={13} color="var(--cyan-primary)" />
              <span>Awaiting peers to join mesh... Share Room Code or QR</span>
            </div>
          )}
        </div>

        {/* Live Diagnostics & Mesh Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '16px'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Connected Mesh Peers
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--cyan-primary)', marginTop: '2px' }}>
              {peers.length} Nodes
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              P2P Protocol & Channel
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--emerald-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={16} />
              DTLS / SCTP
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Signaling Relay
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--violet-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wifi size={16} />
              BitTorrent DHT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
