'use client';
import { useEffect, useState } from 'react';

type Stage = 'idle' | 'fetching' | 'extracting' | 'done';

interface ExtractionProgressProps {
  stage: Stage;
}

export default function ExtractionProgress({ stage }: ExtractionProgressProps) {
  const [displayedStages, setDisplayedStages] = useState<Stage[]>(['fetching']);

  useEffect(() => {
    if (stage === 'idle') {
      setDisplayedStages(['fetching']);
      return;
    }

    const stages: Stage[] = ['fetching'];
    if (stage === 'extracting' || stage === 'done') stages.push('extracting');
    if (stage === 'done') stages.push('done');
    setDisplayedStages(stages);
  }, [stage]);

  const StageRow = ({ label, active, done }: { label: string; active: boolean; done: boolean }) => (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
        done
          ? 'bg-green-900 text-green-200'
          : active
            ? 'bg-accent text-white animate-pulse'
            : 'bg-bg-surface-2 text-text-muted'
      }`}>
        {done ? '✓' : active ? '◆' : '◇'}
      </div>
      <span className={`text-sm ${
        done || active ? 'text-text-primary font-medium' : 'text-text-secondary'
      }`}>
        {label}
      </span>
    </div>
  );

  const isComplete = stage === 'done';

  return (
    <div className="space-y-4">
      <div className="bg-bg-surface-2 rounded-md p-4 space-y-0">
        <StageRow
          label="Reading URL"
          active={stage === 'fetching'}
          done={stage !== 'idle' && stage !== 'fetching'}
        />
        <StageRow
          label="Extracting entities"
          active={stage === 'extracting'}
          done={stage === 'done'}
        />
        <StageRow
          label="Preparing review"
          active={false}
          done={stage === 'done'}
        />
      </div>

      {isComplete && (
        <div className="text-center py-2">
          <p className="text-sm text-green-400">✓ Extraction complete</p>
        </div>
      )}
    </div>
  );
}
