'use client';
import React, { useState, useEffect } from 'react';

function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatAbsolute(date: Date): string {
  return date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

interface TimeAgoProps {
  date: Date | string;
  className?: string;
}

export function TimeAgo({ date, className }: TimeAgoProps) {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  const [relative, setRelative] = useState(() => getRelativeTime(parsed));

  useEffect(() => {
    const interval = setInterval(() => setRelative(getRelativeTime(parsed)), 30_000);
    return () => clearInterval(interval);
  }, [parsed]);

  return (
    <time
      dateTime={parsed.toISOString()}
      title={formatAbsolute(parsed)}
      className={className}
    >
      {relative}
    </time>
  );
}
