import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

function checkBasicAuth(): boolean {
  const u = process.env.ADMIN_USERNAME ?? 'admin';
  const p = process.env.ADMIN_PASSWORD ?? 'syntra-admin';
  const authHeader = headers().get('authorization') ?? '';
  if (!authHeader.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  return user === u && pass === p;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!checkBasicAuth()) {
    // Return WWW-Authenticate challenge — Next.js middleware is a better place for this
    // in production, but for a minimal admin panel this works.
    redirect('/api/admin/auth');
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="h-12 border-b border-border-subtle flex items-center px-6 gap-4">
        <span className="text-sm font-semibold tracking-tight">syntra admin</span>
        <nav className="flex items-center gap-4 ml-4">
          {[
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/orgs', label: 'Orgs' },
            { href: '/admin/events', label: 'Events' },
            { href: '/admin/inject-event', label: '⚡ Inject Event' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors duration-[150ms] ease-out"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
