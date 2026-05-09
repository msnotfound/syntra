'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Bell, List, Code2, Settings,
  HelpCircle, BookOpen, Kanban, Activity, TrendingDown, Shield, ClipboardList, Users, type LucideIcon,
  HelpCircle, BookOpen, Kanban, Activity, TrendingDown, FileText, type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',  href: '',           icon: LayoutDashboard },
  { label: 'Alerts',    href: '/alerts',    icon: Bell },
  { label: 'Triage',    href: '/triage',    icon: Kanban },
  { label: 'Watchlist', href: '/watchlist', icon: List },
  { label: 'Exposures', href: '/exposures', icon: TrendingDown },
  { label: 'Insurance', href: '/insurance', icon: Shield },
  { label: 'Heatmap',   href: '/heatmap',   icon: Activity },
  { label: 'Decisions', href: '/decisions', icon: ClipboardList },
  { label: 'War Rooms', href: '/war-rooms', icon: Users },
  { label: 'Briefs',    href: '/briefs',    icon: FileText },
  { label: 'API',       href: '/api',       icon: Code2 },
  { label: 'Settings',  href: '/settings',  icon: Settings },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Help',  href: '/help',  icon: HelpCircle },
  { label: 'Docs',  href: '/docs',  icon: BookOpen },
];

interface SidebarProps {
  orgSlug: string;
}

export function Sidebar({ orgSlug }: SidebarProps) {
  const pathname = usePathname();
  const base = `/app/${orgSlug}`;

  function isActive(href: string) {
    const full = `${base}${href}`;
    if (href === '') return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(full);
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-bg-surface flex flex-col h-full border-r border-border-subtle">
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className={clsx(
                'flex items-center gap-3 px-3 h-8 rounded-sm text-sm font-medium',
                'transition-colors duration-[150ms] ease-out',
                'active:scale-95',
                active
                  ? 'bg-bg-surface-2 text-text-primary border-l-2 border-accent pl-2.5'
                  : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary border-l-2 border-transparent pl-2.5'
              )}
            >
              <Icon size={16} className={active ? 'text-accent' : 'text-text-secondary'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle py-4 px-3 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className="flex items-center gap-3 px-3 h-8 rounded-sm text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out border-l-2 border-transparent pl-2.5"
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
