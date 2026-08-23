import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Avatar,
  Popover,
  alpha,
  useTheme
} from '@mui/material';
import {
  LockIcon,
  Copy01Icon,
  CheckmarkBadge01Icon,
  Download01Icon,
  File01Icon,
  Image01Icon,
  Clock01Icon,
  QrCodeIcon,
  SparklesIcon,
  SmileIcon,
  ThumbsUpIcon,
  FavouriteIcon,
  FireIcon,
  Rocket01Icon,
  StarIcon,
  UserGroupIcon
} from 'hugeicons-react';
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

interface ReactionDef {
  key: string;
  label: string;
  renderIcon: (size?: number, color?: string) => React.ReactNode;
}

const HUGE_REACTIONS: ReactionDef[] = [
  { key: 'thumb', label: 'Like', renderIcon: (s = 15, c) => <ThumbsUpIcon size={s} color={c} /> },
  { key: 'heart', label: 'Love', renderIcon: (s = 15, c) => <FavouriteIcon size={s} color={c} /> },
  { key: 'fire', label: 'Fire', renderIcon: (s = 15, c) => <FireIcon size={s} color={c} /> },
  { key: 'rocket', label: 'Rocket', renderIcon: (s = 15, c) => <Rocket01Icon size={s} color={c} /> },
  { key: 'star', label: 'Star', renderIcon: (s = 15, c) => <StarIcon size={s} color={c} /> },
  { key: 'lock', label: 'Secure', renderIcon: (s = 15, c) => <LockIcon size={s} color={c} /> }
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  selfId,
  peers,
  currentRoomId,
  onOpenConnectModal,
  onReact,
}) => {
  const theme = useTheme();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<{ el: HTMLElement; messageId: string } | null>(null);

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

  const renderFormattedText = (text: string, messageId: string) => {
    if (text.startsWith('```') && text.endsWith('```')) {
      const codeContent = text.slice(3, -3).replace(/^[a-z]+\n/, '');
      return (
        <Box
          sx={{
            position: 'relative',
            backgroundColor: alpha('#020617', 0.8),
            borderRadius: '6px',
            p: 1.5,
            my: 0.5,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            overflowX: 'auto'
          }}
        >
          <IconButton
            size="small"
            onClick={() => copyCodeSnippet(codeContent, messageId)}
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              backgroundColor: alpha('#ffffff', 0.1),
              borderRadius: '4px',
              p: 0.5
            }}
          >
            {copiedTextId === messageId ? <CheckmarkBadge01Icon size={14} color={theme.palette.success.main} /> : <Copy01Icon size={14} />}
          </IconButton>
          <pre style={{ margin: 0, color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {codeContent}
          </pre>
        </Box>
      );
    }

    return (
      <Typography variant="body2" sx={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
        {text.split('\n').map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </Typography>
    );
  };

  const typingPeers = peers.filter((p) => p.isTyping);
  const isRoomFull = peers.length >= 1;

  const getReactionIcon = (reactionKey: string) => {
    const found = HUGE_REACTIONS.find((r) => r.key === reactionKey);
    if (found) return found.renderIcon(13);
    return <SparklesIcon size={13} />;
  };

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        p: { xs: 1.5, sm: 2 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}
    >
      {/* Subtle Connection Status Strip (Only when messages exist or peer joins) */}
      {messages.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 0.6,
            borderRadius: '6px',
            backgroundColor: isRoomFull ? alpha(theme.palette.success.main, 0.06) : alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${isRoomFull ? alpha(theme.palette.success.main, 0.2) : theme.palette.divider}`
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isRoomFull ? theme.palette.success.main : theme.palette.primary.main
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: isRoomFull ? theme.palette.success.light : theme.palette.text.secondary }}>
              {isRoomFull ? 'Connected with peer' : 'Waiting for peer to connect'}
            </Typography>
          </Box>

          {!isRoomFull && (
            <Button
              size="small"
              variant="text"
              color="primary"
              onClick={onOpenConnectModal}
              sx={{ py: 0.1, px: 1, fontSize: '0.72rem', height: 22 }}
            >
              Invite
            </Button>
          )}
        </Box>
      )}

      {/* Clean Minimalist Empty State (No marketing fluff, pure functional) */}
      {messages.length === 0 && (
        <Box
          sx={{
            m: 'auto',
            maxWidth: 380,
            textAlign: 'center',
            p: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.5),
            borderRadius: '10px',
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <Avatar
            sx={{
              width: 44,
              height: 44,
              m: '0 auto 12px',
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              borderRadius: '8px'
            }}
          >
            {isRoomFull ? <UserGroupIcon size={22} /> : <LockIcon size={22} />}
          </Avatar>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Room #{currentRoomId.toUpperCase()}
          </Typography>

          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2.5, fontSize: '0.82rem' }}>
            {isRoomFull
              ? 'Connected with peer. Send a message to start chatting.'
              : 'Share the invite link or QR code with another person to connect.'}
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<QrCodeIcon size={16} />}
            onClick={onOpenConnectModal}
            sx={{ px: 2, py: 0.8, borderRadius: '6px' }}
          >
            Invite via QR or Link
          </Button>
        </Box>
      )}

      {/* Message List */}
      {messages.map((msg) => {
        const isSelf = msg.senderId === selfId;
        const isImage = msg.fileData?.type.startsWith('image/');

        return (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isSelf ? 'flex-end' : 'flex-start',
              position: 'relative'
            }}
          >
            {/* Sender Meta Label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.4, px: 0.5 }}>
              {!isSelf && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: msg.senderAvatarColor || theme.palette.primary.main
                  }}
                />
              )}
              <Typography variant="caption" sx={{ fontWeight: 600, color: isSelf ? theme.palette.primary.main : theme.palette.text.primary, fontSize: '0.72rem' }}>
                {isSelf ? 'You' : msg.senderName}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem' }}>•</Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem' }}>
                {formatTime(msg.timestamp)}
              </Typography>
              {msg.expiresAt && (
                <Chip
                  icon={<Clock01Icon size={11} color={theme.palette.warning.main} />}
                  label="Expires"
                  size="small"
                  sx={{
                    height: 18,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    backgroundColor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.light
                  }}
                />
              )}
            </Box>

            {/* Bubble & Reaction Button */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, maxWidth: '82%' }}>
              <Box
                sx={{
                  backgroundColor: isSelf
                    ? alpha(theme.palette.primary.main, 0.18)
                    : alpha(theme.palette.background.paper, 0.85),
                  border: `1px solid ${isSelf ? alpha(theme.palette.primary.main, 0.35) : theme.palette.divider}`,
                  borderRadius: isSelf ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                  p: msg.type === 'audio' ? 0.6 : '8px 14px',
                  color: '#ffffff',
                  boxShadow: isSelf ? `0 2px 10px ${alpha(theme.palette.primary.main, 0.12)}` : 'none',
                  backdropFilter: 'blur(8px)'
                }}
              >
                {/* 1. Text Message */}
                {msg.type === 'text' && msg.text && renderFormattedText(msg.text, msg.id)}

                {/* 2. File Attachment */}
                {msg.type === 'file' && msg.fileData && (
                  <Box>
                    {isImage && msg.fileData.blobUrl ? (
                      <Box sx={{ mb: 1 }}>
                        <img
                          src={msg.fileData.blobUrl}
                          alt={msg.fileData.name}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '300px',
                            borderRadius: '6px',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                        />
                      </Box>
                    ) : null}

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.2,
                        backgroundColor: alpha('#000000', 0.3),
                        p: 1,
                        borderRadius: '6px',
                        border: `1px solid ${alpha('#ffffff', 0.1)}`
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '6px',
                          backgroundColor: alpha(theme.palette.primary.main, 0.15),
                          color: theme.palette.primary.main
                        }}
                      >
                        {isImage ? <Image01Icon size={16} /> : <File01Icon size={16} />}
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.fileData.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                          {formatFileSize(msg.fileData.size)}
                        </Typography>
                      </Box>

                      {msg.fileData.blobUrl && (
                        <IconButton
                          component="a"
                          href={msg.fileData.blobUrl}
                          download={msg.fileData.name}
                          size="small"
                          sx={{ borderRadius: '6px' }}
                        >
                          <Download01Icon size={16} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                )}

                {/* 3. Voice Memo */}
                {msg.type === 'audio' && msg.audioData && (
                  <AudioMemoPlayer audioData={msg.audioData} isSelf={isSelf} />
                )}
              </Box>

              {/* Reaction Trigger */}
              <IconButton
                size="small"
                onClick={(e) => setReactionAnchor({ el: e.currentTarget, messageId: msg.id })}
                sx={{
                  opacity: 0.6,
                  borderRadius: '6px',
                  '&:hover': { opacity: 1 },
                  p: 0.4
                }}
              >
                <SmileIcon size={15} />
              </IconButton>
            </Box>

            {/* Reaction Badges */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.4, mt: 0.4 }}>
                {Object.entries(msg.reactions).map(([reactionKey, userIds]) => (
                  <Chip
                    key={reactionKey}
                    icon={getReactionIcon(reactionKey) as React.ReactElement}
                    label={userIds.length}
                    size="small"
                    onClick={() => onReact(msg.id, reactionKey)}
                    sx={{
                      height: 22,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      backgroundColor: userIds.includes(selfId) ? alpha(theme.palette.primary.main, 0.15) : alpha('#ffffff', 0.05),
                      border: `1px solid ${userIds.includes(selfId) ? alpha(theme.palette.primary.main, 0.4) : theme.palette.divider}`,
                      cursor: 'pointer',
                      px: 0.5
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        );
      })}

      {/* Typing Indicator */}
      {typingPeers.length > 0 && (
        <Chip
          icon={<SparklesIcon size={13} color={theme.palette.primary.main} />}
          label={`${typingPeers.map((p) => p.name).join(', ')} is typing...`}
          size="small"
          sx={{
            width: 'fit-content',
            borderRadius: '6px',
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            color: theme.palette.primary.main,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`
          }}
        />
      )}

      {/* Quick Reaction Popover */}
      <Popover
        open={Boolean(reactionAnchor)}
        anchorEl={reactionAnchor?.el}
        onClose={() => setReactionAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              p: 0.5,
              borderRadius: '8px',
              backgroundColor: alpha(theme.palette.background.paper, 0.96),
              backdropFilter: 'blur(12px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.4 }}>
          {HUGE_REACTIONS.map((item) => (
            <IconButton
              key={item.key}
              size="small"
              onClick={() => {
                if (reactionAnchor) {
                  onReact(reactionAnchor.messageId, item.key);
                  setReactionAnchor(null);
                }
              }}
              sx={{
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                p: 0.8,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  color: theme.palette.primary.main
                }
              }}
            >
              {item.renderIcon(18)}
            </IconButton>
          ))}
        </Box>
      </Popover>

      <div ref={bottomRef} />
    </Box>
  );
};
