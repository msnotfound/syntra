'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Bell, List, Code2, Settings, ChevronDown,
  HelpCircle, BookOpen, Kanban, Activity, TrendingDown, Shield, ClipboardList, Users, FileText, Network, Rss, Briefcase, Lightbulb,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',     href: '',              icon: LayoutDashboard },
  { label: 'Alerts',       href: '/alerts',       icon: Bell },
  { label: 'Triage',       href: '/triage',       icon: Kanban },
  { label: 'Watchlist',    href: '/watchlist',    icon: List },
  { label: 'Exposures',    href: '/exposures',    icon: TrendingDown },
  { label: 'Insurance',    href: '/insurance',    icon: Shield },
  { label: 'Heatmap',      href: '/heatmap',      icon: Activity },
  { label: 'Decisions',    href: '/decisions',    icon: ClipboardList },
  { label: 'War Rooms',    href: '/war-rooms',    icon: Users },
  { label: 'Briefs',       href: '/briefs',       icon: FileText },
  { label: 'Supply Graph', href: '/supply-graph', icon: Network },
  { label: 'Mitigations', href: '/mitigations',  icon: Lightbulb },
  { label: 'Sources',      href: '/sources',      icon: Rss },
  { label: 'Operations',  href: '/operations',   icon: Briefcase },
  { label: 'API',          href: '/api',          icon: Code2 },
  { label: 'Settings',     href: '/settings',     icon: Settings },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Help',  href: '/help',  icon: HelpCircle },
  { label: 'Docs',  href: '/docs',  icon: BookOpen },
];

interface SidebarProps {
  orgSlug: string;
  orgName: string;
}

export function Sidebar({ orgSlug, orgName }: SidebarProps) {
  const pathname = usePathname();
  const base = `/app/${orgSlug}`;

  function isActive(href: string) {
    const full = `${base}${href}`;
    if (href === '') return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(full);
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-bg-surface flex flex-col h-full border-r border-border-subtle">
      <div className="px-4 py-5 border-b border-border-subtle">
        <button
          type="button"
          className="group flex h-9 w-full items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-3 text-left transition-colors duration-quick ease-out hover:border-border-default hover:bg-bg-surface-2 active:scale-95"
          aria-label="Switch organization"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-text-primary">{orgName}</span>
            <span className="block font-mono text-[11px] text-text-muted">operational desk</span>
          </span>
          <ChevronDown size={14} className="ml-3 flex-shrink-0 text-text-muted transition-colors duration-quick group-hover:text-text-secondary" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-6 overflow-auto">
        <div className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className={clsx(
                'flex items-center gap-3 px-3 h-8 rounded-sm text-sm font-medium',
                'transition-colors duration-quick ease-out',
                'active:scale-95',
                active
                  ? 'bg-bg-surface-2 text-accent border-l-2 border-accent pl-2.5'
                  : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary border-l-2 border-transparent pl-2.5'
              )}
            >
              <Icon size={16} className={active ? 'text-accent' : 'text-text-secondary'} />
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>

      <div className="border-t border-border-subtle px-4 py-6 space-y-1">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className="flex items-center gap-3 px-3 h-8 rounded-sm text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-quick ease-out border-l-2 border-transparent pl-2.5 active:scale-95"
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
