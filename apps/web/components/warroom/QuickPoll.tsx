'use client';

import { useState } from 'react';
import { BarChart2, Send } from 'lucide-react';

interface PollVote {
  user_id: string;
  vote: 'yes' | 'no' | 'abstain';
}

interface Poll {
  question: string;
  votes: PollVote[];
}

interface Message {
  id: string;
  msg_type: string;
  body: string;
  poll?: Poll | null;
  user_id: string;
  created_at: Date | string;
}

interface QuickPollProps {
  roomId: string;
  currentUserId: string;
  onPollCreated: (msg: Message) => void;
  isOpen: boolean;
}

export function QuickPoll({ roomId, currentUserId, onPollCreated, isOpen }: QuickPollProps) {
  const [question, setQuestion] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!question.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/war-rooms/${roomId}/polls`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: question.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onPollCreated(data.data as Message);
        setQuestion('');
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm bg-bg-surface-2 text-text-secondary transition-colors duration-[150ms] ease-out hover:text-text-primary self-start"
        title="Create a quick poll"
      >
        <BarChart2 size={11} />
        Poll
      </button>
      {open && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Poll question…"
            className="flex-1 text-sm px-2.5 py-1.5 rounded-sm border border-border-default bg-bg-surface-3 text-text-primary outline-none"
          />
          <button
            onClick={submit}
            disabled={!question.trim() || submitting}
            className="flex items-center justify-center w-8 h-8 rounded-sm bg-accent text-text-primary disabled:opacity-50 active:scale-95 transition-transform duration-[150ms] ease-out"
          >
            <Send size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

interface PollMessageProps {
  roomId: string;
  message: Message;
  currentUserId: string;
}

export function PollMessage({ roomId, message, currentUserId }: PollMessageProps) {
  const [poll, setPoll] = useState<Poll>(message.poll ?? { question: message.body, votes: [] });
  const [userVote, setUserVote] = useState<'yes' | 'no' | 'abstain' | null>(
    () => poll.votes.find(v => v.user_id === currentUserId)?.vote ?? null,
  );
  const [voting, setVoting] = useState(false);

  const vote = async (v: 'yes' | 'no' | 'abstain') => {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/v1/war-rooms/${roomId}/polls/${message.id}/vote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vote: v }),
      });
      if (res.ok) {
        const data = await res.json();
        const { yes, no, abstain } = data.data as { yes: number; no: number; abstain: number };
        const newVotes: PollVote[] = [];
        for (let i = 0; i < yes; i++) newVotes.push({ user_id: `yes-${i}`, vote: 'yes' });
        for (let i = 0; i < no; i++) newVotes.push({ user_id: `no-${i}`, vote: 'no' });
        for (let i = 0; i < abstain; i++) newVotes.push({ user_id: `abs-${i}`, vote: 'abstain' });
        setPoll(prev => ({ ...prev, votes: newVotes }));
        setUserVote(v);
      }
    } finally {
      setVoting(false);
    }
  };

  const total = poll.votes.length;
  const tally = { yes: 0, no: 0, abstain: 0 };
  for (const v of poll.votes) tally[v.vote]++;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2.5 max-w-xs space-y-2">
      <div className="flex items-center gap-1.5">
        <BarChart2 size={11} className="text-text-muted flex-shrink-0" />
        <p className="text-sm font-medium text-text-primary">{poll.question}</p>
      </div>

      <div className="space-y-1.5">
        {(['yes', 'no', 'abstain'] as const).map(opt => {
          const count = tally[opt];
          const p = pct(count);
          const isVoted = userVote === opt;
          return (
            <button
              key={opt}
              onClick={() => vote(opt)}
              disabled={voting}
              className={`w-full flex items-center gap-2 text-xs rounded-sm px-2 py-1.5 text-left transition-colors duration-[150ms] ease-out ${
                isVoted ? 'bg-accent/20 text-accent' : 'bg-bg-surface-2 text-text-secondary hover:bg-bg-surface-3'
              }`}
            >
              <span className="w-12 capitalize font-medium">{opt}</span>
              <div className="flex-1 h-1 rounded-full bg-bg-surface-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    opt === 'yes' ? 'bg-severity-low' : opt === 'no' ? 'bg-severity-critical' : 'bg-text-muted'
                  }`}
                  style={{ width: `${p}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-text-muted">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">{total} {total === 1 ? 'vote' : 'votes'}</p>
    </div>
  );
}
