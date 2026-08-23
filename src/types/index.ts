export interface PeerInfo {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  ping?: number;
  isTyping?: boolean;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  blobUrl?: string;
  progress?: number;
}

export interface AudioMemoData {
  blobUrl: string;
  duration: number;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarColor: string;
  timestamp: number;
  type: 'text' | 'file' | 'audio' | 'system';
  text?: string;
  fileData?: FileMetadata;
  audioData?: AudioMemoData;
  reactions?: Record<string, string[]>; // emoji -> [peerId, ...]
  status: 'sending' | 'sent' | 'delivered';
  expiresAt?: number; // epoch ms if disappearing timer is set
}

export interface CallState {
  active: boolean;
  mode: 'video' | 'audio';
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>; // peerId -> Stream
  initiatorId?: string;
}

export type ConnectionTab = 'code' | 'qr' | 'scan' | 'mesh';
