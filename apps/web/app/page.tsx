import Link from 'next/link';
import { ArrowRight, Zap, Mail, MessageSquare, Code2, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Top nav */}
      <nav className="border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 h-12 flex items-center">
          <span className="font-semibold text-base tracking-tight mr-8">syntra</span>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a href="#how-it-works" className="hover:text-text-primary transition-colors duration-[150ms]">Product</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors duration-[150ms]">Pricing</a>
            <Link href="/docs" className="hover:text-text-primary transition-colors duration-[150ms]">Docs</Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Link href="/onboarding/org" className="px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95">
              Sign in
            </Link>
            <Link href="/onboarding/org" className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
              Start trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-8 pt-20 pb-16">
        <div className="max-w-2xl">
          <h1 className="text-[40px] leading-tight font-semibold text-text-primary mb-4">
            Geopolitical risk monitoring<br />
            <span className="text-text-secondary">for everyone Stratfor doesn't sell to.</span>
          </h1>
          <p className="text-base text-text-secondary mb-8 leading-relaxed">
            Watchlist-driven alerts in real time.<br />
            Email, WhatsApp, API. ₹15,000/month.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/onboarding/org" className="flex items-center gap-1.5 px-4 h-10 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
              Start free trial
            </Link>
            <Link href="/app/sundaram-pharma" className="flex items-center gap-1.5 px-4 h-10 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95">
              View live demo
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Dashboard screenshot placeholder */}
        <div className="mt-12 rounded-md border border-border-subtle overflow-hidden bg-bg-surface" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.08)' }}>
          <div className="h-8 bg-bg-surface-2 border-b border-border-subtle flex items-center px-4 gap-2">
            <span className="w-3 h-3 rounded-full bg-bg-surface-3" />
            <span className="w-3 h-3 rounded-full bg-bg-surface-3" />
            <span className="w-3 h-3 rounded-full bg-bg-surface-3" />
            <span className="ml-4 text-xs text-text-muted font-mono">app.syntra.app/app/sundaram-pharma</span>
          </div>
          <div className="h-72 bg-bg-base flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-sm text-text-muted">Dashboard preview — alerts, map, watchlist</p>
              <Link href={`/app/sundaram-pharma`} className="mt-3 inline-block text-xs text-accent hover:underline">
                Open demo dashboard →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border-subtle py-12">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: '200+', label: 'Sources monitored' },
              { value: '<15 min', label: 'Alert latency' },
              { value: '47K+', label: 'Events tracked' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums mb-1">{stat.value}</div>
                <div className="text-sm text-text-secondary">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">How it works</h2>
          <p className="text-sm text-text-secondary mb-10">Three steps to real-time geopolitical awareness.</p>
          <div className="grid grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Build your watchlist', desc: 'Add your suppliers, ports, shipping routes, and destination markets. Takes 5 minutes.' },
              { step: '02', title: 'We monitor everything', desc: 'Syntra scans 200+ sources around the clock. When an event matches your watchlist, we know in minutes.' },
              { step: '03', title: 'You get alerted', desc: 'Email, WhatsApp, or API — wherever your team works. With AI-generated context on what it means for your business.' },
            ].map(item => (
              <div key={item.step} className="bg-bg-surface border border-border-subtle rounded-md p-6">
                <div className="text-xs font-mono text-text-muted mb-3">{item.step}</div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Pricing</h2>
          <p className="text-sm text-text-secondary mb-10">Simple plans. No enterprise sales process. Start in minutes.</p>
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Starter', price: '₹15,000', period: '/month', entities: 100, api: '1,000 calls/mo', channels: 'Email + Webhook', highlight: false },
              { name: 'Growth',  price: '₹50,000', period: '/month', entities: 500, api: '10,000 calls/mo', channels: 'Email + WhatsApp + Webhook', highlight: true },
              { name: 'Enterprise', price: 'Custom', period: '', entities: 'Unlimited', api: 'Custom', channels: 'All + SLA', highlight: false },
            ].map(plan => (
              <div key={plan.name} className={`rounded-md border p-6 ${plan.highlight ? 'border-accent bg-bg-surface' : 'border-border-subtle bg-bg-surface'}`}>
                {plan.highlight && (
                  <div className="text-xs font-medium text-accent uppercase tracking-wider mb-2">Most popular</div>
                )}
                <div className="text-base font-semibold text-text-primary mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-semibold text-text-primary font-mono tabular-nums">{plan.price}</span>
                  {plan.period && <span className="text-sm text-text-muted">{plan.period}</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {[
                    `${plan.entities} watchlist entities`,
                    `${plan.api}`,
                    `${plan.channels}`,
                    'Unlimited alerts',
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <CheckCircle size={13} className="text-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/onboarding/org"
                  className={`block w-full text-center px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[150ms] ease-out active:scale-95 ${
                    plan.highlight
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3'
                  } flex items-center justify-center`}
                >
                  {plan.name === 'Enterprise' ? 'Contact us' : 'Start free trial'}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-4">All plans include a 14-day free trial. No credit card required.</p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Who it's for</h2>
          <p className="text-sm text-text-secondary mb-10">Built for operations teams with cross-border exposure.</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Indian exporters', desc: 'Pharma, textiles, auto-parts exporters shipping to Africa, MENA, and SE Asia via volatile corridors.' },
              { title: 'Freight forwarders', desc: 'Regional logistics operators handling India–Gulf, India–East Africa, and India–SE Asia freight.' },
              { title: 'Customs brokers', desc: 'Brokers managing cross-border compliance who need early warning on sanctions and regulatory changes.' },
              { title: 'Trade finance teams', desc: 'Bank and NBFC officers providing LC facilities and loans to exporters into frontier markets.' },
            ].map(persona => (
              <div key={persona.title} className="bg-bg-surface border border-border-subtle rounded-md p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-1">{persona.title}</h3>
                <p className="text-sm text-text-secondary">{persona.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API preview */}
      <section className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">API-first</h2>
          <p className="text-sm text-text-secondary mb-6">Embed Syntra's risk data in your own systems. One API call away.</p>
          <div className="bg-bg-surface border border-border-subtle rounded-md p-5 max-w-2xl">
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto">{`$ curl https://app.syntra.app/api/v1/alerts \\
  -H "Authorization: Bearer syn_live_..."

{
  "data": [{
    "id": "alt_8f3a2b",
    "severity": "critical",
    "title": "Houthi missile strike near Hodeidah",
    "occurred_at": "2025-03-15T14:23:00Z",
    "affected_entities": ["Suez route", "Hodeidah Port"]
  }]
}`}</pre>
          </div>
          <Link href="/docs" className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors duration-[150ms]">
            View API documentation <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-lg font-semibold text-text-primary mb-8">FAQ</h2>
          <div className="grid grid-cols-2 gap-6">
            {[
              { q: 'How quickly will I receive alerts?', a: 'Sub-15 minutes from event detection to delivery. Most alerts land in under 5 minutes.' },
              { q: 'What sources do you monitor?', a: '200+ sources including newswires, maritime tracking, UNOCHA, IMO advisories, government press releases, and curated open-source feeds.' },
              { q: 'Do I need a developer to set up the API?', a: 'No. The dashboard is self-serve. The API is optional — use it only if you want to integrate with your ERP or internal systems.' },
              { q: 'What if I have unique entities not on standard lists?', a: 'You can add any custom entity — a supplier at a specific address, a warehouse, a bespoke shipping route.' },
              { q: 'Can I try it before paying?', a: 'Yes. 14-day free trial with 50 watchlist entities and email alerts. No credit card required.' },
              { q: 'Is the data India-specific?', a: 'We cover global events but are optimized for Indian exporters shipping to Africa, MENA, Gulf, and SE Asia.' },
              { q: 'What happens during the Red Sea crisis when alerts are constant?', a: 'You set a severity threshold. We only alert you at or above that level. Quiet hours available too.' },
              { q: 'Can my whole team use it?', a: 'Yes. Growth and Enterprise plans support multiple users with role-based access (owner, admin, member).' },
            ].map(faq => (
              <div key={faq.q} className="border-t border-border-subtle pt-4">
                <h3 className="text-sm font-medium text-text-primary mb-1">{faq.q}</h3>
                <p className="text-sm text-text-secondary">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA repeat */}
      <section className="border-t border-border-subtle py-16">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-3">Know first. Act first.</h2>
          <p className="text-sm text-text-secondary mb-6">14-day free trial. No credit card. Setup in 5 minutes.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/onboarding/org" className="flex items-center gap-1.5 px-4 h-10 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
              Start free trial
            </Link>
            <Link href="/app/sundaram-pharma" className="flex items-center gap-1.5 px-4 h-10 rounded-md text-sm font-medium bg-bg-surface border border-border-default text-text-primary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out active:scale-95">
              View live demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <div className="text-sm text-text-muted">
            <span className="font-medium text-text-secondary">syntra</span>
            {' '}·{' '}
            Syntra is built on the{' '}
            <a href="https://warfront.live" className="hover:text-text-secondary transition-colors duration-[150ms]">Warfront geopolitical intelligence platform</a>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a href="#pricing" className="hover:text-text-secondary transition-colors duration-[150ms]">Pricing</a>
            <Link href="/docs" className="hover:text-text-secondary transition-colors duration-[150ms]">Docs</Link>
            <Link href="/onboarding/org" className="hover:text-text-secondary transition-colors duration-[150ms]">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
