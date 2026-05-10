import Link from 'next/link';
import { ArrowRight, CheckCircle } from 'lucide-react';

const surfaces = [
  {
    name: 'Intel',
    label: 'Event intelligence',
    copy: 'Watchlist-matched geopolitical events with source trails, confidence, severity, and affected entities.',
  },
  {
    name: 'Command',
    label: 'Executive response',
    copy: 'Acknowledge, forward, brief, and open war rooms from the same dense operational surface.',
  },
  {
    name: 'Foundry',
    label: 'Risk infrastructure',
    copy: 'API-ready alert, exposure, and mitigation data for teams that need Syntra inside existing systems.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <nav className="border-b border-border-subtle bg-bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-8">
          <span className="mr-9 text-base font-semibold tracking-tight text-text-primary">syntra</span>
          <div className="flex items-center gap-7 text-sm text-text-secondary">
            <a href="#surfaces" className="transition-colors duration-quick hover:text-text-primary">Product</a>
            <Link href="/docs" className="transition-colors duration-quick hover:text-text-primary">Docs</Link>
            <Link href="/app/sundaram-pharma" className="transition-colors duration-quick hover:text-text-primary">Demo</Link>
          </div>
          <div className="flex-1" />
          <Link
            href="/onboarding/org"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-3 text-sm font-medium text-text-secondary transition-colors duration-quick hover:border-accent/60 hover:text-text-primary active:scale-95"
          >
            Request access <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-6xl px-8 pb-14 pt-24">
          <div className="max-w-4xl">
            <div className="mb-8 h-px w-28 bg-accent/60" />
            <h1 className="max-w-4xl text-[64px] font-light leading-[1.02] tracking-normal text-text-primary">
              Supply-chain intelligence for officers operating across geopolitical fault lines.
            </h1>
            <p className="mt-7 max-w-2xl text-md leading-7 text-text-secondary">
              Syntra turns events, exposures, routes, and mitigations into a calm executive workspace for supply-chain, finance, and risk teams.
            </p>
            <div className="mt-9 flex items-center gap-3">
              <Link
                href="/onboarding/org"
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border-default bg-transparent px-4 text-sm font-medium text-text-primary transition-colors duration-quick hover:border-accent/60 hover:bg-bg-surface active:scale-95"
              >
                Request access <ArrowRight size={14} />
              </Link>
              <Link
                href="/app/sundaram-pharma"
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-text-secondary transition-colors duration-quick hover:bg-bg-surface-2 hover:text-text-primary active:scale-95"
              >
                View demo
              </Link>
            </div>
          </div>

          <div className="mt-16 overflow-hidden rounded-md border border-border-subtle bg-bg-surface">
            <div className="flex h-9 items-center gap-2 border-b border-border-subtle bg-bg-base px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
              <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
              <span className="h-2.5 w-2.5 rounded-full bg-bg-surface-3" />
              <span className="ml-4 font-mono text-xs text-text-muted">app.syntra.ai / command</span>
            </div>
            <div className="grid min-h-[340px] grid-cols-[1fr_320px]">
              <div className="relative border-r border-border-subtle bg-map-bg">
                <div className="absolute left-[18%] top-[36%] h-2 w-2 rounded-full bg-accent" />
                <div className="absolute left-[34%] top-[54%] h-2 w-2 rounded-full bg-accent" />
                <div className="absolute left-[57%] top-[44%] h-3 w-3 rounded-full bg-severity-critical" />
                <div className="absolute left-[56%] top-[43%] h-6 w-6 rounded-full border border-severity-critical/40" />
                <div className="absolute inset-x-8 top-8 flex items-center justify-between border-b border-border-subtle pb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Global exposure map</span>
                  <span className="font-mono text-xs text-text-muted">47 entities</span>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Today&apos;s intelligence</span>
                  <span className="font-mono text-xs text-severity-critical">3 critical</span>
                </div>
                {['Houthi strike near Hodeidah', 'Port closure announced — Mombasa', 'Sanctions update — Iran banking'].map((item, index) => (
                  <div key={item} className="border-t border-border-subtle py-4 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-severity-critical' : index === 1 ? 'bg-severity-high' : 'bg-severity-medium'}`} />
                      <span className="font-mono text-[11px] text-text-muted">{index === 0 ? '04m' : index === 1 ? '2h' : '6h'}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-text-primary">{item}</p>
                    <p className="mt-1 text-xs text-text-secondary">Matched to route, port, and supplier exposure.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="surfaces" className="border-t border-border-subtle py-16">
          <div className="mx-auto max-w-6xl px-8">
            <div className="grid grid-cols-3 gap-4">
              {surfaces.map((surface) => (
                <div key={surface.name} className="surface-lift rounded-md p-6">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="text-lg font-semibold text-text-primary">{surface.name}</span>
                    <CheckCircle size={15} className="text-accent" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">{surface.label}</p>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{surface.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8">
          <span className="text-sm font-medium text-text-secondary">syntra</span>
          <span className="text-sm text-text-muted">Built on the Warfront geopolitical intelligence platform</span>
        </div>
      </footer>
    </div>
  );
}
