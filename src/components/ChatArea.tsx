import React, { useEffect, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Clock, 
  Check, 
  ShieldAlert, 
  Lock, 
  Zap, 
  Copy, 
  Sparkles,
  Image as ImageIcon,
  Smile
} from 'lucide-react';
import type { ChatMessage, PeerInfo } from '../types';
import { AudioMemoPlayer } from './AudioMemoPlayer';

interface ChatAreaProps {
  messages: ChatMessage[];
  selfId: string;
  peers: PeerInfo[];
  currentRoomId: string;
  onOpenConnectModal: () => void;
  onReact: (messageId: string, emoji: string) => void;
}

const COMMON_REACTIONS = ['👍', '❤️', '🔥', '🚀', '🔒', '😂'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  selfId,
  peers,
  currentRoomId,
  onOpenConnectModal,
  onReact,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [copiedTextId, setCopiedTextId] = React.useState<string | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = React.useState<string | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyCodeSnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  // Simple safe markdown renderer for bold, code, links
  const renderFormattedText = (text: string, messageId: string) => {
    // Check for fenced code block ```code```
    if (text.startsWith('```') && text.endsWith('```')) {
      const codeContent = text.slice(3, -3).replace(/^[a-z]+\n/, '');
      return (
        <div style={{
          position: 'relative',
          background: 'rgba(4, 7, 13, 0.85)',
          borderRadius: '10px',
          padding: '12px 14px',
          margin: '6px 0',
          border: '1px solid rgba(0, 242, 254, 0.25)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => copyCodeSnippet(codeContent, messageId)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {copiedTextId === messageId ? <Check size={12} color="var(--emerald-primary)" /> : <Copy size={12} />}
            <span>{copiedTextId === messageId ? 'Copied' : 'Copy'}</span>
          </button>
          <pre style={{ margin: 0, color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {codeContent}
          </pre>
        </div>
      );
    }

    // Process inline code and formatting
    return (
      <span style={{ lineHeight: '1.5', wordBreak: 'break-word' }}>
        {text.split('\n').map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const typingPeers = peers.filter((p) => p.isTyping);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      position: 'relative'
    }}>
      {/* Welcome / Empty Room Banner */}
      {messages.length === 0 && (
        <div style={{
          margin: 'auto',
          maxWidth: '540px',
          textAlign: 'center',
          padding: '32px 24px',
          background: 'radial-gradient(circle at 50% 30%, rgba(0, 242, 254, 0.08) 0%, rgba(14, 20, 32, 0.6) 80%)',
          borderRadius: '24px',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          boxShadow: '0 0 40px rgba(0, 242, 254, 0.08)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(168,85,247,0.2) 100%)',
            border: '1px solid rgba(0,242,254,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 20px rgba(0,242,254,0.2)'
          }}>
            <Lock size={30} color="var(--cyan-primary)" />
          </div>

          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
            Zero-Knowledge P2P Room Active
          </h3>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '20px' }}>
            You are connected to room <strong style={{ color: 'var(--cyan-primary)' }}>#{currentRoomId.toUpperCase()}</strong>. 
            All chats, files, and voice notes travel directly peer-to-peer with zero central database logs.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '22px'
          }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <Zap size={16} color="var(--cyan-primary)" style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>Zero Database</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>RAM-only session</div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <ShieldAlert size={16} color="var(--emerald-primary)" style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>DTLS Encrypted</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>End-to-End P2P</div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <Sparkles size={16} color="var(--violet-primary)" style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>Unlimited Files</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Direct channel stream</div>
            </div>
          </div>

          <button className="btn-cyber-primary" onClick={onOpenConnectModal} style={{ margin: '0 auto' }}>
            <span>Invite Peers via QR or Code</span>
          </button>
        </div>
      )}

      {/* Message Stream */}
      {messages.map((msg) => {
        const isSelf = msg.senderId === selfId;
        const isImage = msg.fileData?.type.startsWith('image/');

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isSelf ? 'flex-end' : 'flex-start',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onMouseLeave={() => {
              if (activeReactionPicker === msg.id) setActiveReactionPicker(null);
            }}
          >
            {/* Sender Meta Label */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '0.73rem',
              color: 'var(--text-dim)',
              padding: '0 4px'
            }}>
              {!isSelf && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: msg.senderAvatarColor || 'var(--cyan-primary)'
                  }}
                />
              )}
              <span style={{ fontWeight: 600, color: isSelf ? 'var(--cyan-primary)' : '#e2e8f0' }}>
                {isSelf ? 'You' : msg.senderName}
              </span>
              <span>•</span>
              <span>{formatTime(msg.timestamp)}</span>
              {msg.expiresAt && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--amber-primary)' }}>
                  <Clock size={11} /> Ephemeral
                </span>
              )}
            </div>

            {/* Message Bubble Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '80%' }}>
              {/* Message Content Bubble */}
              <div
                style={{
                  background: isSelf 
                    ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.18) 0%, rgba(79, 172, 254, 0.22) 100%)' 
                    : 'rgba(20, 28, 44, 0.85)',
                  border: isSelf 
                    ? '1px solid rgba(0, 242, 254, 0.4)' 
                    : '1px solid var(--border-subtle)',
                  borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: msg.type === 'audio' ? '6px 8px' : '10px 16px',
                  color: '#ffffff',
                  boxShadow: isSelf ? '0 4px 16px rgba(0, 242, 254, 0.15)' : 'var(--shadow-sm)',
                  backdropFilter: 'blur(10px)',
                  position: 'relative'
                }}
              >
                {/* 1. Text Message */}
                {msg.type === 'text' && msg.text && renderFormattedText(msg.text, msg.id)}

                {/* 2. File Attachment */}
                {msg.type === 'file' && msg.fileData && (
                  <div>
                    {isImage && msg.fileData.blobUrl ? (
                      <div style={{ marginBottom: '8px' }}>
                        <img
                          src={msg.fileData.blobUrl}
                          alt={msg.fileData.name}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '12px',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                        />
                      </div>
                    ) : null}

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(0, 242, 254, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isImage ? <ImageIcon size={18} color="var(--cyan-primary)" /> : <FileText size={18} color="var(--cyan-primary)" />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.fileData.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                          {formatFileSize(msg.fileData.size)} • P2P Direct
                        </div>
                      </div>

                      {msg.fileData.blobUrl && (
                        <a
                          href={msg.fileData.blobUrl}
                          download={msg.fileData.name}
                          className="btn-cyber-icon"
                          style={{ width: '32px', height: '32px' }}
                          title="Download File"
                        >
                          <Download size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Audio Voice Memo */}
                {msg.type === 'audio' && msg.audioData && (
                  <AudioMemoPlayer audioData={msg.audioData} isSelf={isSelf} />
                )}
              </div>

              {/* Reaction Trigger Button (Hover) */}
              <button
                onClick={() => setActiveReactionPicker(activeReactionPicker === msg.id ? null : msg.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  opacity: 0.6,
                  transition: 'opacity 0.2s'
                }}
                title="React"
              >
                <Smile size={14} />
              </button>
            </div>

            {/* Quick Emoji Reaction Drawer */}
            {activeReactionPicker === msg.id && (
              <div style={{
                marginTop: '4px',
                background: 'rgba(12, 17, 28, 0.95)',
                border: '1px solid var(--border-glow)',
                borderRadius: '999px',
                padding: '4px 8px',
                display: 'flex',
                gap: '6px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 5
              }}>
                {COMMON_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(msg.id, emoji);
                      setActiveReactionPicker(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: '2px 4px',
                      transition: 'transform 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Reaction Badges Display */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                  <div
                    key={emoji}
                    onClick={() => onReact(msg.id, emoji)}
                    style={{
                      background: userIds.includes(selfId) ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: userIds.includes(selfId) ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{emoji}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {userIds.length}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Typing Indicator */}
      {typingPeers.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(0, 242, 254, 0.06)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '999px',
          width: 'fit-content',
          fontSize: '0.75rem',
          color: 'var(--cyan-primary)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            <span className="status-pulse-cyan" style={{ width: '5px', height: '5px' }} />
            <span className="status-pulse-cyan" style={{ width: '5px', height: '5px', animationDelay: '0.2s' }} />
            <span className="status-pulse-cyan" style={{ width: '5px', height: '5px', animationDelay: '0.4s' }} />
          </div>
          <span>
            {typingPeers.map((p) => p.name).join(', ')} {typingPeers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
