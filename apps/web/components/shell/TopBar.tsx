'use client';
import Link from 'next/link';
import { ChevronDown, Search, Bell, User } from 'lucide-react';
import { clsx } from 'clsx';

interface TopBarProps {
  orgName: string;
  orgSlug: string;
  unreadCount?: number;
}

export function TopBar({ orgName, orgSlug, unreadCount = 0 }: TopBarProps) {
  return (
    <header className="relative h-14 flex items-center px-5 bg-bg-surface border-b border-border-subtle flex-shrink-0">
      {/* Logo */}
      <Link href={`/app/${orgSlug}`} className="flex items-center mr-6 rounded-sm focus-visible:outline-accent/60">
        <span className="font-semibold text-base tracking-tight text-text-primary">syntra</span>
      </Link>

      <div className="flex-1" />

      <button
        type="button"
        className="absolute left-1/2 top-1/2 flex h-8 w-[360px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 text-sm text-text-muted transition-colors duration-quick ease-out hover:border-border-default hover:bg-bg-surface-2 active:scale-95"
        aria-label="Open command palette"
      >
        <Search size={14} />
        <span className="text-text-secondary">Search alerts, entities, routes</span>
        <kbd className="ml-auto rounded-sm border border-border-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">⌘K</kbd>
      </button>

      <div className="mr-3 hidden h-8 items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 text-xs text-text-secondary lg:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-severity-critical" />
        <span className="font-mono tabular-nums text-text-primary">12</span>
        <span>alerts open</span>
        <span className="text-text-muted">·</span>
        <span className="font-mono tabular-nums text-severity-critical">3 critical</span>
      </div>

      {/* Notifications */}
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-quick ease-out mr-1 active:scale-95"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-severity-critical" />
        )}
      </button>

      {/* User */}
      <button
        type="button"
        className="flex items-center gap-2 px-2 h-8 rounded-md border border-transparent text-sm text-text-secondary hover:border-border-subtle hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-quick ease-out active:scale-95"
        aria-label="User menu"
      >
        <div className="w-6 h-6 rounded-full bg-bg-surface-3 flex items-center justify-center">
          <User size={12} />
        </div>
        <span className="hidden max-w-28 truncate text-xs text-text-secondary xl:inline">{orgName}</span>
        <ChevronDown size={12} />
      </button>
    </header>
  );
}
