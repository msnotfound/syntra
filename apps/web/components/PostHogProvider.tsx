'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    let ph: { capture: (event: string, props: Record<string, unknown>) => void } | null = null;
    import('posthog-js').then(m => {
      const posthog = m.default;
      if (!(posthog as unknown as { __loaded?: boolean }).__loaded) {
        posthog.init(POSTHOG_KEY!, { api_host: 'https://app.posthog.com', autocapture: false, capture_pageview: false });
      }
      ph = posthog;
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      posthog.capture('$pageview', { $current_url: url });
    }).catch(() => {});

    return () => { ph = null; };
  }, [pathname, searchParams]);

  return <>{children}</>;
}
