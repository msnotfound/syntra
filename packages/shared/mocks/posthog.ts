console.warn('[MOCK] Using mock PostHog — set NEXT_PUBLIC_POSTHOG_KEY in .env and restart to use real.');

export const posthog = {
  capture(event: string, properties?: Record<string, unknown>) {
    console.log('[MOCK PostHog] Event:', event, properties ?? {});
  },
  identify(distinctId: string, properties?: Record<string, unknown>) {
    console.log('[MOCK PostHog] Identify:', distinctId, properties ?? {});
  },
  group(groupType: string, groupKey: string, properties?: Record<string, unknown>) {
    console.log('[MOCK PostHog] Group:', groupType, groupKey, properties ?? {});
  },
  flush() { return Promise.resolve(); },
};
