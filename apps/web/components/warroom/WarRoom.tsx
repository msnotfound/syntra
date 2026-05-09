'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface Message {
  id: string;
  war_room_id: string;
  user_id: string;
  body: string;
  attachments: string[];
  created_at: Date | string;
}

interface WarRoomProps {
  roomId: string;
  roomName: string;
  status: 'open' | 'closed';
  orgSlug: string;
  initialMessages: Message[];
  participants: Participant[];
  currentUserId: string;
}

export function WarRoom({
  roomId,
  roomName,
  status: initialStatus,
  orgSlug,
  initialMessages,
  participants: initialParticipants,
  currentUserId,
}: WarRoomProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [participants] = useState<Participant[]>(initialParticipants);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SSE connection
  useEffect(() => {
    if (status === 'closed') return;

    const es = new EventSource(`/api/v1/war-rooms/${roomId}/stream`);

    es.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data) as Message;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    es.onerror = () => {
      // Browser auto-reconnects
    };

    return () => es.close();
  }, [roomId, status]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || status === 'closed') return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/war-rooms/${roomId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg = data.data as Message;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setDraft('');
        textareaRef.current?.focus();
      }
    } finally {
      setSending(false);
    }
  }, [draft, roomId, sending, status]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const closeRoom = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/war-rooms/${roomId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'closed' }),
      });
      if (res.ok) setStatus('closed');
    } finally {
      setClosing(false);
    }
  };

  const participantMap = new Map(participants.map(p => [p.id, p]));

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: '#1E2530', backgroundColor: '#151921' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: status === 'open' ? '#22C55E' : '#64748B' }}
          />
          <h2 className="text-sm font-semibold" style={{ color: '#FAFAFA' }}>{roomName}</h2>
          <span
            className="text-xs px-1.5 py-0.5 rounded-sm font-mono"
            style={{
              backgroundColor: status === 'open' ? 'rgba(34,197,94,0.1)' : '#1E2530',
              color: status === 'open' ? '#22C55E' : '#64748B',
              borderRadius: '4px',
            }}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm"
            style={{ backgroundColor: '#1E2530', color: '#94A3B8', borderRadius: '4px' }}
          >
            <Users size={12} />
            <span>{participants.length}</span>
          </div>
          {status === 'open' && (
            <button
              onClick={closeRoom}
              disabled={closing}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm transition-colors"
              style={{
                backgroundColor: '#1E2530',
                color: '#94A3B8',
                borderRadius: '4px',
                transitionDuration: '150ms',
              }}
              title="Close war room"
            >
              <X size={12} />
              Close
            </button>
          )}
        </div>
      </div>

      {/* Participant list */}
      <div
        className="flex items-center gap-2 px-5 py-2 border-b overflow-x-auto"
        style={{ borderColor: '#1E2530', backgroundColor: '#0B0E14' }}
      >
        <span className="text-xs flex-shrink-0" style={{ color: '#64748B' }}>Participants:</span>
        {participants.map(p => (
          <span
            key={p.id}
            className="text-xs px-2 py-0.5 rounded-sm flex-shrink-0"
            style={{
              backgroundColor: '#1E2530',
              color: p.id === currentUserId ? '#3B82F6' : '#94A3B8',
              borderRadius: '4px',
            }}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ backgroundColor: '#0B0E14' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertTriangle size={24} style={{ color: '#475569' }} />
            <p className="text-sm" style={{ color: '#64748B' }}>No messages yet. Start the discussion.</p>
          </div>
        )}
        {messages.map(msg => {
          const author = participantMap.get(msg.user_id);
          const isOwn = msg.user_id === currentUserId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className="w-7 h-7 rounded-sm flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                style={{
                  backgroundColor: isOwn ? '#1D4ED8' : '#1E2530',
                  color: '#FAFAFA',
                  borderRadius: '4px',
                }}
              >
                {(author?.name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                    {author?.name ?? 'Unknown'}
                  </span>
                  <TimeAgo
                    date={new Date(msg.created_at)}
                    className="text-xs font-mono text-text-muted"
                  />
                </div>
                <div
                  className="text-sm px-3 py-2 rounded-md"
                  style={{
                    backgroundColor: isOwn ? '#1D4ED8' : '#1E2530',
                    color: '#FAFAFA',
                    borderRadius: '6px',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: '#1E2530', backgroundColor: '#151921' }}
      >
        {status === 'closed' ? (
          <div
            className="flex items-center gap-2 text-sm py-2 px-3 rounded-md"
            style={{ backgroundColor: '#1E2530', color: '#64748B', borderRadius: '6px' }}
          >
            <CheckCircle size={14} />
            <span>War room closed — read-only</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              className="flex-1 resize-none text-sm px-3 py-2 rounded-md outline-none transition-colors"
              style={{
                backgroundColor: '#262C36',
                color: '#FAFAFA',
                borderRadius: '6px',
                border: '1px solid #262C36',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              className="flex items-center justify-center w-9 h-9 rounded-md self-end transition-all active:scale-95"
              style={{
                backgroundColor: draft.trim() && !sending ? '#3B82F6' : '#1E2530',
                color: '#FAFAFA',
                borderRadius: '6px',
                transitionDuration: '150ms',
                flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
