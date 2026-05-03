# Mock Provider Audit — Session 3

Date: 2026-05-03

## Mock Files

All 8 mocks found in `packages/shared/mocks/`:

| Mock | File | [MOCK] Warning | Env Var Gate | Gating Location |
|------|------|---------------|--------------|-----------------|
| Anthropic | mocks/anthropic.ts | YES | ANTHROPIC_API_KEY | apps/worker/src/workers/ingest.ts (dynamic import) |
| Clerk | mocks/clerk.ts | YES | CLERK_SECRET_KEY | apps/web/lib/auth.ts (dynamic import) |
| PostHog | mocks/posthog.ts | YES | NEXT_PUBLIC_POSTHOG_KEY | apps/web/components/PostHogProvider.tsx (early return) |
| Razorpay | mocks/razorpay.ts | YES | RAZORPAY_KEY_ID | apps/web/app/api/webhooks/razorpay/route.ts |
| Redis | mocks/redis.ts | YES | UPSTASH_REDIS_URL | apps/worker/src/workers/dispatch.ts |
| SendGrid | mocks/sendgrid.ts | YES | SENDGRID_API_KEY | apps/worker/src/workers/dispatch.ts (ternary) |
| Sentry | mocks/sentry.ts | YES | SENTRY_DSN | apps/web/instrumentation.ts |
| Twilio | mocks/twilio.ts | YES | TWILIO_ACCOUNT_SID | apps/worker/src/workers/dispatch.ts (always mock currently — WhatsApp path) |

## Pattern

All providers use the pattern:
```ts
const sendEmail = process.env.SENDGRID_API_KEY
  ? (await import('@sendgrid/mail')).default.send
  : (await import('@syntra/shared/mocks/sendgrid')).sendEmail;
```

Each mock logs a `[MOCK]` warning on import pointing to the env var needed to activate the real provider.

## Issues Found

1. **Twilio WhatsApp**: `dispatch.ts` currently always imports the mock (`await import('@syntra/shared/mocks/twilio')`). The env-var gate is missing for the WhatsApp path (unlike SendGrid which has a proper ternary). Low severity — WhatsApp delivery won't work even with credentials set.
2. **Duplicate Mongoose indexes**: Schema defines both `index: true` and `schema.index()` for `Organization.slug` and `User.clerk_user_id`. Runtime warning only — no functional impact.
