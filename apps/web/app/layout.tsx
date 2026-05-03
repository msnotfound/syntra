import type { Metadata } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata: Metadata = {
  title: { default: 'Syntra', template: '%s — Syntra' },
  description: 'Real-time geopolitical risk monitoring for mid-market exporters.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-base text-text-primary antialiased">
        <Suspense>
          <PostHogProvider>
            {children}
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
