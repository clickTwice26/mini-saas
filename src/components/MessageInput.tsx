import React, { useState, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Smile, 
  Clock, 
  X
} from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string, expiresAt?: number) => void;
  onSendFile: (file: File) => void;
  onSendAudioMemo: (blob: Blob, duration: number) => void;
  onTyping: (isTyping: boolean) => void;
}

const EMOJI_LIST = ['⚡', '🔥', '🚀', '🔒', '💻', '✨', '👋', '😎', '🎉', '💡', '🤖', '🛡️', '❤️', '👍', '🛸', '🎯'];

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onSendAudioMemo,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [ephemeralTimer, setEphemeralTimer] = useState<number | null>(null); // seconds or null
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Handle typing debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    const expiresAt = ephemeralTimer ? Date.now() + ephemeralTimer * 1000 : undefined;
    onSendMessage(text.trim(), expiresAt);
    setText('');
    onTyping(false);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      e.target.value = '';
    }
  };

  // Voice Memo Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingDuration > 0 && audioChunksRef.current.length > 0) {
          onSendAudioMemo(audioBlob, recordingDuration);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone for voice note:', err);
      alert('Could not access microphone. Please verify browser permissions.');
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    if (!shouldSend) {
      audioChunksRef.current = [];
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{
      padding: '12px 20px 16px',
      background: 'rgba(8, 12, 20, 0.85)',
      borderTop: '1px solid var(--border-subtle)',
      position: 'relative'
    }}>
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div style={{
          position: 'absolute',
          bottom: '75px',
          left: '20px',
          background: 'rgba(12, 17, 28, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-glow)',
          borderRadius: '16px',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '8px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 20
        }}>
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '8px',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Disappearing Timer Menu */}
      {showTimerMenu && (
        <div style={{
          position: 'absolute',
          bottom: '75px',
          left: '70px',
          background: 'rgba(12, 17, 28, 0.95)',
          border: '1px solid var(--border-glow)',
          borderRadius: '14px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 20,
          minWidth: '150px'
        }}>
          {[
            { label: 'Off (Permanent)', val: null },
            { label: '10 Seconds', val: 10 },
            { label: '30 Seconds', val: 30 },
            { label: '5 Minutes', val: 300 },
            { label: '1 Hour', val: 3600 }
          ].map((item) => (
            <button
              key={String(item.val)}
              onClick={() => {
                setEphemeralTimer(item.val);
                setShowTimerMenu(false);
              }}
              style={{
                background: ephemeralTimer === item.val ? 'var(--bg-glass-active)' : 'transparent',
                border: 'none',
                color: ephemeralTimer === item.val ? 'var(--cyan-primary)' : 'var(--text-main)',
                padding: '6px 10px',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Container Box */}
      <div 
        className="glass-panel" 
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          padding: '8px 14px',
          borderRadius: '16px',
          background: 'rgba(14, 20, 32, 0.75)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* If Voice Recording is Active */}
        {isRecording ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '4px 8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--rose-primary)',
                animation: 'pulseGlow 1s infinite alternate'
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#ffffff', fontWeight: 700 }}>
                {formatRecordingTime(recordingDuration)}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Recording P2P Audio Memo...
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-cyber-secondary"
                onClick={() => stopRecording(false)}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <X size={14} /> Cancel
              </button>
              <button
                className="btn-cyber-primary"
                onClick={() => stopRecording(true)}
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                <Send size={14} /> Send Voice
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Action Tools Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '4px' }}>
              {/* Attachment File Trigger */}
              <button
                className="btn-cyber-icon"
                onClick={() => fileInputRef.current?.click()}
                title="Send File Peer-to-Peer (Any size)"
                style={{ width: '34px', height: '34px' }}
              >
                <Paperclip size={17} />
              </button>

              {/* Emoji Trigger */}
              <button
                className="btn-cyber-icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emojis"
                style={{ width: '34px', height: '34px' }}
              >
                <Smile size={17} />
              </button>

              {/* Disappearing Messages Timer Trigger */}
              <button
                className="btn-cyber-icon"
                onClick={() => setShowTimerMenu(!showTimerMenu)}
                title={ephemeralTimer ? `Self-destruct: ${ephemeralTimer}s` : "Set Ephemeral Self-Destruct Timer"}
                style={{
                  width: '34px',
                  height: '34px',
                  color: ephemeralTimer ? 'var(--amber-primary)' : undefined,
                  borderColor: ephemeralTimer ? 'var(--amber-primary)' : undefined
                }}
              >
                <Clock size={17} />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Type encrypted message (supports **bold**, `code`, ```snippets```)..."
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontFamily: 'var(--font-primary)',
                fontSize: '0.9rem',
                resize: 'none',
                maxHeight: '120px',
                padding: '8px 0',
                lineHeight: '1.4'
              }}
            />

            {/* Right Action Tools (Mic + Send) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '4px' }}>
              {/* Voice Memo Button */}
              <button
                className="btn-cyber-icon"
                onClick={startRecording}
                title="Record P2P Voice Memo"
                style={{ width: '34px', height: '34px' }}
              >
                <Mic size={17} />
              </button>

              {/* Send Button */}
              <button
                className="btn-cyber-primary"
                onClick={handleSend}
                disabled={!text.trim()}
                style={{
                  padding: '8px 14px',
                  opacity: text.trim() ? 1 : 0.5,
                  cursor: text.trim() ? 'pointer' : 'default'
                }}
                title="Send Message (Enter)"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Subtext info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '6px',
        padding: '0 4px',
        fontSize: '0.7rem',
        color: 'var(--text-dim)'
      }}>
        <span>Direct WebRTC DataChannel • No servers in transit</span>
        {ephemeralTimer && (
          <span style={{ color: 'var(--amber-primary)', fontWeight: 600 }}>
            🔥 Self-destruct active ({ephemeralTimer}s)
          </span>
        )}
      </div>
    </div>
  );
};
