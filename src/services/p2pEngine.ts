import { joinRoom, selfId } from 'trystero';
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
  const shortId = id.slice(0, 3).toUpperCase();
  return `${adj} ${noun}-${shortId}`;
};

const CHUNK_SIZE = 16 * 1024; // 16KB WebRTC chunk size for reliable transmission

class P2PEngine {
  public selfId: string = selfId;
  public myName: string = '';
  public myColor: string = '';
  private currentRoomId: string = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private room: any = null;
  private events: P2PEvents | null = null;

  // In-memory received chunks accumulator: fileId -> { chunks: Uint8Array[], received: number, meta: FileMetadata }
  private incomingFiles: Map<string, {
    meta: FileMetadata;
    chunks: (Uint8Array | null)[];
    receivedChunks: number;
    senderId: string;
  }> = new Map();

  // Action senders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendChatAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendTypingAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendReactionAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendFileMetaAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendFileChunkAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendAudioAction: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendPongAction: any = null;

  constructor() {
    this.myName = localStorage.getItem('ghostlink_username') || getDeterministicName(this.selfId);
    this.myColor = getPeerColor(this.selfId);
  }

  public setMyName(name: string) {
    this.myName = name;
    localStorage.setItem('ghostlink_username', name);
  }

  public connectToRoom(roomId: string, events: P2PEvents) {
    if (this.room) {
      this.leaveRoom();
    }

    this.currentRoomId = roomId;
    this.events = events;

    const normalizedRoom = roomId.trim().toLowerCase();
    const config = {
      appId: 'ghostlink-p2p-saas-v1'
    };

    try {
      this.room = joinRoom(config, normalizedRoom);

      // Register WebRTC DataChannel Actions
      const [sendChat, onChat] = this.room.makeAction('chat');
      const [sendTyping, onTyping] = this.room.makeAction('typing');
      const [sendReaction, onReaction] = this.room.makeAction('reaction');
      const [sendFileMeta, onFileMeta] = this.room.makeAction('file_meta');
      const [sendFileChunk, onFileChunk] = this.room.makeAction('file_chunk');
      const [sendAudio, onAudio] = this.room.makeAction('audio');
      const [, onPing] = this.room.makeAction('ping');
      const [sendPong] = this.room.makeAction('pong');

      this.sendChatAction = sendChat;
      this.sendTypingAction = sendTyping;
      this.sendReactionAction = sendReaction;
      this.sendFileMetaAction = sendFileMeta;
      this.sendFileChunkAction = sendFileChunk;
      this.sendAudioAction = sendAudio;
      this.sendPongAction = sendPong;

      // Handle Peer Life Cycle
      this.room.onPeerJoin((peerId: string) => {
        this.events?.onPeerJoin(peerId);
      });

      this.room.onPeerLeave((peerId: string) => {
        this.events?.onPeerLeave(peerId);
      });

      // Handle Incoming Chat Messages
      onChat((data: ChatMessage) => {
        this.events?.onMessage(data);
      });

      // Handle Typing
      onTyping((data: { isTyping: boolean }, peerId: string) => {
        this.events?.onTyping(peerId, data.isTyping);
      });

      // Handle Reactions
      onReaction((data: { messageId: string; emoji: string }, peerId: string) => {
        this.events?.onReaction(data.messageId, data.emoji, peerId);
      });

      // Handle File Metadata Header
      onFileMeta((meta: FileMetadata, peerId: string) => {
        this.incomingFiles.set(meta.id, {
          meta,
          chunks: new Array(meta.totalChunks).fill(null),
          receivedChunks: 0,
          senderId: peerId
        });
        this.events?.onFileStart(meta, peerId);
      });

      // Handle File Binary Chunk
      onFileChunk((chunkData: { id: string; index: number; data: ArrayBuffer | number[] }) => {
        const fileState = this.incomingFiles.get(chunkData.id);
        if (!fileState) return;

        const uint8 = new Uint8Array(chunkData.data);
        if (fileState.chunks[chunkData.index] === null) {
          fileState.chunks[chunkData.index] = uint8;
          fileState.receivedChunks += 1;
        }

        const progress = Math.round((fileState.receivedChunks / fileState.meta.totalChunks) * 100);
        this.events?.onFileProgress(chunkData.id, progress);

        // Check if all chunks received
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
          this.incomingFiles.delete(chunkData.id);
        }
      });

      // Handle Audio Memos
      onAudio((audioPayload: { buffer: ArrayBuffer | number[]; duration: number; mimeType: string; senderName: string; senderAvatarColor: string }, peerId: string) => {
        const blob = new Blob([new Uint8Array(audioPayload.buffer) as unknown as BlobPart], { type: audioPayload.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        this.events?.onAudioMemo({
          blobUrl,
          duration: audioPayload.duration,
          mimeType: audioPayload.mimeType
        }, peerId, audioPayload.senderName, audioPayload.senderAvatarColor);
      });

      // Handle Latency Ping/Pong
      onPing((pingTime: number, peerId: string) => {
        if (this.sendPongAction) {
          this.sendPongAction(pingTime, peerId);
        }
      });

      // Handle Media Stream (Audio/Video calling)
      this.room.onPeerStream((stream: MediaStream, peerId: string, metadata?: Record<string, unknown>) => {
        this.events?.onStream(stream, peerId, metadata);
      });

    } catch (err) {
      console.error('Error connecting to WebRTC mesh room:', err);
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
      status: 'sent',
      expiresAt
    };

    if (this.sendChatAction) {
      this.sendChatAction(msg);
    }

    return msg;
  }

  public sendTyping(isTyping: boolean) {
    if (this.sendTypingAction) {
      this.sendTypingAction({ isTyping });
    }
  }

  public sendReaction(messageId: string, emoji: string) {
    if (this.sendReactionAction) {
      this.sendReactionAction({ messageId, emoji });
    }
  }

  public async sendAudioMemo(blob: Blob, duration: number): Promise<ChatMessage> {
    const arrayBuffer = await blob.arrayBuffer();
    const payload = {
      buffer: Array.from(new Uint8Array(arrayBuffer)),
      duration,
      mimeType: blob.type,
      senderName: this.myName,
      senderAvatarColor: this.myColor
    };

    if (this.sendAudioAction) {
      this.sendAudioAction(payload);
    }

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
      status: 'sent'
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
    if (this.sendFileMetaAction) {
      this.sendFileMetaAction(meta);
    }

    // 2. Stream chunk slices asynchronously
    const buffer = await file.arrayBuffer();
    const uint8View = new Uint8Array(buffer);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkSlice = uint8View.slice(start, end);

      if (this.sendFileChunkAction) {
        this.sendFileChunkAction({
          id: fileId,
          index: i,
          data: Array.from(chunkSlice)
        });
      }

      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress?.(pct);

      // Yield slightly to prevent blocking WebRTC channel buffer
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 10));
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
      status: 'sent'
    };
  }

  public addStream(stream: MediaStream, targetPeerId?: string) {
    if (this.room) {
      this.room.addStream(stream, targetPeerId);
    }
  }

  public removeStream(stream: MediaStream, targetPeerId?: string) {
    if (this.room) {
      this.room.removeStream(stream, targetPeerId);
    }
  }

  public async measurePing(peerId: string): Promise<number> {
    if (!this.room) return 0;
    try {
      const start = performance.now();
      await this.room.ping(peerId);
      return Math.round(performance.now() - start);
    } catch {
      return 0;
    }
  }

  public leaveRoom() {
    if (this.room) {
      try {
        this.room.leave();
      } catch {
        // ignore
      }
      this.room = null;
    }
    this.incomingFiles.clear();
    this.currentRoomId = '';
  }

  public getRoomId(): string {
    return this.currentRoomId;
  }
}

export const p2pEngine = new P2PEngine();
