console.warn('[MOCK] Using mock Sentry — set SENTRY_DSN in .env and restart to use real.');

export const Sentry = {
  init(_opts: unknown) {},
  captureException(error: unknown, context?: unknown) {
    console.error('[MOCK Sentry] Exception captured:', error, context ?? '');
  },
  captureMessage(message: string, level?: string) {
    console.error(`[MOCK Sentry] Message (${level ?? 'info'}):`, message);
  },
  setUser(_user: unknown) {},
  setTag(_key: string, _value: string) {},
  withScope(cb: (scope: unknown) => void) { cb({}); },
};
