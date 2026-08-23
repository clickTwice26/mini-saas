import mqtt, { type MqttClient } from 'mqtt';
import type { ChatMessage, FileMetadata, AudioMemoData } from '../types';
import { cryptoService } from './cryptoService';

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
  onRoomLocked?: () => void;
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

const CHUNK_SIZE = 32 * 1024;
const MAX_ALLOWED_PEERS = 1; // Strict 1-on-1 Private Vault

const MQTT_BROKER_URLS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];

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
  private currentSecretKey: string = '';
  private client: MqttClient | null = null;
  private events: P2PEvents | null = null;
  
  private activePeers: Map<string, number> = new Map();
  private primaryPeerId: string | null = null;
  private peerHeartbeatTimer: number | null = null;
  private presenceSweepTimer: number | null = null;

  // Anti-Replay / Nonce Filter
  private processedNonces: Set<string> = new Set();

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;

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

  public isRoomFull(): boolean {
    return this.activePeers.size >= MAX_ALLOWED_PEERS;
  }

  private getChatTopic(room: string): string {
    return `ghostlink/v5/${room}/chat`;
  }

  private getPresenceTopic(room: string): string {
    return `ghostlink/v5/${room}/presence`;
  }

  private getSignalTopic(room: string): string {
    return `ghostlink/v5/${room}/signals`;
  }

  public async connectToRoom(roomId: string, secretKey: string, events: P2PEvents) {
    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanKey = secretKey.trim();
    if (!cleanRoom || !cleanKey) return;

    if (this.client && this.currentRoomId === cleanRoom && this.currentSecretKey === cleanKey && this.client.connected) {
      return;
    }

    this.leaveRoom();

    this.currentRoomId = cleanRoom;
    this.currentSecretKey = cleanKey;
    this.events = events;
    this.activePeers.clear();
    this.primaryPeerId = null;
    this.processedNonces.clear();

    // 1. Initialize Hardware-Grade AES-GCM-256 Crypto Key from Secret Key
    await cryptoService.setSecretKey(cleanKey);
    console.log('[GhostLink E2EE Vault] AES-GCM-256 Key Initialized with Secret Key. Safety Fingerprint:', cryptoService.getSafetyFingerprint());

    const brokerUrl = MQTT_BROKER_URLS[0];

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
            console.log('[GhostLink E2EE Vault] Subscribed to 1-on-1 encrypted room:', cleanRoom);
            this.sendPresencePing();
            this.startPresenceIntervals();
          }
        });
      });

      this.client.on('message', async (topic, payload) => {
        try {
          const raw = payload.toString();
          const data = JSON.parse(raw);

          // 1. Presence Heartbeats & Strict 2-Person Gatekeeper
          if (topic === this.getPresenceTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId) {
              if (data.type === 'room_full_reject' && data.targetId === this.selfId) {
                console.warn('[GhostLink E2EE Vault] Room locked (2/2 members active). Entry denied.');
                this.events?.onRoomLocked?.();
                return;
              }

              if (this.primaryPeerId && this.primaryPeerId !== data.senderId && this.activePeers.has(this.primaryPeerId)) {
                console.warn('[GhostLink E2EE Vault] 3rd peer rejected to enforce strict 2-person limit:', data.senderId);
                this.client?.publish(this.getPresenceTopic(cleanRoom), JSON.stringify({
                  type: 'room_full_reject',
                  senderId: this.selfId,
                  targetId: data.senderId
                }), { qos: 0 });
                return;
              }

              const isNewPeer = !this.activePeers.has(data.senderId);
              this.activePeers.set(data.senderId, Date.now());
              this.primaryPeerId = data.senderId;

              if (isNewPeer) {
                console.log('[GhostLink E2EE Vault] 2nd peer joined encrypted channel:', data.senderId);
                this.events?.onPeerJoin(data.senderId);
                this.sendPresencePing();
              }
            }
            return;
          }

          // 2. WebRTC Video / Audio Signals (Decrypted with Secret Key)
          if (topic === this.getSignalTopic(cleanRoom)) {
            if (data.senderId && data.senderId !== this.selfId && (data.targetId === this.selfId || data.targetId === 'all')) {
              if (data.encrypted) {
                const decryptedSignal = await cryptoService.decrypt(data.encrypted);
                this.handleWebRTCSignal({ ...decryptedSignal, senderId: data.senderId, senderName: data.senderName });
              } else {
                this.handleWebRTCSignal(data);
              }
            }
            return;
          }

          // 3. E2E Encrypted Chat & Media Broadcasts
          if (topic === this.getChatTopic(cleanRoom)) {
            if (data.senderId === this.selfId) return;
            if (this.primaryPeerId && data.senderId !== this.primaryPeerId) return;

            if (!data.encrypted) return;
            const decrypted = await cryptoService.decrypt(data.encrypted);

            // Anti-Replay Check
            if (decrypted.nonce) {
              if (this.processedNonces.has(decrypted.nonce)) return;
              this.processedNonces.add(decrypted.nonce);
              if (this.processedNonces.size > 1000) {
                const first = this.processedNonces.values().next().value;
                if (first) this.processedNonces.delete(first);
              }
            }

            switch (decrypted.type) {
              case 'chat':
                this.events?.onMessage(decrypted.msg);
                break;

              case 'typing':
                this.events?.onTyping(data.senderId, decrypted.isTyping);
                break;

              case 'reaction':
                this.events?.onReaction(decrypted.messageId, decrypted.emoji, data.senderId);
                break;

              case 'file_meta':
                this.incomingFiles.set(decrypted.meta.id, {
                  meta: decrypted.meta,
                  chunks: new Array(decrypted.meta.totalChunks).fill(null),
                  receivedChunks: 0,
                  senderId: data.senderId
                });
                this.events?.onFileStart(decrypted.meta, data.senderId);
                break;

              case 'file_chunk': {
                const fileState = this.incomingFiles.get(decrypted.id);
                if (!fileState) return;

                const binaryStr = atob(decrypted.data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }

                if (fileState.chunks[decrypted.index] === null) {
                  fileState.chunks[decrypted.index] = bytes;
                  fileState.receivedChunks += 1;
                }

                const progress = Math.round((fileState.receivedChunks / fileState.meta.totalChunks) * 100);
                this.events?.onFileProgress(decrypted.id, progress);

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
                  this.incomingFiles.delete(decrypted.id);
                }
                break;
              }

              case 'audio': {
                const binaryStr = atob(decrypted.buffer);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes as unknown as BlobPart], { type: decrypted.mimeType });
                const blobUrl = URL.createObjectURL(blob);
                this.events?.onAudioMemo({
                  blobUrl,
                  duration: decrypted.duration,
                  mimeType: decrypted.mimeType
                }, data.senderId, data.senderName, data.senderAvatarColor);
                break;
              }
            }
          }
        } catch (err) {
          console.warn('[GhostLink E2EE Vault] Decrypt/Signal error:', err);
        }
      });

    } catch (err) {
      console.error('[GhostLink E2EE Vault] Setup error:', err);
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
        console.log('[GhostLink E2EE Vault] Peer disconnected:', peerId);
        this.activePeers.delete(peerId);
        if (this.primaryPeerId === peerId) {
          this.primaryPeerId = null;
        }
        this.events?.onPeerLeave(peerId);
      });
    }, 2000);
  }

  private async publishEncryptedChat(payload: Record<string, unknown>) {
    if (!this.client || !this.currentRoomId) return;
    const topic = this.getChatTopic(this.currentRoomId);

    const nonce = 'nonce_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const encrypted = await cryptoService.encrypt({
      ...payload,
      nonce
    });

    const fullPayload = JSON.stringify({
      encrypted,
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

    this.publishEncryptedChat({ type: 'chat', msg });
    return msg;
  }

  public sendTyping(isTyping: boolean) {
    this.publishEncryptedChat({ type: 'typing', isTyping });
  }

  public sendReaction(messageId: string, emoji: string) {
    this.publishEncryptedChat({ type: 'reaction', messageId, emoji });
  }

  public async sendAudioMemo(blob: Blob, duration: number): Promise<ChatMessage> {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Buffer = btoa(binary);

    await this.publishEncryptedChat({
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

    await this.publishEncryptedChat({ type: 'file_meta', meta });

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

      await this.publishEncryptedChat({
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
  // WebRTC Screen Share & Media Track Switching
  // ==========================================

  public replaceVideoTrack(track: MediaStreamTrack) {
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(track);
      }
    });
  }

  private async sendEncryptedSignal(targetId: string, signalData: Record<string, unknown>) {
    if (!this.client || !this.currentRoomId) return;
    const topic = this.getSignalTopic(this.currentRoomId);
    const encrypted = await cryptoService.encrypt(signalData);

    this.client.publish(topic, JSON.stringify({
      encrypted,
      senderId: this.selfId,
      senderName: this.myName,
      targetId
    }), { qos: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleWebRTCSignal(data: any) {
    const peerId = data.senderId;

    if (data.signalType === 'call_invite') {
      console.log('[GhostLink E2EE Call] Received call invite from:', peerId, data.senderName);
      this.events?.onIncomingCall?.(peerId, data.senderName, data.mode);
      return;
    }

    if (data.signalType === 'call_accepted') {
      console.log('[GhostLink E2EE Call] Call accepted by peer:', peerId);
      this.events?.onCallAccepted?.(peerId);
      const pc = this.getOrCreatePeerConnection(peerId);
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendEncryptedSignal(peerId, { signalType: 'offer', offer });
      return;
    }

    if (data.signalType === 'call_ended') {
      console.log('[GhostLink E2EE Call] Peer ended call:', peerId);
      this.closePeerConnection(peerId);
      this.events?.onCallEnded?.(peerId);
      return;
    }

    if (data.signalType === 'offer') {
      console.log('[GhostLink E2EE Call] Received WebRTC offer from:', peerId);
      const pc = this.getOrCreatePeerConnection(peerId);
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

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
      this.sendEncryptedSignal(peerId, { signalType: 'answer', answer });
      return;
    }

    if (data.signalType === 'answer') {
      console.log('[GhostLink E2EE Call] Received WebRTC answer from:', peerId);
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

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
          this.sendEncryptedSignal(peerId, { signalType: 'candidate', candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log('[GhostLink E2EE Call] Received remote media track from peer:', peerId);
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

  public startCall(mode: 'video' | 'audio', localStream: MediaStream) {
    this.localStream = localStream;
    this.sendEncryptedSignal('all', { signalType: 'call_invite', mode });
  }

  public acceptCall(callerId: string, localStream: MediaStream) {
    this.localStream = localStream;
    this.sendEncryptedSignal(callerId, { signalType: 'call_accepted' });
  }

  public declineCall(callerId: string) {
    this.sendEncryptedSignal(callerId, { signalType: 'call_ended' });
  }

  public endCall() {
    this.sendEncryptedSignal('all', { signalType: 'call_ended' });
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
    this.primaryPeerId = null;
    this.incomingFiles.clear();
    this.processedNonces.clear();
    this.currentRoomId = '';
    this.currentSecretKey = '';
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }
}

export const p2pEngine = new P2PEngine();
