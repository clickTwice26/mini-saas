import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { ChatMessage, PeerInfo, CallState, FileMetadata, AudioMemoData } from './types';
import { p2pEngine, getDeterministicName, getPeerColor } from './services/p2pEngine';
import { soundService } from './services/soundService';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { MessageInput } from './components/MessageInput';
import { ConnectionModal } from './components/ConnectionModal';
import { PeerMeshVisualizer } from './components/PeerMeshVisualizer';
import { VideoCallModal } from './components/VideoCallModal';
import { FileProgressWidget } from './components/FileProgressWidget';

export const App: React.FC = () => {
  // Extract initial room from URL hash or generate fresh code
  const getRoomFromHash = () => {
    const hash = window.location.hash;
    if (hash.includes('room=')) {
      const match = hash.match(/room=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim().toUpperCase();
      }
    }
    return null;
  };

  const [roomId, setRoomId] = useState<string>(() => {
    const fromHash = getRoomFromHash();
    if (fromHash) return fromHash;

    const prefixes = ['NEXUS', 'CYBER', 'SOLAR', 'GHOST', 'SHADOW', 'QUANTUM', 'HYPER', 'PULSE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  });

  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isMeshVisualizerOpen, setIsMeshVisualizerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundService.getIsMuted());

  // File Transfer State for progress toast
  const [transferState, setTransferState] = useState<{
    meta: FileMetadata;
    type: 'upload' | 'download';
    progress: number;
  } | null>(null);

  // Call State
  const [callState, setCallState] = useState<CallState>({
    active: false,
    mode: 'video',
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    localStream: null,
    remoteStreams: {}
  });

  // Self information
  const selfName = p2pEngine.myName;
  const selfColor = p2pEngine.myColor;
  const selfId = p2pEngine.selfId;
  const currentActiveRoomRef = useRef<string>('');

  // Connect to P2P Room
  const initP2P = useCallback((targetRoomId: string) => {
    const cleanId = targetRoomId.trim().toUpperCase();
    if (!cleanId) return;

    if (currentActiveRoomRef.current === cleanId && p2pEngine.isConnected()) {
      return;
    }

    currentActiveRoomRef.current = cleanId;
    window.history.replaceState(null, '', `#room=${encodeURIComponent(cleanId)}`);
    setPeers([]);

    p2pEngine.connectToRoom(cleanId, {
      onPeerJoin: (peerId) => {
        const newPeer: PeerInfo = {
          id: peerId,
          name: getDeterministicName(peerId),
          avatarColor: getPeerColor(peerId),
          joinedAt: Date.now()
        };
        setPeers((prev) => {
          if (prev.some((p) => p.id === peerId)) return prev;
          return [...prev, newPeer];
        });
        soundService.playPeerJoined();

        // Celebration Confetti!
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#00f2fe', '#4facfe', '#a855f7', '#10b981']
        });
      },

      onPeerLeave: (peerId) => {
        setPeers((prev) => prev.filter((p) => p.id !== peerId));
        setCallState((prev) => {
          const nextRemotes = { ...prev.remoteStreams };
          delete nextRemotes[peerId];
          return { ...prev, remoteStreams: nextRemotes };
        });
        soundService.playPeerLeft();
      },

      onMessage: (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
        soundService.playReceived();
      },

      onTyping: (peerId, isTyping) => {
        setPeers((prev) =>
          prev.map((p) => (p.id === peerId ? { ...p, isTyping } : p))
        );
      },

      onReaction: (messageId, emoji, senderId) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;
            const current = msg.reactions || {};
            const userList = current[emoji] || [];
            const exists = userList.includes(senderId);
            const nextList = exists
              ? userList.filter((id) => id !== senderId)
              : [...userList, senderId];

            const nextReactions = { ...current };
            if (nextList.length > 0) {
              nextReactions[emoji] = nextList;
            } else {
              delete nextReactions[emoji];
            }
            return { ...msg, reactions: nextReactions };
          })
        );
      },

      onFileStart: (meta) => {
        setTransferState({ meta, type: 'download', progress: 0 });
      },

      onFileProgress: (_fileId, progress) => {
        setTransferState((prev) => (prev ? { ...prev, progress } : null));
      },

      onFileComplete: (meta) => {
        setTransferState(null);
        soundService.playReceived();
        const fileMsg: ChatMessage = {
          id: 'file-' + meta.id,
          senderId: meta.id,
          senderName: 'Peer',
          senderAvatarColor: 'var(--cyan-primary)',
          timestamp: Date.now(),
          type: 'file',
          fileData: meta,
          status: 'delivered'
        };
        setMessages((prev) => [...prev, fileMsg]);
      },

      onAudioMemo: (audio: AudioMemoData, senderId: string, senderName: string, senderAvatarColor: string) => {
        soundService.playReceived();
        const audioMsg: ChatMessage = {
          id: 'audio-' + Date.now(),
          senderId,
          senderName,
          senderAvatarColor,
          timestamp: Date.now(),
          type: 'audio',
          audioData: audio,
          status: 'delivered'
        };
        setMessages((prev) => [...prev, audioMsg]);
      },

      onStream: (stream, peerId) => {
        setCallState((prev) => ({
          ...prev,
          active: true,
          remoteStreams: {
            ...prev.remoteStreams,
            [peerId]: stream
          }
        }));
      }
    });
  }, []);

  // Connect on room change
  useEffect(() => {
    initP2P(roomId);
    return () => {
      p2pEngine.leaveRoom();
    };
  }, [roomId, initP2P]);

  // Listen to hash change from external sources
  useEffect(() => {
    const handleHashChange = () => {
      const fromHash = getRoomFromHash();
      if (fromHash && fromHash !== currentActiveRoomRef.current) {
        setMessages([]);
        setPeers([]);
        setRoomId(fromHash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Ephemeral Messages self-destruct cleaner
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) =>
        prev.filter((m) => !m.expiresAt || m.expiresAt > now)
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Switch Room handler
  const handleJoinRoom = (newRoomId: string) => {
    const cleanId = newRoomId.trim().toUpperCase();
    if (cleanId && cleanId !== roomId) {
      setMessages([]);
      setPeers([]);
      setRoomId(cleanId);
    }
  };

  // Chat message sending
  const handleSendMessage = (text: string, expiresAt?: number) => {
    const msg = p2pEngine.sendMessage(text, expiresAt);
    setMessages((prev) => [...prev, msg]);
    soundService.playSent();
  };

  // P2P File sending
  const handleSendFile = async (file: File) => {
    const tempMeta: FileMetadata = {
      id: 'upload-' + Date.now(),
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks: Math.ceil(file.size / (16 * 1024)),
      progress: 0
    };

    setTransferState({ meta: tempMeta, type: 'upload', progress: 0 });

    try {
      const msg = await p2pEngine.sendFile(file, (progress) => {
        setTransferState((prev) => (prev ? { ...prev, progress } : null));
      });
      setMessages((prev) => [...prev, msg]);
      soundService.playSent();
    } catch (err) {
      console.error('File send error:', err);
    } finally {
      setTimeout(() => setTransferState(null), 1000);
    }
  };

  // P2P Voice Memo sending
  const handleSendAudioMemo = async (blob: Blob, duration: number) => {
    const msg = await p2pEngine.sendAudioMemo(blob, duration);
    setMessages((prev) => [...prev, msg]);
    soundService.playSent();
  };

  // Emoji Reactions
  const handleReact = (messageId: string, emoji: string) => {
    p2pEngine.sendReaction(messageId, emoji);
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const current = msg.reactions || {};
        const userList = current[emoji] || [];
        const exists = userList.includes(selfId);
        const nextList = exists
          ? userList.filter((id) => id !== selfId)
          : [...userList, selfId];

        const nextReactions = { ...current };
        if (nextList.length > 0) {
          nextReactions[emoji] = nextList;
        } else {
          delete nextReactions[emoji];
        }
        return { ...msg, reactions: nextReactions };
      })
    );
  };

  // Call Handlers
  const handleStartCall = async (mode: 'video' | 'audio') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === 'video',
        audio: true
      });

      p2pEngine.addStream(stream);

      setCallState({
        active: true,
        mode,
        isMuted: false,
        isCameraOff: mode === 'audio',
        isScreenSharing: false,
        localStream: stream,
        remoteStreams: {}
      });
    } catch (err) {
      console.error('Could not start call:', err);
      alert('Camera / Microphone permission is needed to start a call.');
    }
  };

  const handleToggleMic = () => {
    if (!callState.localStream) return;
    const audioTrack = callState.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
    }
  };

  const handleToggleCamera = () => {
    if (!callState.localStream) return;
    const videoTrack = callState.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCallState((prev) => ({ ...prev, isCameraOff: !videoTrack.enabled }));
    }
  };

  const handleToggleScreenShare = async () => {
    if (!callState.active) return;

    if (!callState.isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (callState.localStream) {
          const oldVideoTrack = callState.localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            callState.localStream.removeTrack(oldVideoTrack);
          }
          callState.localStream.addTrack(screenTrack);
        }

        screenTrack.onended = () => {
          handleStartCall(callState.mode);
        };

        setCallState((prev) => ({ ...prev, isScreenSharing: true }));
      } catch (err) {
        console.error('Screen sharing error:', err);
      }
    } else {
      // Revert to camera
      handleStartCall(callState.mode);
    }
  };

  const handleEndCall = () => {
    if (callState.localStream) {
      callState.localStream.getTracks().forEach((t) => t.stop());
      p2pEngine.removeStream(callState.localStream);
    }
    setCallState({
      active: false,
      mode: 'video',
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      localStream: null,
      remoteStreams: {}
    });
  };

  // Sound mute toggle
  const handleToggleMute = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  // Panic Button: Wipes session memory & generates brand new room
  const handlePanicNuke = () => {
    soundService.playNuke();
    p2pEngine.leaveRoom();
    setMessages([]);
    setPeers([]);
    if (callState.active) handleEndCall();

    const prefixes = ['NEXUS', 'CYBER', 'SOLAR', 'GHOST', 'SHADOW', 'QUANTUM', 'HYPER', 'PULSE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const newId = `${prefix}-${num}`;
    setRoomId(newId);
  };

  const handleCopyRoomLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(roomId)}`;
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      navigator.share({
        title: 'Join my GhostLink P2P Room',
        text: `Connect to my encrypted P2P room #${roomId}`,
        url: inviteUrl
      }).catch(() => {
        navigator.clipboard.writeText(inviteUrl);
        setIsConnectModalOpen(true);
      });
    } else {
      navigator.clipboard.writeText(inviteUrl);
      setIsConnectModalOpen(true);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      position: 'relative',
      zIndex: 1
    }}>
      {/* Header */}
      <Header
        roomId={roomId}
        peers={peers}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onToggleMeshVisualizer={() => setIsMeshVisualizerOpen(!isMeshVisualizerOpen)}
        isMeshVisualizerOpen={isMeshVisualizerOpen}
        onStartCall={handleStartCall}
        onPanicNuke={handlePanicNuke}
        onCopyRoomLink={handleCopyRoomLink}
      />

      {/* Main Chat Thread Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        margin: '0 16px 12px',
        borderRadius: '24px',
        background: 'var(--bg-card)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <ChatArea
          messages={messages}
          selfId={selfId}
          peers={peers}
          currentRoomId={roomId}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onReact={handleReact}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onSendAudioMemo={handleSendAudioMemo}
          onTyping={(isTyping) => p2pEngine.sendTyping(isTyping)}
        />
      </main>

      {/* Connection & QR Modal */}
      <ConnectionModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentRoomId={roomId}
        onJoinRoom={handleJoinRoom}
      />

      {/* Mesh Topology Visualizer Modal */}
      <PeerMeshVisualizer
        isOpen={isMeshVisualizerOpen}
        onClose={() => setIsMeshVisualizerOpen(false)}
        peers={peers}
        selfName={selfName}
        selfColor={selfColor}
      />

      {/* Video / Audio Call Modal */}
      <VideoCallModal
        callState={callState}
        peers={peers}
        selfName={selfName}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onEndCall={handleEndCall}
      />

      {/* File Transfer Progress Widget */}
      <FileProgressWidget transferState={transferState} />
    </div>
  );
};

export default App;
