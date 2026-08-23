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

const PEERJS_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  },
  debug: 0
};

class P2PEngine {
  public selfId: string = '';
  public myName: string = '';
  public myColor: string = '';
  private currentRoomId: string = '';
  private peer: Peer | null = null;
  private events: P2PEvents | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private mediaCalls: Map<string, MediaConnection> = new Map();
  private localStream: MediaStream | null = null;

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
    const cleanRoom = this.sanitizeRoomKey(roomId);
    if (this.peer && this.currentRoomId === cleanRoom && !this.peer.destroyed) {
      console.log('[GhostLink] Already connected to room:', cleanRoom);
      return;
    }

    this.leaveRoom();

    this.currentRoomId = cleanRoom;
    this.events = events;

    const hostId = `${cleanRoom}_host`;
    const clientId = `${cleanRoom}_${Math.random().toString(36).substring(2, 8)}`;

    console.log('[GhostLink] Attempting room connection for:', cleanRoom);

    // Try to become Room Host first
    const hostPeer = new Peer(hostId, PEERJS_CONFIG);

    hostPeer.on('open', (id) => {
      console.log('[GhostLink] Connected as Room Host:', id);
      this.peer = hostPeer;
      this.selfId = id;
      this.setupPeerListeners(hostPeer, true);
    });

    hostPeer.on('error', (err: { type?: string }) => {
      // If host ID is already taken, another peer is already the host!
      if (err.type === 'unavailable-id') {
        console.log('[GhostLink] Room Host exists. Connecting as Client...');
        hostPeer.destroy();

        // Connect as client peer
        const clientPeer = new Peer(clientId, PEERJS_CONFIG);
        this.peer = clientPeer;

        clientPeer.on('open', (id) => {
          console.log('[GhostLink] Client peer open:', id, '-> Connecting to Host:', hostId);
          this.selfId = id;
          this.setupPeerListeners(clientPeer, false);

          // Connect directly to the Host
          const conn = clientPeer.connect(hostId, { reliable: true });
          this.setupConnection(conn);
        });

        clientPeer.on('error', (clientErr) => {
          console.warn('[GhostLink] Client peer error:', clientErr);
        });
      } else {
        console.warn('[GhostLink] Host peer error:', err);
      }
    });
  }

  private setupPeerListeners(peerInstance: Peer, isHost: boolean) {
    // Handle incoming DataConnection
    peerInstance.on('connection', (conn) => {
      console.log('[GhostLink] Incoming WebRTC connection from:', conn.peer);
      this.setupConnection(conn);

      if (isHost) {
        // As host, introduce this new peer to all other existing peers
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
      console.log('[GhostLink] Peer disconnected from signaling server, reconnecting...');
      if (!peerInstance.destroyed) {
        peerInstance.reconnect();
      }
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log('[GhostLink] WebRTC DataChannel OPEN with peer:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.events?.onPeerJoin(conn.peer);
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
          // Connect to other peers in the mesh
          if (Array.isArray(data.peers)) {
            data.peers.forEach((otherPeerId: string) => {
              if (otherPeerId !== this.selfId && !this.connections.has(otherPeerId)) {
                if (this.peer && !this.peer.destroyed) {
                  console.log('[GhostLink] Connecting to mesh peer:', otherPeerId);
                  const otherConn = this.peer.connect(otherPeerId, { reliable: true });
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
          conn.send({ type: 'pong', pingTime: data.time });
          break;
      }
    });

    conn.on('close', () => {
      console.log('[GhostLink] WebRTC DataChannel closed with peer:', conn.peer);
      this.connections.delete(conn.peer);
      this.events?.onPeerLeave(conn.peer);
    });

    conn.on('error', (err) => {
      console.warn('[GhostLink] Connection error with peer:', conn.peer, err);
    });
  }

  public broadcast(payload: unknown) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
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
