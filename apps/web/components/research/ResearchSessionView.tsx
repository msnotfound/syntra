'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  CheckCircle2, Clock, Loader2, XCircle, SkipForward,
  Play, Edit2, RefreshCw, AlertCircle, ChevronDown, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import type { IResearchSession, IResearchPlanStep, ResearchStepStatus, ResearchStepKind } from '@syntra/db';

interface Props {
  initialSession: IResearchSession;
  orgSlug: string;
}

const STATUS_ICON: Record<ResearchStepStatus, LucideIcon> = {
  proposed:    Clock,
  accepted:    CheckCircle2,
  edited:      Edit2,
  running:     Loader2,
  done:        CheckCircle2,
  skipped:     SkipForward,
};

const STATUS_COLOR: Record<ResearchStepStatus, string> = {
  proposed:    'text-text-muted',
  accepted:    'text-accent',
  edited:      'text-yellow-400',
  running:     'text-accent animate-spin',
  done:        'text-severity-low',
  skipped:     'text-text-muted',
};

const KIND_LABEL: Record<ResearchStepKind, string> = {
  sub_question:       'Plan',
  pull_intel_claims:  'Pull Evidence',
  fetch_external:     'Fetch URL',
  synthesize:         'Draft Section',
  recommend_actions:  'Recommendations',
};

interface StepCardProps {
  step: IResearchPlanStep;
  sessionId: string;
  onUpdate: () => void;
}

function StepCard({ step, sessionId, onUpdate }: StepCardProps) {
  const [expanded, setExpanded] = useState(step.status === 'running' || step.status === 'proposed');
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(step.title);
  const [editPrompt, setEditPrompt] = useState(step.prompt ?? '');
  const [busy, setBusy] = useState(false);

  const Icon = STATUS_ICON[step.status] ?? Clock;
  const output = step.output?.payload;

  const action = async (path: string, body?: object) => {
    setBusy(true);
    try {
      await fetch(`/api/v1/research/sessions/${sessionId}/steps/${step.step_id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      onUpdate();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    await action('edit', { title: editTitle, prompt: editPrompt || undefined });
    setEditMode(false);
  };

  const outputText = (() => {
    if (!output) return null;
    if (typeof output === 'string') return output;
    if (typeof output === 'object' && output !== null) {
      const o = output as Record<string, unknown>;
      if (o.markdown) return String(o.markdown);
      if (o.excerpt) return String(o.excerpt);
      if (o.actions && Array.isArray(o.actions)) {
        return (o.actions as Array<{ text: string }>).map((a, i) => `${i + 1}. ${a.text}`).join('\n');
      }
    }
    return JSON.stringify(output, null, 2);
  })();

  return (
    <div className={clsx(
      'bg-bg-surface border border-border-subtle rounded-sm overflow-hidden transition-colors duration-quick',
      step.status === 'running' && 'border-accent/40',
      step.status === 'done' && 'border-severity-low/20',
    )}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-surface-2 transition-colors duration-quick"
      >
        <Icon size={14} className={STATUS_COLOR[step.status] ?? 'text-text-muted'} />
        <span className="text-xs font-mono text-text-muted w-16 flex-shrink-0">{KIND_LABEL[step.kind]}</span>
        <span className="flex-1 text-sm text-text-primary truncate">{step.title}</span>
        {step.evidence_claim_ids.length > 0 && (
          <span className="text-xs text-text-muted font-mono">{step.evidence_claim_ids.length} claims</span>
        )}
        {expanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
          {step.description && !editMode && (
            <p className="text-xs text-text-secondary">{step.description}</p>
          )}

          {editMode ? (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-text-muted">Title</label>
                <input
                  className="w-full mt-1 bg-bg-surface-2 border border-border-subtle rounded-sm px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-default"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>
              {step.prompt !== null && (
                <div>
                  <label className="text-xs text-text-muted">Prompt / Query</label>
                  <input
                    className="w-full mt-1 bg-bg-surface-2 border border-border-subtle rounded-sm px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-default"
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={saveEdit} disabled={busy}
                  className="px-3 h-7 rounded-sm text-xs font-medium bg-accent text-text-primary hover:bg-accent/90 transition-colors duration-quick disabled:opacity-40">
                  Save
                </button>
                <button type="button" onClick={() => setEditMode(false)}
                  className="px-3 h-7 rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary border border-border-subtle transition-colors duration-quick">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {outputText && (
                <div className="bg-bg-surface-2 rounded-sm p-3 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {outputText}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {(step.status === 'proposed' || step.status === 'accepted' || step.status === 'edited') && (
                  <button type="button" onClick={() => action('run')} disabled={busy}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-sm text-xs font-medium bg-accent text-text-primary hover:bg-accent/90 transition-colors duration-quick disabled:opacity-40 active:scale-95">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Run
                  </button>
                )}
                {step.status === 'done' && (
                  <button type="button" onClick={() => action('run')} disabled={busy}
                    className="flex items-center gap-1.5 px-3 h-7 rounded-sm text-xs border border-border-subtle text-text-secondary hover:text-text-primary transition-colors duration-quick disabled:opacity-40 active:scale-95">
                    <RefreshCw size={12} />
                    Re-run
                  </button>
                )}
                {step.kind !== 'sub_question' && step.status !== 'running' && step.status !== 'done' && (
                  <>
                    <button type="button" onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 px-3 h-7 rounded-sm text-xs border border-border-subtle text-text-secondary hover:text-text-primary transition-colors duration-quick active:scale-95">
                      <Edit2 size={12} />
                      Edit
                    </button>
                    <button type="button" onClick={() => action('skip')} disabled={busy}
                      className="flex items-center gap-1.5 px-3 h-7 rounded-sm text-xs border border-border-subtle text-text-secondary hover:text-text-primary transition-colors duration-quick active:scale-95">
                      <SkipForward size={12} />
                      Skip
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ResearchSessionView({ initialSession, orgSlug }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<IResearchSession>(initialSession);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<IResearchPlanStep | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/v1/research/sessions/${String(initialSession._id)}`);
    const json = await res.json();
    if (json.data?.session) {
      setSession(json.data.session as IResearchSession);
    }
  }, [initialSession._id]);

  useEffect(() => {
    const latest = session.plan_steps.find(s => s.status === 'running') ?? null;
    setActiveStep(latest);
  }, [session.plan_steps]);

  // Subscribe to SSE for live updates
  useEffect(() => {
    const es = new EventSource(`/api/v1/research/sessions/${String(initialSession._id)}/stream`);
    es.addEventListener('update', (e) => {
      const data = JSON.parse(e.data);
      setSession(prev => ({ ...prev, ...data }));
    });
    es.addEventListener('done', () => { refresh(); es.close(); });
    es.onerror = () => es.close();
    return () => es.close();
  }, [initialSession._id, refresh]);

  const canFinalize = session.plan_steps.some(s => s.kind === 'synthesize' && s.status === 'done');
  const running = session.plan_steps.some(s => s.status === 'running');

  const finalize = async () => {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/research/sessions/${String(initialSession._id)}/finalize`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to finalize.');
        return;
      }
      router.push(`/app/${orgSlug}/research/${String(initialSession._id)}/finalized`);
    } catch {
      setError('Network error.');
    } finally {
      setFinalizing(false);
    }
  };

  const latest = session.plan_steps.reduce<IResearchPlanStep | null>((acc, s) => {
    if (s.status === 'done' && s.output) return s;
    return acc;
  }, null);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left: step timeline */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Research Plan</h2>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{session.question}</p>
        </div>

        <div className="space-y-2">
          {session.plan_steps.map(step => (
            <StepCard
              key={step.step_id}
              step={step}
              sessionId={String(initialSession._id)}
              onUpdate={refresh}
            />
          ))}
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-severity-critical">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={!canFinalize || running || finalizing}
            onClick={finalize}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-sm text-sm font-medium bg-accent text-text-primary hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-quick active:scale-95"
          >
            {finalizing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {finalizing ? 'Finalizing…' : 'Finalize Report'}
          </button>
          {!canFinalize && !running && (
            <p className="text-xs text-text-muted text-center">
              Run at least one "Draft Section" step first.
            </p>
          )}
        </div>
      </div>

      {/* Right: live output panel */}
      <div className="flex-1 bg-bg-surface border border-border-subtle rounded-sm overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          {activeStep ? (
            <>
              <Loader2 size={13} className="text-accent animate-spin" />
              <span className="text-sm text-text-secondary">Running: {activeStep.title}</span>
            </>
          ) : latest ? (
            <>
              <CheckCircle2 size={13} className="text-severity-low" />
              <span className="text-sm text-text-secondary">Latest: {latest.title}</span>
            </>
          ) : (
            <>
              <Clock size={13} className="text-text-muted" />
              <span className="text-sm text-text-muted">Waiting for first step to run…</span>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {(activeStep ?? latest) && (() => {
            const step = activeStep ?? latest!;
            const output = step.output?.payload;
            if (!output) {
              return (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  Running {step.title}…
                </div>
              );
            }
            if (typeof output === 'object' && output !== null && 'markdown' in output) {
              const o = output as { heading?: string; markdown: string };
              return (
                <div className="space-y-3">
                  {o.heading && <h3 className="text-base font-semibold text-text-primary">{o.heading}</h3>}
                  <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                    {o.markdown}
                  </div>
                </div>
              );
            }
            if (typeof output === 'object' && output !== null && 'actions' in output) {
              const o = output as { actions: Array<{ text: string; rationale: string }> };
              return (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-text-primary">Recommended Actions</h3>
                  <div className="space-y-2">
                    {o.actions.map((a, i) => (
                      <div key={i} className="bg-bg-surface-2 rounded-sm p-3 space-y-1">
                        <p className="text-sm font-medium text-text-primary">{i + 1}. {a.text}</p>
                        <p className="text-xs text-text-secondary">{a.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
              </pre>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
