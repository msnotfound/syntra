'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { X, MessageSquare, Trash2 } from 'lucide-react';
import { colors, typography, radii, transitions } from '@syntra/ui/tokens';
import { Provenance } from '@/components/intel/Provenance';
import type { ProvenanceClaim } from '@/components/intel/ProvenanceTrail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Shape returned by GET /api/v1/assistant/threads — already mapped from IIntelClaim
interface ApiClaim {
  claim_id: string;
  claim_text: string;
  claim_type: 'fact' | 'inference' | 'forecast';
  evidence_url: string | null;
  asserted_at: string;
  source: null;
  parent_claim_ids: string[];
  depth: number;
}

interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  cited_claim_ids: string[];
  created_at: string;
  claims?: ApiClaim[];
}

interface AssistantDrawerProps {
  orgSlug: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function generateConversationId(): string {
  return 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function extractEntityIdsFromPath(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  // Capture MongoDB ObjectId (24 hex chars) or simple UUID-like IDs
  if (last && /^[a-f0-9]{24}$/i.test(last)) return [last];
  return [];
}

// Parse SSE lines into { event, data } pairs
function parseSseLine(line: string): { event?: string; data?: string } | null {
  if (line.startsWith('event: ')) return { event: line.slice(7).trim() };
  if (line.startsWith('data: ')) return { data: line.slice(6).trim() };
  return null;
}

// ---------------------------------------------------------------------------
// Simple markdown renderer with claim citation support
// ---------------------------------------------------------------------------

function renderMarkdownWithClaims(
  text: string,
  claimsById: Map<string, ProvenanceClaim>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    if (line.trim() === '') {
      nodes.push(<br key={`br-${lineIdx}`} />);
      return;
    }

    const isListItem = line.match(/^[-*]\s+(.+)/);
    const content = isListItem ? isListItem[1] : line;
    const prefix = isListItem ? '· ' : '';

    // Inline spans: split on citation markers [claim:xxx], **bold**, *italic*
    const inlineNodes = parseInline(content, claimsById, lineIdx);

    nodes.push(
      <span key={`line-${lineIdx}`} style={{ display: 'block', marginBottom: isListItem ? 2 : 0 }}>
        {prefix && (
          <span style={{ color: colors.text.muted, marginRight: 4 }}>{prefix}</span>
        )}
        {inlineNodes}
      </span>,
    );
  });

  return nodes;
}

function parseInline(
  text: string,
  claimsById: Map<string, ProvenanceClaim>,
  lineIdx: number,
): ReactNode[] {
  // Pattern: citations [claim:xxx], bold **x**, italic *x*
  const parts: ReactNode[] = [];
  const re = /\[claim:([a-zA-Z0-9_-]+)\]|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`t-${lineIdx}-${idx++}`}>{text.slice(last, match.index)}</span>);
    }

    if (match[1] !== undefined) {
      // Citation
      const claimId = match[1];
      const claim = claimsById.get(claimId);
      parts.push(
        claim ? (
          <Provenance key={`claim-${lineIdx}-${idx++}`} claims={[claim]} context={claim.claim_text}>
            <span style={{ color: colors.accent.DEFAULT, fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs }}>
              [{claimId.slice(0, 8)}]
            </span>
          </Provenance>
        ) : (
          <span
            key={`claim-${lineIdx}-${idx++}`}
            title={`claim:${claimId}`}
            style={{ color: colors.text.muted, fontFamily: typography.fonts.mono, fontSize: typography.sizes.xs }}
          >
            [{claimId.slice(0, 8)}]
          </span>
        ),
      );
    } else if (match[2] !== undefined) {
      parts.push(
        <strong key={`b-${lineIdx}-${idx++}`} style={{ fontWeight: typography.weights.semibold, color: colors.text.primary }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      parts.push(
        <em key={`i-${lineIdx}-${idx++}`} style={{ fontStyle: 'italic', color: colors.text.secondary }}>
          {match[3]}
        </em>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<span key={`t-end-${lineIdx}-${idx}`}>{text.slice(last)}</span>);
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TurnBubble({
  turn,
  claimsById,
}: {
  turn: AssistantTurn;
  claimsById: Map<string, ProvenanceClaim>;
}) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '90%',
          padding: '8px 12px',
          borderRadius: radii.md,
          border: `1px solid ${isUser ? colors.border.strong : colors.border.subtle}`,
          backgroundColor: isUser ? colors.bg.surface2 : colors.bg.surface,
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          turn.text
        ) : (
          renderMarkdownWithClaims(turn.text, claimsById)
        )}
      </div>
      <span
        style={{
          marginTop: 3,
          fontSize: typography.sizes.xs,
          color: colors.text.muted,
          fontFamily: typography.fonts.mono,
        }}
      >
        {isUser ? 'you' : 'syntra ai'} ·{' '}
        {new Date(turn.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 16 }}>
      <div
        style={{
          display: 'inline-block',
          maxWidth: '90%',
          padding: '8px 12px',
          borderRadius: radii.md,
          border: `1px solid ${colors.border.subtle}`,
          backgroundColor: colors.bg.surface,
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {text || (
          <span style={{ color: colors.text.muted, fontFamily: typography.fonts.mono }}>
            thinking…
          </span>
        )}
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 12,
            backgroundColor: colors.accent.DEFAULT,
            marginLeft: 2,
            verticalAlign: 'middle',
            animation: 'syntra-blink 1s step-end infinite',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export function AssistantDrawer({ orgSlug }: AssistantDrawerProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [conversationId, setConversationId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Build a map of claim ID → ProvenanceClaim for rendering
  const claimsById = new Map<string, ProvenanceClaim>();
  for (const turn of turns) {
    if (turn.claims) {
      for (const c of turn.claims) {
        claimsById.set(c.claim_id, {
          claim_id:        c.claim_id,
          claim_text:      c.claim_text,
          claim_type:      c.claim_type,
          evidence_url:    c.evidence_url,
          asserted_at:     c.asserted_at,
          source:          null,
          parent_claim_ids: c.parent_claim_ids,
          depth:           c.depth,
        });
      }
    }
  }

  const entityIds = extractEntityIdsFromPath(pathname ?? '');

  // ---------------------------------------------------------------------------
  // Init: load or create conversationId, then hydrate if it exists in DB
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(`syntra_assistant_conv_${orgSlug}`);
    const id = stored ?? generateConversationId();
    if (!stored) localStorage.setItem(`syntra_assistant_conv_${orgSlug}`, id);
    setConversationId(id);

    if (stored) {
      fetch(`/api/v1/assistant/threads?conversation_id=${encodeURIComponent(stored)}`)
        .then(r => r.json())
        .then((json: { data: { turns: AssistantTurn[] } | null }) => {
          if (json.data?.turns?.length) setTurns(json.data.turns as AssistantTurn[]);
        })
        .catch(() => null);
    }
  }, [orgSlug]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Listen for the "Ask" button click from TopBar
  useEffect(() => {
    const handler = () => setOpen(o => !o);
    window.addEventListener('assistant:toggle', handler);
    return () => window.removeEventListener('assistant:toggle', handler);
  }, []);

  // Auto-scroll to bottom when turns or streaming text changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, streamingText]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || loading || !conversationId) return;

    setInput('');
    setErrorMsg(null);
    setLoading(true);
    setStreamingText('');

    // Optimistically add user turn
    const optimisticUser: AssistantTurn = {
      role: 'user',
      text: prompt,
      cited_claim_ids: [],
      created_at: new Date().toISOString(),
    };
    setTurns(prev => [...prev, optimisticUser]);

    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    try {
      const res = await fetch('/api/v1/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          prompt,
          context: { page: pathname ?? '/', entity_ids: entityIds },
        }),
        signal: abortCtrl.signal,
      });

      if (!res.ok) {
        let errMsg = 'Something went wrong. Please try again.';
        try {
          const errJson = (await res.json()) as { error?: { message?: string } };
          errMsg = errJson.error?.message ?? errMsg;
        } catch { /* ignore */ }
        setErrorMsg(errMsg);
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let currentEvent: string | undefined;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const parsed = parseSseLine(line);
          if (!parsed) continue;
          if (parsed.event) {
            currentEvent = parsed.event;
          } else if (parsed.data) {
            if (currentEvent === 'token') {
              const payload = JSON.parse(parsed.data) as { text: string };
              accumulated += payload.text;
              setStreamingText(accumulated);
            } else if (currentEvent === 'done') {
              const payload = JSON.parse(parsed.data) as {
                conversation_id: string;
                cited_claim_ids: string[];
              };
              const assistantTurn: AssistantTurn = {
                role: 'assistant',
                text: accumulated,
                cited_claim_ids: payload.cited_claim_ids,
                created_at: new Date().toISOString(),
              };
              setTurns(prev => [...prev, assistantTurn]);
              setStreamingText('');
            } else if (currentEvent === 'error') {
              const payload = JSON.parse(parsed.data) as { message: string };
              setErrorMsg(payload.message);
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setErrorMsg('Connection lost. Please try again.');
      }
    } finally {
      setLoading(false);
      setStreamingText('');
      abortRef.current = null;
    }
  }, [input, loading, conversationId, pathname, entityIds]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearThread = () => {
    if (loading) abortRef.current?.abort();
    const newId = generateConversationId();
    localStorage.setItem(`syntra_assistant_conv_${orgSlug}`, newId);
    setConversationId(newId);
    setTurns([]);
    setStreamingText('');
    setErrorMsg(null);
    setLoading(false);
    setInput('');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const contextLabel = entityIds.length > 0
    ? `${pathname} (${entityIds.length} entit${entityIds.length > 1 ? 'ies' : 'y'})`
    : (pathname ?? '/');

  return (
    <>
      {/* Blink cursor keyframe */}
      <style>{`@keyframes syntra-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }`}</style>

      {/* Backdrop — click to close */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Drawer panel */}
      <aside
        role="complementary"
        aria-label="AI assistant"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.bg.surface,
          borderLeft: `1px solid ${colors.border.default}`,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform ${transitions.poised}`,
          willChange: 'transform',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 48,
            paddingInline: 16,
            borderBottom: `1px solid ${colors.border.subtle}`,
            flexShrink: 0,
          }}
        >
          <MessageSquare size={14} color={colors.accent.DEFAULT} />
          <span
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: colors.text.primary,
              flex: 1,
            }}
          >
            Ask Syntra
          </span>
          <button
            type="button"
            onClick={clearThread}
            title="Clear conversation"
            aria-label="Clear conversation"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border.subtle}`,
              backgroundColor: 'transparent',
              color: colors.text.muted,
              cursor: 'pointer',
              transition: transitions.quick,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.severity.critical;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.severity.critical;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.text.muted;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.subtle;
            }}
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close (Esc)"
            aria-label="Close assistant"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: radii.sm,
              border: `1px solid ${colors.border.subtle}`,
              backgroundColor: 'transparent',
              color: colors.text.muted,
              cursor: 'pointer',
              transition: transitions.quick,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.text.primary;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.default;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.text.muted;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.subtle;
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Context pill */}
        <div
          style={{
            padding: '6px 16px',
            borderBottom: `1px solid ${colors.border.subtle}`,
            backgroundColor: colors.bg.base,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: typography.sizes.xs,
              fontFamily: typography.fonts.mono,
              color: colors.text.muted,
            }}
          >
            context:{' '}
            <span style={{ color: colors.text.secondary }}>
              {contextLabel}
            </span>
          </span>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 8px',
          }}
        >
          {turns.length === 0 && !loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 8,
                color: colors.text.muted,
                textAlign: 'center',
              }}
            >
              <MessageSquare size={24} color={colors.border.default} />
              <p style={{ fontSize: typography.sizes.sm, margin: 0 }}>
                Ask anything about your alerts, exposures, or counterparties.
              </p>
              <p style={{ fontSize: typography.sizes.xs, margin: 0, fontFamily: typography.fonts.mono }}>
                Answers are grounded in your org data only.
              </p>
            </div>
          )}

          {turns.map((turn, i) => (
            <TurnBubble key={i} turn={turn} claimsById={claimsById} />
          ))}

          {loading && <StreamingBubble text={streamingText} />}

          {errorMsg && (
            <div
              role="alert"
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                borderRadius: radii.md,
                border: `1px solid ${colors.severity.critical}`,
                backgroundColor: 'rgba(239,68,68,0.08)',
                fontSize: typography.sizes.sm,
                color: colors.severity.critical,
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${colors.border.subtle}`,
            flexShrink: 0,
            backgroundColor: colors.bg.surface,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              border: `1px solid ${colors.border.default}`,
              borderRadius: radii.md,
              backgroundColor: colors.bg.base,
              padding: '6px 10px',
              transition: `border-color ${transitions.quick}`,
            }}
            onFocus={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.accent.DEFAULT;
            }}
            onBlur={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.border.default;
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask about your org data…"
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: typography.sizes.sm,
                color: colors.text.primary,
                lineHeight: 1.5,
                fontFamily: typography.fonts.body,
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: radii.sm,
                border: `1px solid ${loading || !input.trim() ? colors.border.subtle : colors.accent.DEFAULT}`,
                backgroundColor: loading || !input.trim() ? 'transparent' : colors.accent.DEFAULT,
                color: loading || !input.trim() ? colors.text.disabled : '#fff',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: `${transitions.quick}`,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
              }}
            >
              {loading ? '…' : '↑'}
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: typography.sizes.xs, color: colors.text.muted, fontFamily: typography.fonts.mono }}>
              Enter to send · Shift+Enter for newline
            </span>
            <span style={{ fontSize: typography.sizes.xs, color: colors.text.muted, fontFamily: typography.fonts.mono }}>
              ⌘K to toggle
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
