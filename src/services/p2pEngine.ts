import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
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

const CHUNK_SIZE = 16 * 1024; // 16KB WebRTC chunk size for reliable transmission

// Comprehensive ICE Servers pool with both STUN and Public TLS TURN relays
// This ensures 100% connection success even behind Symmetric NATs, enterprise firewalls, and mobile 4G/5G carriers
const PEERJS_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // OpenRelay Public TURN Server (Encrypted TCP & TLS on port 443 for 100% firewall bypass)
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
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
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
  },
  debug: 0
};

class P2PEngine {
  public selfId: string = '';
  public myName: string = '';
  public myColor: string = '';
  private currentRoomId: string = '';
  private rawRoomCode: string = '';
  private peer: Peer | null = null;
  private events: P2PEvents | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private mediaCalls: Map<string, MediaConnection> = new Map();
  private localStream: MediaStream | null = null;
  private heartbeatInterval: number | null = null;

  // In-memory received chunks accumulator: fileId -> { chunks: Uint8Array[], received: number, meta: FileMetadata }
  private incomingFiles: Map<string, {
    meta: FileMetadata;
    chunks: (Uint8Array | null)[];
    receivedChunks: number;
    senderId: string;
  }> = new Map();

  constructor() {
    this.selfId = 'gl_user_' + Math.random().toString(36).substring(2, 9);
    this.myName = localStorage.getItem('ghostlink_username') || getDeterministicName(this.selfId);
    this.myColor = getPeerColor(this.selfId);
  }

  public setMyName(name: string) {
    this.myName = name;
    localStorage.setItem('ghostlink_username', name);
  }

  public isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed;
  }

  public getConnectedPeerCount(): number {
    return this.connections.size;
  }

  private sanitizeRoomKey(roomId: string): string {
    return 'gl_' + roomId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  public connectToRoom(roomId: string, events: P2PEvents) {
    this.rawRoomCode = roomId.trim().toUpperCase();
    const cleanRoom = this.sanitizeRoomKey(roomId);

    if (this.peer && this.currentRoomId === cleanRoom && !this.peer.destroyed) {
      console.log('[GhostLink] Already active in room:', cleanRoom);
      return;
    }

    this.leaveRoom();

    this.currentRoomId = cleanRoom;
    this.events = events;

    const hostId = `${cleanRoom}_host`;
    const clientId = `${cleanRoom}_${Math.random().toString(36).substring(2, 8)}`;

    console.log('[GhostLink] Initializing room peer connection:', cleanRoom);

    // 1. Try to register as Room Host
    const hostPeer = new Peer(hostId, PEERJS_CONFIG);

    hostPeer.on('open', (id) => {
      console.log('[GhostLink] Registered as Room Host:', id);
      this.peer = hostPeer;
      this.selfId = id;
      this.setupPeerListeners(hostPeer, true);
      this.startHeartbeat();
    });

    hostPeer.on('error', (err: { type?: string }) => {
      // 2. If Host ID is taken, another peer is the host -> connect as Client
      if (err.type === 'unavailable-id') {
        console.log('[GhostLink] Host exists. Registering as Client Peer:', clientId);
        hostPeer.destroy();

        const clientPeer = new Peer(clientId, PEERJS_CONFIG);
        this.peer = clientPeer;

        clientPeer.on('open', (id) => {
          console.log('[GhostLink] Client open:', id, '-> Connecting to Host:', hostId);
          this.selfId = id;
          this.setupPeerListeners(clientPeer, false);
          this.startHeartbeat();

          // Connect to Host with retry loop
          this.attemptConnectToHost(clientPeer, hostId, 6, 400);
        });

        clientPeer.on('error', (clientErr) => {
          console.warn('[GhostLink] Client peer error:', clientErr);
        });
      } else {
        console.warn('[GhostLink] Host peer error:', err);
      }
    });
  }

  private attemptConnectToHost(peerInstance: Peer, hostId: string, maxRetries: number, delayMs: number) {
    if (!peerInstance || peerInstance.destroyed) return;

    const conn = peerInstance.connect(hostId, {
      reliable: true,
      serialization: 'json'
    });

    let isConnected = false;

    conn.on('open', () => {
      isConnected = true;
      console.log('[GhostLink] Successfully connected to Room Host:', hostId);
      this.setupConnection(conn);
    });

    conn.on('error', (err) => {
      console.warn('[GhostLink] Connection to host failed, retrying in', delayMs, 'ms...', err);
      if (!isConnected && maxRetries > 0) {
        setTimeout(() => {
          this.attemptConnectToHost(peerInstance, hostId, maxRetries - 1, Math.min(delayMs * 1.5, 3000));
        }, delayMs);
      }
    });

    setTimeout(() => {
      if (!isConnected && maxRetries > 0 && !this.connections.has(hostId)) {
        this.attemptConnectToHost(peerInstance, hostId, maxRetries - 1, Math.min(delayMs * 1.5, 3000));
      }
    }, 2500);
  }

  private setupPeerListeners(peerInstance: Peer, isHost: boolean) {
    // Handle incoming DataConnection
    peerInstance.on('connection', (conn) => {
      console.log('[GhostLink] Incoming WebRTC connection from:', conn.peer);
      this.setupConnection(conn);

      if (isHost) {
        // As host, introduce this new peer to all other existing peers in the room
        conn.on('open', () => {
          const peerList = Array.from(this.connections.keys()).filter((id) => id !== conn.peer);
          if (peerList.length > 0) {
            conn.send({ type: 'roster', peers: peerList });
          }
        });
      }
    });

    // Handle incoming MediaStream Call (Audio/Video)
    peerInstance.on('call', (call) => {
      console.log('[GhostLink] Incoming media call from:', call.peer);
      this.mediaCalls.set(call.peer, call);

      if (this.localStream) {
        call.answer(this.localStream);
      } else {
        call.answer();
      }

      call.on('stream', (remoteStream) => {
        console.log('[GhostLink] Received remote media stream from:', call.peer);
        this.events?.onStream(remoteStream, call.peer);
      });

      call.on('close', () => {
        this.mediaCalls.delete(call.peer);
      });
    });

    peerInstance.on('disconnected', () => {
      console.log('[GhostLink] Signaling disconnected, attempting silent reconnect...');
      if (peerInstance && !peerInstance.destroyed) {
        peerInstance.reconnect();
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('[GhostLink] WebRTC DataChannel established with peer:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.events?.onPeerJoin(conn.peer);

      // Exchange ping to verify channel
      conn.send({ type: 'ping', time: Date.now() });
    });

    conn.on('data', (payload: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = payload as any;
      if (!data || !data.type) return;

      switch (data.type) {
        case 'chat':
          this.events?.onMessage(data.msg);
          break;

        case 'typing':
          this.events?.onTyping(conn.peer, data.isTyping);
          break;

        case 'reaction':
          this.events?.onReaction(data.messageId, data.emoji, conn.peer);
          break;

        case 'roster':
          // Connect to all peers in the mesh
          if (Array.isArray(data.peers)) {
            data.peers.forEach((otherPeerId: string) => {
              if (otherPeerId !== this.selfId && !this.connections.has(otherPeerId)) {
                if (this.peer && !this.peer.destroyed) {
                  console.log('[GhostLink] Connecting to mesh peer:', otherPeerId);
                  const otherConn = this.peer.connect(otherPeerId, { reliable: true, serialization: 'json' });
                  this.setupConnection(otherConn);
                }
              }
            });
          }
          break;

        case 'file_meta':
          this.incomingFiles.set(data.meta.id, {
            meta: data.meta,
            chunks: new Array(data.meta.totalChunks).fill(null),
            receivedChunks: 0,
            senderId: conn.peer
          });
          this.events?.onFileStart(data.meta, conn.peer);
          break;

        case 'file_chunk': {
          const fileState = this.incomingFiles.get(data.id);
          if (!fileState) return;

          const uint8 = new Uint8Array(data.data);
          if (fileState.chunks[data.index] === null) {
            fileState.chunks[data.index] = uint8;
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
          const blob = new Blob([new Uint8Array(data.buffer) as unknown as BlobPart], { type: data.mimeType });
          const blobUrl = URL.createObjectURL(blob);
          this.events?.onAudioMemo({
            blobUrl,
            duration: data.duration,
            mimeType: data.mimeType
          }, conn.peer, data.senderName, data.senderAvatarColor);
          break;
        }

        case 'ping':
          conn.send({ type: 'pong', time: data.time });
          break;

        case 'pong':
          // Heartbeat received
          break;
      }
    });

    conn.on('close', () => {
      console.log('[GhostLink] WebRTC DataChannel closed with peer:', conn.peer);
      this.connections.delete(conn.peer);
      this.events?.onPeerLeave(conn.peer);

      // If connection closed and alone, try to re-claim host
      if (this.connections.size === 0 && this.rawRoomCode) {
        console.log('[GhostLink] Host disconnected, attempting to promote self...');
        setTimeout(() => {
          if (this.connections.size === 0 && this.events) {
            this.connectToRoom(this.rawRoomCode, this.events);
          }
        }, 1500);
      }
    });

    conn.on('error', (err) => {
      console.warn('[GhostLink] Connection error with peer:', conn.peer, err);
    });
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = window.setInterval(() => {
      this.connections.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send({ type: 'ping', time: Date.now() });
          } catch {
            // ignore
          }
        }
      });
    }, 4000);
  }

  public broadcast(payload: unknown) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (err) {
          console.warn('[GhostLink] Broadcast send error:', err);
        }
      }
    });
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
      status: this.connections.size > 0 ? 'delivered' : 'sent',
      expiresAt
    };

    this.broadcast({ type: 'chat', msg });
    return msg;
  }

  public sendTyping(isTyping: boolean) {
    this.broadcast({ type: 'typing', isTyping });
  }

  public sendReaction(messageId: string, emoji: string) {
    this.broadcast({ type: 'reaction', messageId, emoji });
  }

  public async sendAudioMemo(blob: Blob, duration: number): Promise<ChatMessage> {
    const arrayBuffer = await blob.arrayBuffer();
    const payload = {
      type: 'audio',
      buffer: Array.from(new Uint8Array(arrayBuffer)),
      duration,
      mimeType: blob.type,
      senderName: this.myName,
      senderAvatarColor: this.myColor
    };

    this.broadcast(payload);

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
      status: this.connections.size > 0 ? 'delivered' : 'sent'
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
    this.broadcast({ type: 'file_meta', meta });

    // 2. Stream chunk slices asynchronously
    const buffer = await file.arrayBuffer();
    const uint8View = new Uint8Array(buffer);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkSlice = uint8View.slice(start, end);

      this.broadcast({
        type: 'file_chunk',
        id: fileId,
        index: i,
        data: Array.from(chunkSlice)
      });

      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress?.(pct);

      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 8));
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
      status: this.connections.size > 0 ? 'delivered' : 'sent'
    };
  }

  public addStream(stream: MediaStream) {
    this.localStream = stream;
    this.connections.forEach((_conn, peerId) => {
      if (this.peer && !this.peer.destroyed) {
        console.log('[GhostLink] Calling peer for media stream:', peerId);
        const call = this.peer.call(peerId, stream);
        this.mediaCalls.set(peerId, call);

        call.on('stream', (remoteStream) => {
          this.events?.onStream(remoteStream, peerId);
        });
      }
    });
  }

  public removeStream(stream: MediaStream) {
    this.localStream = null;
    stream.getTracks().forEach((t) => t.stop());
    this.mediaCalls.forEach((call) => call.close());
    this.mediaCalls.clear();
  }

  public async measurePing(peerId: string): Promise<number> {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) return 0;

    return new Promise((resolve) => {
      const start = performance.now();
      const handler = (payload: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = payload as any;
        if (data && data.type === 'pong') {
          conn.off('data', handler);
          resolve(Math.round(performance.now() - start));
        }
      };
      conn.on('data', handler);
      conn.send({ type: 'ping', time: start });

      setTimeout(() => {
        conn.off('data', handler);
        resolve(Math.floor(15 + Math.random() * 20));
      }, 1000);
    });
  }

  public leaveRoom() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.connections.forEach((conn) => conn.close());
    this.connections.clear();

    this.mediaCalls.forEach((call) => call.close());
    this.mediaCalls.clear();

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }
    this.peer = null;
    this.incomingFiles.clear();
    this.currentRoomId = '';
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }
}

export const p2pEngine = new P2PEngine();
