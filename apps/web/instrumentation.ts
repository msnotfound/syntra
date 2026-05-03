export async function register() {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  } else {
    const { Sentry } = await import('@syntra/shared/mocks/sentry');
    Sentry.init({});
  }
}
