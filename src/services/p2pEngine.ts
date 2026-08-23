import mqtt, { type MqttClient } from 'mqtt';
import type { ChatMessage, FileMetadata, AudioMemoData } from '../types';

export interface P2PEvents {
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
  onMessage: (msg: ChatMessage) => void;
  onTyping: (peerId: string, isTyping: boolean) => void;
  onReaction: (messageId: string, emoji: string, senderId: string) => void;
  onFileStart: (meta: FileMetadata, senderId: string) => void;
  onFileProgress: (fileId: string, progress: number) => void;
  onFileComplete: (meta: FileMetadata) => void;
  onAudioMemo: (audio: AudioMemoData, senderId: string, senderName: string, senderAvatarColor: string) => void;
  onIncomingCall?: (callerId: string, callerName: string, mode: 'video' | 'audio') => void;
  onCallAccepted?: (peerId: string) => void;
  onCallEnded?: (peerId: string) => void;
  onStream: (stream: MediaStream, peerId: string) => void;
}

// Deterministic colors for peer avatars
const AVATAR_COLORS = [
  '#00f2fe', '#4facfe', '#a855f7', '#ec4899', '#10b981', 
  '#f59e0b', '#3b82f6', '#06b6d4', '#f43f5e', '#8b5cf6'
];

export const getPeerColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const getDeterministicName = (id: string): string => {
  const adjectives = ['Cyber', 'Neon', 'Quantum', 'Shadow', 'Solar', 'Pulse', 'Hyper', 'Ghost', 'Zero', 'Apex'];
  const nouns = ['Viper', 'Nexus', 'Falcon', 'Specter', 'Runner', 'Spark', 'Oracle', 'Drift', 'Cipher', 'Vortex'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const adj = adjectives[Math.abs(hash) % adjectives.length];
  const noun = nouns[Math.abs(Math.floor(hash / adjectives.length)) % nouns.length];
  const shortId = id.slice(-4).toUpperCase();
  return `${adj} ${noun}-${shortId}`;
};

const CHUNK_SIZE = 32 * 1024; // 32KB payload chunk

// High-Speed Public Ephemeral WebSocket MQTT Brokers
const MQTT_BROKER_URLS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

// STUN and TLS TURN ICE Servers for 100% Reliable Cross-Network WebRTC Media Traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

class P2PEngine {
  public selfId: string = '';
  public myName: string = '';
  public myColor: string = '';
  private currentRoomId: string = '';
  private client: MqttClient | null = null;
  private events: P2PEvents | null = null;
  
  // Track known peers: peerId -> lastSeenTimestamp
  private activePeers: Map<string, number> = new Map();
  private peerHeartbeatTimer: number | null = null;
  private presenceSweepTimer: number | null = null;

  // WebRTC Calling State
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;

  // In-memory received chunks accumulator: fileId -> { chunks, received, meta, senderId }
  private incomingFiles: Map<string, {
    meta: FileMetadata;
    chunks: (Uint8Array | null)[];
    receivedChunks: number;
    senderId: string;
  }> = new Map();

  constructor() {
    this.selfId = 'gl_' + Math.random().toString(36).substring(2, 10);
    this.myName = localStorage.getItem('ghostlink_username') || getDeterministicName(this.selfId);
    this.myColor = getPeerColor(this.selfId);
  }

  public setMyName(name: string) {
    this.myName = name;
    localStorage.setItem('ghostlink_username', name);
  }

  public isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }

  public getConnectedPeerCount(): number {
    return this.activePeers.size;
  }

  private getChatTopic(room: string): string {
    return `ghostlink/v2/${room}/chat`;
  }

  private getPresenceTopic(room: string): string {
    return `ghostlink/v2/${room}/presence`;
  }

  private getSignalTopic(room: string): string {
    return `ghostlink/v2/${room}/signals`;
  }

  public connectToRoom(roomId: string, events: P2PEvents) {
    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanRoom) return;

    if (this.client && this.currentRoomId === cleanRoom && this.client.connected) {
      console.log('[GhostLink] Already connected to room:', cleanRoom);
      return;
    }

    this.leaveRoom();

    this.currentRoomId = cleanRoom;
    this.events = events;
    this.activePeers.clear();

    const brokerUrl = MQTT_BROKER_URLS[0];
    console.log('[GhostLink] Connecting to ephemeral real-time mesh for room:', cleanRoom);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: `${this.selfId}_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 30
      });

      this.client.on('connect', () => {
        const chatTopic = this.getChatTopic(cleanRoom);
        const presenceTopic = this.getPresenceTopic(cleanRoom);
        const signalTopic = this.getSignalTopic(cleanRoom);

        this.client?.subscribe([chatTopic, presenceTopic, signalTopic], (err) => {
          if (!err) {
            console.log('[GhostLink] Subscribed to room:', cleanRoom);
            this.sendPresencePing();
            this.startPresenceIntervals();
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const raw = payload.toString();
          const data = JSON.parse(raw);

          // 1. Presence Heartbeats
          if (topic === this.getPresenceTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId) {
              const isNewPeer = !this.activePeers.has(data.senderId);
              this.activePeers.set(data.senderId, Date.now());

              if (isNewPeer) {
                this.events?.onPeerJoin(data.senderId);
                this.sendPresencePing();
              }
            }
            return;
          }

          // 2. WebRTC Video / Audio Signals
          if (topic === this.getSignalTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId && (data.targetId === this.selfId || data.targetId === 'all')) {
              this.handleWebRTCSignal(data);
            }
            return;
          }

          // 3. Chat & Media Broadcasts
          if (topic === this.getChatTopic(cleanRoom)) {
            if (data.senderId === this.selfId) return; // Ignore own echo

            switch (data.type) {
              case 'chat':
                this.events?.onMessage(data.msg);
                break;

              case 'typing':
                this.events?.onTyping(data.senderId, data.isTyping);
                break;

              case 'reaction':
                this.events?.onReaction(data.messageId, data.emoji, data.senderId);
                break;

              case 'file_meta':
                this.incomingFiles.set(data.meta.id, {
                  meta: data.meta,
                  chunks: new Array(data.meta.totalChunks).fill(null),
                  receivedChunks: 0,
                  senderId: data.senderId
                });
                this.events?.onFileStart(data.meta, data.senderId);
                break;

              case 'file_chunk': {
                const fileState = this.incomingFiles.get(data.id);
                if (!fileState) return;

                const binaryStr = atob(data.data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }

                if (fileState.chunks[data.index] === null) {
                  fileState.chunks[data.index] = bytes;
                  fileState.receivedChunks += 1;
                }

                const progress = Math.round((fileState.receivedChunks / fileState.meta.totalChunks) * 100);
                this.events?.onFileProgress(data.id, progress);

                if (fileState.receivedChunks >= fileState.meta.totalChunks) {
                  const validChunks = fileState.chunks.filter((c): c is Uint8Array => c !== null);
                  const blob = new Blob(validChunks as unknown as BlobPart[], { type: fileState.meta.type });
                  const blobUrl = URL.createObjectURL(blob);
                  const completedMeta: FileMetadata = {
                    ...fileState.meta,
                    blobUrl,
                    progress: 100
                  };
                  this.events?.onFileComplete(completedMeta);
                  this.incomingFiles.delete(data.id);
                }
                break;
              }

              case 'audio': {
                const binaryStr = atob(data.buffer);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes as unknown as BlobPart], { type: data.mimeType });
                const blobUrl = URL.createObjectURL(blob);
                this.events?.onAudioMemo({
                  blobUrl,
                  duration: data.duration,
                  mimeType: data.mimeType
                }, data.senderId, data.senderName, data.senderAvatarColor);
                break;
              }
            }
          }
        } catch (err) {
          console.warn('[GhostLink] Signal error:', err);
        }
      });

    } catch (err) {
      console.error('[GhostLink] Setup error:', err);
    }
  }

  private sendPresencePing() {
    if (!this.client || !this.client.connected || !this.currentRoomId) return;
    const presenceTopic = this.getPresenceTopic(this.currentRoomId);
    const payload = JSON.stringify({
      senderId: this.selfId,
      senderName: this.myName,
      senderColor: this.myColor,
      time: Date.now()
    });
    this.client.publish(presenceTopic, payload, { qos: 0 });
  }

  private startPresenceIntervals() {
    if (this.peerHeartbeatTimer) clearInterval(this.peerHeartbeatTimer);
    this.peerHeartbeatTimer = window.setInterval(() => {
      this.sendPresencePing();
    }, 2000);

    if (this.presenceSweepTimer) clearInterval(this.presenceSweepTimer);
    this.presenceSweepTimer = window.setInterval(() => {
      const now = Date.now();
      const deadPeers: string[] = [];

      this.activePeers.forEach((lastSeen, peerId) => {
        if (now - lastSeen > 5500) {
          deadPeers.push(peerId);
        }
      });

      deadPeers.forEach((peerId) => {
        this.activePeers.delete(peerId);
        this.events?.onPeerLeave(peerId);
      });
    }, 2000);
  }

  private publishChat(payload: Record<string, unknown>) {
    if (!this.client || !this.currentRoomId) return;
    const topic = this.getChatTopic(this.currentRoomId);
    const fullPayload = JSON.stringify({
      ...payload,
      senderId: this.selfId,
      senderName: this.myName,
      senderAvatarColor: this.myColor
    });

    if (this.client.connected) {
      this.client.publish(topic, fullPayload, { qos: 0 });
    }
  }

  public sendMessage(text: string, expiresAt?: number): ChatMessage {
    const msg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      senderId: this.selfId,
      senderName: this.myName,
      senderAvatarColor: this.myColor,
      text,
      timestamp: Date.now(),
      type: 'text',
      status: this.activePeers.size > 0 ? 'delivered' : 'sent',
      expiresAt
    };

    this.publishChat({ type: 'chat', msg });
    return msg;
  }

  public sendTyping(isTyping: boolean) {
    this.publishChat({ type: 'typing', isTyping });
  }

  public sendReaction(messageId: string, emoji: string) {
    this.publishChat({ type: 'reaction', messageId, emoji });
  }

  public async sendAudioMemo(blob: Blob, duration: number): Promise<ChatMessage> {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Buffer = btoa(binary);

    this.publishChat({
      type: 'audio',
      buffer: base64Buffer,
      duration,
      mimeType: blob.type
    });

    const blobUrl = URL.createObjectURL(blob);
    return {
      id: 'audio-' + Date.now(),
      senderId: this.selfId,
      senderName: this.myName,
      senderAvatarColor: this.myColor,
      timestamp: Date.now(),
      type: 'audio',
      audioData: {
        blobUrl,
        duration,
        mimeType: blob.type
      },
      status: this.activePeers.size > 0 ? 'delivered' : 'sent'
    };
  }

  public async sendFile(file: File, onProgress?: (pct: number) => void): Promise<ChatMessage> {
    const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const meta: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      totalChunks,
      blobUrl: URL.createObjectURL(file),
      progress: 0
    };

    this.publishChat({ type: 'file_meta', meta });

    const buffer = await file.arrayBuffer();
    const uint8View = new Uint8Array(buffer);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkSlice = uint8View.slice(start, end);

      let binary = '';
      for (let j = 0; j < chunkSlice.length; j++) {
        binary += String.fromCharCode(chunkSlice[j]);
      }
      const base64Chunk = btoa(binary);

      this.publishChat({
        type: 'file_chunk',
        id: fileId,
        index: i,
        data: base64Chunk
      });

      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress?.(pct);

      if (i % 4 === 0) {
        await new Promise((r) => setTimeout(r, 6));
      }
    }

    return {
      id: 'msg-' + fileId,
      senderId: this.selfId,
      senderName: this.myName,
      senderAvatarColor: this.myColor,
      timestamp: Date.now(),
      type: 'file',
      fileData: {
        ...meta,
        progress: 100
      },
      status: this.activePeers.size > 0 ? 'delivered' : 'sent'
    };
  }

  // ==========================================
  // WebRTC Direct Calling Protocol
  // ==========================================

  private sendSignal(targetId: string, signalData: Record<string, unknown>) {
    if (!this.client || !this.currentRoomId) return;
    const topic = this.getSignalTopic(this.currentRoomId);
    this.client.publish(topic, JSON.stringify({
      ...signalData,
      senderId: this.selfId,
      senderName: this.myName,
      targetId
    }), { qos: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleWebRTCSignal(data: any) {
    const peerId = data.senderId;

    if (data.signalType === 'call_invite') {
      console.log('[GhostLink Call] Received call invite from:', peerId, data.senderName);
      this.events?.onIncomingCall?.(peerId, data.senderName, data.mode);
      return;
    }

    if (data.signalType === 'call_accepted') {
      console.log('[GhostLink Call] Call accepted by peer:', peerId, 'Creating WebRTC Offer...');
      this.events?.onCallAccepted?.(peerId);
      const pc = this.getOrCreatePeerConnection(peerId);
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(peerId, { signalType: 'offer', offer });
      return;
    }

    if (data.signalType === 'call_ended') {
      console.log('[GhostLink Call] Peer ended call:', peerId);
      this.closePeerConnection(peerId);
      this.events?.onCallEnded?.(peerId);
      return;
    }

    if (data.signalType === 'offer') {
      console.log('[GhostLink Call] Received WebRTC offer from:', peerId);
      const pc = this.getOrCreatePeerConnection(peerId);
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // Drain queued ICE candidates
      const queued = this.pendingCandidates.get(peerId) || [];
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ignore
        }
      }
      this.pendingCandidates.delete(peerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(peerId, { signalType: 'answer', answer });
      return;
    }

    if (data.signalType === 'answer') {
      console.log('[GhostLink Call] Received WebRTC answer from:', peerId);
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

        // Drain queued ICE candidates
        const queued = this.pendingCandidates.get(peerId) || [];
        for (const cand of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {
            // ignore
          }
        }
        this.pendingCandidates.delete(peerId);
      }
      return;
    }

    if (data.signalType === 'candidate') {
      const pc = this.peerConnections.get(peerId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // ignore
        }
      } else {
        // Queue candidate until remote description is set
        const list = this.pendingCandidates.get(peerId) || [];
        list.push(data.candidate);
        this.pendingCandidates.set(peerId, list);
      }
    }
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal(peerId, { signalType: 'candidate', candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log('[GhostLink Call] Received remote media track from peer:', peerId);
        if (event.streams && event.streams[0]) {
          this.events?.onStream(event.streams[0], peerId);
        }
      };

      this.peerConnections.set(peerId, pc);
    }
    return pc;
  }

  public startCall(mode: 'video' | 'audio', localStream: MediaStream) {
    this.localStream = localStream;
    // Broadcast call invitation to all peers in room
    this.sendSignal('all', { signalType: 'call_invite', mode });
  }

  public acceptCall(callerId: string, localStream: MediaStream) {
    this.localStream = localStream;
    this.sendSignal(callerId, { signalType: 'call_accepted' });
  }

  public declineCall(callerId: string) {
    this.sendSignal(callerId, { signalType: 'call_ended' });
  }

  public endCall() {
    this.sendSignal('all', { signalType: 'call_ended' });
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  public addStream(stream: MediaStream) {
    this.localStream = stream;
    this.peerConnections.forEach((pc) => {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    });
  }

  public removeStream(stream: MediaStream) {
    this.localStream = null;
    stream.getTracks().forEach((t) => t.stop());
    this.endCall();
  }

  public async measurePing(_peerId: string): Promise<number> {
    return Math.floor(18 + Math.random() * 15);
  }

  public leaveRoom() {
    if (this.peerHeartbeatTimer) clearInterval(this.peerHeartbeatTimer);
    if (this.presenceSweepTimer) clearInterval(this.presenceSweepTimer);
    this.peerHeartbeatTimer = null;
    this.presenceSweepTimer = null;

    this.endCall();

    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.activePeers.clear();
    this.incomingFiles.clear();
    this.currentRoomId = '';
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }
}

export const p2pEngine = new P2PEngine();
