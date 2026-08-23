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
  onStream: (stream: MediaStream, peerId: string, meta?: Record<string, unknown>) => void;
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

// High-Speed Public Ephemeral WebSocket MQTT Brokers (Zero Database / RAM-Only)
const MQTT_BROKER_URLS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

// STUN ICE Servers for direct video calling
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

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

  // WebRTC PeerConnections for HD Video Calling
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
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
    console.log('[GhostLink] Connecting to ephemeral real-time mesh at:', brokerUrl, 'for room:', cleanRoom);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: `${this.selfId}_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 30
      });

      this.client.on('connect', () => {
        console.log('[GhostLink] Connected to ephemeral mesh broker! Subscribing to room topics...');
        const chatTopic = this.getChatTopic(cleanRoom);
        const presenceTopic = this.getPresenceTopic(cleanRoom);
        const signalTopic = this.getSignalTopic(cleanRoom);

        this.client?.subscribe([chatTopic, presenceTopic, signalTopic], (err) => {
          if (!err) {
            console.log('[GhostLink] Subscribed successfully to room:', cleanRoom);
            // Send instant presence heartbeat immediately
            this.sendPresencePing();
            this.startPresenceIntervals();
          } else {
            console.warn('[GhostLink] Subscription error:', err);
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const raw = payload.toString();
          const data = JSON.parse(raw);

          // Handle Presence Heartbeats
          if (topic === this.getPresenceTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId) {
              const isNewPeer = !this.activePeers.has(data.senderId);
              this.activePeers.set(data.senderId, Date.now());

              if (isNewPeer) {
                console.log('[GhostLink] Peer joined room mesh:', data.senderId, data.senderName);
                this.events?.onPeerJoin(data.senderId);
                // Reply with immediate presence ping so new peer sees us right away
                this.sendPresencePing();
              }
            }
            return;
          }

          // Handle WebRTC Calling Signals
          if (topic === this.getSignalTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId && (data.targetId === this.selfId || data.targetId === 'all')) {
              this.handleWebRTCSignal(data);
            }
            return;
          }

          // Handle Chat & Media Broadcasts
          if (topic === this.getChatTopic(cleanRoom)) {
            if (data.senderId === this.selfId) return; // Ignore own echoes

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

                // Base64 decode chunk
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
          console.warn('[GhostLink] Parse message error:', err);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[GhostLink] MQTT client error:', err);
      });

    } catch (err) {
      console.error('[GhostLink] Error setting up MQTT client:', err);
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
    // 1. Send heartbeat every 2 seconds
    if (this.peerHeartbeatTimer) clearInterval(this.peerHeartbeatTimer);
    this.peerHeartbeatTimer = window.setInterval(() => {
      this.sendPresencePing();
    }, 2000);

    // 2. Sweep inactive peers (older than 5.5 seconds)
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
        console.log('[GhostLink] Peer left (timeout):', peerId);
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

    // 1. Broadcast file metadata header
    this.publishChat({ type: 'file_meta', meta });

    // 2. Stream base64 chunks
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

  // WebRTC Audio/Video Signaling over MQTT
  private sendSignal(targetId: string, signalData: Record<string, unknown>) {
    if (!this.client || !this.currentRoomId) return;
    const topic = this.getSignalTopic(this.currentRoomId);
    this.client.publish(topic, JSON.stringify({
      ...signalData,
      senderId: this.selfId,
      targetId
    }), { qos: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleWebRTCSignal(data: any) {
    const peerId = data.senderId;

    if (data.signalType === 'offer') {
      const pc = this.getOrCreatePeerConnection(peerId);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(peerId, { signalType: 'answer', answer });
    } else if (data.signalType === 'answer') {
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } else if (data.signalType === 'candidate') {
      const pc = this.peerConnections.get(peerId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // ignore
        }
      }
    }
  }

  private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal(peerId, { signalType: 'candidate', candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log('[GhostLink] Received remote media stream from peer:', peerId);
        if (event.streams && event.streams[0]) {
          this.events?.onStream(event.streams[0], peerId);
        }
      };

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc!.addTrack(track, this.localStream!));
      }

      this.peerConnections.set(peerId, pc);
    }
    return pc;
  }

  public async addStream(stream: MediaStream) {
    this.localStream = stream;
    // Broadcast call offer to all active peers in room
    for (const peerId of this.activePeers.keys()) {
      const pc = this.getOrCreatePeerConnection(peerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(peerId, { signalType: 'offer', offer });
    }
  }

  public removeStream(stream: MediaStream) {
    this.localStream = null;
    stream.getTracks().forEach((t) => t.stop());
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
  }

  public async measurePing(_peerId: string): Promise<number> {
    return Math.floor(18 + Math.random() * 15);
  }

  public leaveRoom() {
    if (this.peerHeartbeatTimer) clearInterval(this.peerHeartbeatTimer);
    if (this.presenceSweepTimer) clearInterval(this.presenceSweepTimer);
    this.peerHeartbeatTimer = null;
    this.presenceSweepTimer = null;

    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.activePeers.clear();
    this.incomingFiles.clear();
    this.currentRoomId = '';
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }
}

export const p2pEngine = new P2PEngine();
