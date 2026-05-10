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
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[480px]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-surface"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-sm flex-shrink-0 ${status === 'open' ? 'bg-severity-low' : 'bg-text-muted'}`}
          />
          <h2 className="text-sm font-semibold text-text-primary">{roomName}</h2>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-sm font-mono ${
              status === 'open' ? 'bg-severity-low/10 text-severity-low' : 'bg-bg-surface-2 text-text-muted'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm bg-bg-surface-2 text-text-secondary"
          >
            <Users size={12} />
            <span>{participants.length}</span>
          </div>
          {status === 'open' && (
            <button
              onClick={closeRoom}
              disabled={closing}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm bg-bg-surface-2 text-text-secondary transition-colors duration-[150ms] ease-out active:scale-95"
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
        className="flex items-center gap-2 px-5 py-2 border-b border-border-subtle bg-bg-base overflow-x-auto"
      >
        <span className="text-xs flex-shrink-0 text-text-muted">Participants:</span>
        {participants.map(p => (
          <span
            key={p.id}
            className={`text-xs px-2 py-0.5 rounded-sm flex-shrink-0 bg-bg-surface-2 ${
              p.id === currentUserId ? 'text-accent' : 'text-text-secondary'
            }`}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-bg-base">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertTriangle size={24} className="text-text-disabled" />
            <p className="text-sm text-text-muted">No messages yet. Start the discussion.</p>
          </div>
        )}
        {messages.map(msg => {
          const author = participantMap.get(msg.user_id);
          const isOwn = msg.user_id === currentUserId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-sm flex-shrink-0 flex items-center justify-center text-xs font-semibold text-text-primary ${
                  isOwn ? 'bg-accent' : 'bg-bg-surface-2'
                }`}
              >
                {(author?.name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {author?.name ?? 'Unknown'}
                  </span>
                  <TimeAgo
                    date={new Date(msg.created_at)}
                    className="text-xs font-mono text-text-muted"
                  />
                </div>
                <div
                  className={`text-sm px-3 py-2 rounded-md text-text-primary break-words ${isOwn ? 'bg-accent' : 'bg-bg-surface-2'}`}
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
        className="px-5 py-3 border-t border-border-subtle bg-bg-surface"
      >
        {status === 'closed' ? (
          <div
            className="flex items-center gap-2 text-sm py-2 px-3 rounded-md bg-bg-surface-2 text-text-muted"
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
              className="flex-1 resize-none text-sm px-3 py-2 rounded-md outline-none border border-border-default bg-bg-surface-3 text-text-primary transition-colors duration-[150ms] ease-out"
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              className={`flex items-center justify-center w-9 h-9 rounded-md self-end text-text-primary transition-colors duration-[150ms] ease-out active:scale-95 flex-shrink-0 ${
                draft.trim() && !sending ? 'bg-accent' : 'bg-bg-surface-2'
              }`}
            >
              <Send size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
