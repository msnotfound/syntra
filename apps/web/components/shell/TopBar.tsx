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
    <header className="h-12 flex items-center px-4 bg-bg-surface border-b border-border-subtle flex-shrink-0">
      {/* Logo */}
      <Link href={`/app/${orgSlug}`} className="flex items-center mr-6">
        <span className="font-semibold text-base tracking-tight text-text-primary">syntra</span>
      </Link>

      {/* Org switcher */}
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95">
        {orgName}
        <ChevronDown size={14} />
      </button>

      <div className="flex-1" />

      {/* Search */}
      <button className="flex items-center gap-2 px-3 h-8 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-muted mr-3 w-52 hover:border-border-strong transition-colors duration-[150ms] ease-out">
        <Search size={14} />
        <span>Search...</span>
        <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded bg-bg-surface-3 text-text-disabled font-mono">⌘K</kbd>
      </button>

      {/* Notifications */}
      <button className="relative w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out mr-1 active:scale-95">
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-severity-critical" />
        )}
      </button>

      {/* User */}
      <button className="flex items-center gap-2 px-2 h-8 rounded-md text-sm text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95">
        <div className="w-6 h-6 rounded-full bg-bg-surface-3 flex items-center justify-center">
          <User size={12} />
        </div>
        <ChevronDown size={12} />
      </button>
    </header>
  );
}
