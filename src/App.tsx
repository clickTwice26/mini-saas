import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import confetti from 'canvas-confetti';
import { m3Theme } from './theme/m3Theme';
import type { ChatMessage, PeerInfo, CallState, FileMetadata, AudioMemoData } from './types';
import { p2pEngine, getDeterministicName, getPeerColor } from './services/p2pEngine';
import { cryptoService } from './services/cryptoService';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { MessageInput } from './components/MessageInput';
import { ConnectionModal } from './components/ConnectionModal';
import { PeerMeshVisualizer } from './components/PeerMeshVisualizer';
import { VideoCallModal } from './components/VideoCallModal';
import { ScreenStreamModal } from './components/ScreenStreamModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { RoomLockedModal } from './components/RoomLockedModal';
import { FileProgressWidget } from './components/FileProgressWidget';

export const App: React.FC = () => {
  // Extract initial room and secret key from URL fragment (#room=...&key=...)
  const getParamsFromHash = () => {
    const hash = window.location.hash;
    let room = '';
    let key = '';

    if (hash.includes('room=')) {
      const roomMatch = hash.match(/room=([^&]+)/);
      if (roomMatch && roomMatch[1]) {
        room = decodeURIComponent(roomMatch[1]).trim().toUpperCase();
      }
    }

    if (hash.includes('key=')) {
      const keyMatch = hash.match(/key=([^&]+)/);
      if (keyMatch && keyMatch[1]) {
        key = decodeURIComponent(keyMatch[1]).trim();
      }
    }

    return { room, key };
  };

  const generateFreshRoomId = () => {
    const prefixes = ['VAULT', 'NEXUS', 'CYBER', 'SOLAR', 'GHOST', 'SHADOW', 'QUANTUM', 'PULSE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  };

  // State: Room ID & 256-bit Secret Key Token
  const [roomId, setRoomId] = useState<string>(() => {
    const { room } = getParamsFromHash();
    return room || generateFreshRoomId();
  });

  const [secretKey, setSecretKey] = useState<string>(() => {
    const { key } = getParamsFromHash();
    return key || cryptoService.generateSecureKey();
  });

  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isMeshVisualizerOpen, setIsMeshVisualizerOpen] = useState(false);
  const [isRoomLockedOpen, setIsRoomLockedOpen] = useState(false);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    mode: 'video' | 'audio';
  } | null>(null);

  // File Transfer State for progress toast
  const [transferState, setTransferState] = useState<{
    meta: FileMetadata;
    type: 'upload' | 'download';
    progress: number;
  } | null>(null);

  // Active Interactive Call State
  const [callState, setCallState] = useState<CallState>({
    active: false,
    mode: 'video',
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    localStream: null,
    remoteStreams: {}
  });

  // Zero-Acceptance Live Screen Stream State
  const [screenStreamState, setScreenStreamState] = useState<{
    active: boolean;
    isBroadcaster: boolean;
    stream: MediaStream | null;
    broadcasterName?: string;
  }>({
    active: false,
    isBroadcaster: false,
    stream: null
  });

  const cameraStreamRef = useRef<MediaStream | null>(null);

  const selfName = p2pEngine.myName;
  const selfColor = p2pEngine.myColor;
  const selfId = p2pEngine.selfId;
  const currentActiveSessionRef = useRef<string>('');

  // Connect to 1-on-1 Encrypted P2P Vault
  const initP2P = useCallback((targetRoomId: string, targetKey: string) => {
    const cleanRoom = targetRoomId.trim().toUpperCase();
    const cleanKey = targetKey.trim();
    if (!cleanRoom || !cleanKey) return;

    const sessionFingerprint = `${cleanRoom}:${cleanKey}`;
    if (currentActiveSessionRef.current === sessionFingerprint && p2pEngine.isConnected()) {
      return;
    }

    currentActiveSessionRef.current = sessionFingerprint;
    window.history.replaceState(null, '', `#room=${encodeURIComponent(cleanRoom)}&key=${encodeURIComponent(cleanKey)}`);
    setPeers([]);
    setIsRoomLockedOpen(false);

    p2pEngine.connectToRoom(cleanRoom, cleanKey, {
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

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#38bdf8', '#a78bfa', '#34d399']
        });
      },

      onPeerLeave: (peerId) => {
        setPeers((prev) => prev.filter((p) => p.id !== peerId));
        setCallState((prev) => {
          const nextRemotes = { ...prev.remoteStreams };
          delete nextRemotes[peerId];
          return { ...prev, remoteStreams: nextRemotes };
        });
        setScreenStreamState((prev) => prev.isBroadcaster ? prev : { active: false, isBroadcaster: false, stream: null });
      },

      onRoomLocked: () => {
        setIsRoomLockedOpen(true);
      },

      onMessage: (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
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
        const fileMsg: ChatMessage = {
          id: 'file-' + meta.id,
          senderId: meta.id,
          senderName: 'Peer',
          senderAvatarColor: '#38bdf8',
          timestamp: Date.now(),
          type: 'file',
          fileData: meta,
          status: 'delivered'
        };
        setMessages((prev) => [...prev, fileMsg]);
      },

      onAudioMemo: (audio: AudioMemoData, senderId: string, senderName: string, senderAvatarColor: string) => {
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

      onIncomingCall: (callerId, callerName, mode) => {
        setIncomingCall({ callerId, callerName, mode });
      },

      onCallEnded: () => {
        setIncomingCall(null);
        handleEndCall();
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
      },

      // Zero-Acceptance Live Screen Stream Reception
      onScreenStreamStart: (stream, _broadcasterId, broadcasterName) => {
        setScreenStreamState({
          active: true,
          isBroadcaster: false,
          stream,
          broadcasterName
        });
      },

      onScreenStreamEnd: () => {
        setScreenStreamState({
          active: false,
          isBroadcaster: false,
          stream: null
        });
      }
    });
  }, []);

  // Connect on room or key change
  useEffect(() => {
    initP2P(roomId, secretKey);
    return () => {
      p2pEngine.leaveRoom();
    };
  }, [roomId, secretKey, initP2P]);

  // Listen to hash change from external sources
  useEffect(() => {
    const handleHashChange = () => {
      const { room, key } = getParamsFromHash();
      if (room && (room !== roomId || (key && key !== secretKey))) {
        setMessages([]);
        setPeers([]);
        setRoomId(room);
        if (key) setSecretKey(key);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [roomId, secretKey]);

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
  const handleJoinRoom = (newRoomId: string, newSecretKey: string) => {
    const cleanRoom = newRoomId.trim().toUpperCase();
    const cleanKey = newSecretKey.trim() || secretKey;
    if (cleanRoom) {
      setMessages([]);
      setPeers([]);
      setRoomId(cleanRoom);
      setSecretKey(cleanKey);
    }
  };

  // Generate completely fresh Room & Key
  const handleGenerateNewRoomAndKey = () => {
    p2pEngine.leaveRoom();
    setMessages([]);
    setPeers([]);
    if (callState.active) handleEndCall();
    if (screenStreamState.active) handleStopScreenBroadcast();

    const newRoom = generateFreshRoomId();
    const newKey = cryptoService.generateSecureKey();
    setRoomId(newRoom);
    setSecretKey(newKey);
  };

  // Chat message sending (Encrypted with AES-GCM-256)
  const handleSendMessage = (text: string, expiresAt?: number) => {
    const msg = p2pEngine.sendMessage(text, expiresAt);
    setMessages((prev) => [...prev, msg]);
  };

  // P2P File sending
  const handleSendFile = async (file: File) => {
    const tempMeta: FileMetadata = {
      id: 'upload-' + Date.now(),
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks: Math.ceil(file.size / (32 * 1024)),
      progress: 0
    };

    setTransferState({ meta: tempMeta, type: 'upload', progress: 0 });

    try {
      const msg = await p2pEngine.sendFile(file, (progress) => {
        setTransferState((prev) => (prev ? { ...prev, progress } : null));
      });
      setMessages((prev) => [...prev, msg]);
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

  // ==========================================
  // Zero-Acceptance Live Screen Stream Broadcast
  // ==========================================

  const handleStartScreenBroadcast = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      p2pEngine.startScreenStreamBroadcast(screenStream);

      setScreenStreamState({
        active: true,
        isBroadcaster: true,
        stream: screenStream
      });

      screenTrack.onended = () => {
        handleStopScreenBroadcast();
      };
    } catch (err) {
      console.warn('Screen share broadcast cancelled or unsupported:', err);
    }
  };

  const handleStopScreenBroadcast = () => {
    p2pEngine.stopScreenStreamBroadcast();
    setScreenStreamState({
      active: false,
      isBroadcaster: false,
      stream: null
    });
  };

  // ==========================================
  // Interactive 2-Way Call Handlers
  // ==========================================

  const handleStartCall = async (mode: 'video' | 'audio') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === 'video',
        audio: true
      });

      cameraStreamRef.current = stream;
      p2pEngine.startCall(mode, stream);

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

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.mode === 'video',
        audio: true
      });

      cameraStreamRef.current = stream;
      p2pEngine.acceptCall(incomingCall.callerId, stream);

      setCallState({
        active: true,
        mode: incomingCall.mode,
        isMuted: false,
        isCameraOff: incomingCall.mode === 'audio',
        isScreenSharing: false,
        localStream: stream,
        remoteStreams: {}
      });

      setIncomingCall(null);
    } catch (err) {
      console.error('Could not accept call:', err);
      alert('Please allow camera/microphone permissions to join the call.');
      handleDeclineIncomingCall();
    }
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall) {
      p2pEngine.declineCall(incomingCall.callerId);
      setIncomingCall(null);
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

  const stopScreenSharing = () => {
    if (cameraStreamRef.current) {
      const cameraTrack = cameraStreamRef.current.getVideoTracks()[0];
      if (cameraTrack) {
        p2pEngine.replaceVideoTrack(cameraTrack);
      }
      setCallState((prev) => ({
        ...prev,
        isScreenSharing: false,
        localStream: cameraStreamRef.current
      }));
    }
  };

  const handleToggleScreenShare = async () => {
    if (!callState.active) return;

    if (!callState.isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        p2pEngine.replaceVideoTrack(screenTrack);

        setCallState((prev) => ({
          ...prev,
          isScreenSharing: true,
          localStream: screenStream
        }));

        screenTrack.onended = () => {
          stopScreenSharing();
        };
      } catch (err) {
        console.warn('Screen share cancelled or unsupported:', err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const handleEndCall = () => {
    p2pEngine.endCall();
    if (callState.localStream) {
      callState.localStream.getTracks().forEach((t) => t.stop());
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
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

  const handleCopyRoomLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(secretKey)}`;
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      navigator.share({
        title: 'Join my GhostLink 2-Person Encrypted Vault',
        text: `Connect to my 1-on-1 AES-GCM-256 encrypted room #${roomId}`,
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
    <ThemeProvider theme={m3Theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'background.default',
          overflow: 'hidden'
        }}
      >
        {/* M3 Header */}
        <Header
          roomId={roomId}
          secretKey={secretKey}
          peers={peers}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onToggleMeshVisualizer={() => setIsMeshVisualizerOpen(!isMeshVisualizerOpen)}
          isMeshVisualizerOpen={isMeshVisualizerOpen}
          onStartCall={handleStartCall}
          onStartScreenShare={handleStartScreenBroadcast}
          onPanicNuke={handleGenerateNewRoomAndKey}
          onCopyRoomLink={handleCopyRoomLink}
        />

        {/* Main Chat Canvas Card (Crisp 10px radius) */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            mx: { xs: 1, sm: 1.5 },
            mb: { xs: 1, sm: 1.5 },
            borderRadius: '10px',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
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
        </Box>

        {/* Connection & QR Modal */}
        <ConnectionModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          currentRoomId={roomId}
          currentSecretKey={secretKey}
          onJoinRoom={handleJoinRoom}
          onGenerateNewRoom={handleGenerateNewRoomAndKey}
        />

        {/* Mesh Topology Visualizer Modal */}
        <PeerMeshVisualizer
          isOpen={isMeshVisualizerOpen}
          onClose={() => setIsMeshVisualizerOpen(false)}
          peers={peers}
          selfName={selfName}
          selfColor={selfColor}
        />

        {/* Incoming Call Ringing Modal */}
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />

        {/* Zero-Acceptance Live Screen Stream Modal */}
        {screenStreamState.active && (
          <ScreenStreamModal
            stream={screenStreamState.stream}
            isBroadcaster={screenStreamState.isBroadcaster}
            broadcasterName={screenStreamState.broadcasterName}
            onStopBroadcast={handleStopScreenBroadcast}
            onCloseViewer={() => setScreenStreamState({ active: false, isBroadcaster: false, stream: null })}
          />
        )}

        {/* Room Locked Security Lockdown Modal */}
        <RoomLockedModal
          isOpen={isRoomLockedOpen}
          onGenerateNewRoom={handleGenerateNewRoomAndKey}
        />

        {/* Active Interactive Video / Audio Call Modal */}
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
      </Box>
    </ThemeProvider>
  );
};

export default App;
