import Link from 'next/link';
import { UploadCloud, PenLine, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';

const STEP = 2;
const TOTAL = 5;

export default function OnboardingWatchlistPage() {
  return (
    <div className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>Step {STEP} of {TOTAL}</span>
          <span>{Math.round((STEP / TOTAL) * 100)}%</span>
        </div>
        <div className="h-1 bg-bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(STEP / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
        <h1 className="text-xl font-semibold text-text-primary mb-2">Add your first watchlist entities</h1>
        <p className="text-sm text-text-secondary mb-8">We'll alert you when geopolitical events affect them.</p>

        {/* Three options */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: UploadCloud, label: 'Upload CSV', desc: 'Bulk import from spreadsheet', href: '/onboarding/watchlist/csv' },
            { icon: PenLine,     label: 'Add manually', desc: 'One at a time', href: '/onboarding/watchlist/manual' },
            { icon: Rocket,      label: 'Use template', desc: 'Pre-built sets for your industry', href: '/onboarding/watchlist/template' },
          ].map(opt => {
            const Icon = opt.icon;
            return (
              <Link
                key={opt.label}
                href={opt.href}
                className="flex flex-col items-center text-center p-6 rounded-md border border-border-default bg-bg-surface-2 hover:border-accent hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out cursor-pointer group"
              >
                <Icon size={28} className="text-text-secondary group-hover:text-accent transition-colors duration-[150ms] mb-3" />
                <span className="text-sm font-medium text-text-primary mb-1">{opt.label}</span>
                <span className="text-xs text-text-muted">{opt.desc}</span>
              </Link>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/onboarding/org"
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95"
          >
            <ChevronLeft size={14} />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/onboarding/alerts-prefs"
              className="px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95"
            >
              Skip for now
            </Link>
            <Link
              href="/onboarding/alerts-prefs"
              className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
            >
              Continue
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
