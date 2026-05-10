# Syntra — Manual Setup Guide

These are the things orcha agents could **not** do for you. Each one needs an account, a card, a phone, an inbox, or a wait.

Tracking format: each item lists **what to do**, **why**, **how long**, and **the env var(s)** to populate when done.

---

## 0. Critical path (do these first — they all gate launch)

### 0.1 GitHub Actions secrets
Where: `https://github.com/msnotfound/syntra/settings/secrets/actions`

Once you have the values from the rest of this file, paste them as repository secrets. Names must match exactly:

```
ANTHROPIC_API_KEY
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
MONGODB_URI
NEXT_PUBLIC_MAPBOX_TOKEN
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
SENTRY_DSN
NEXT_PUBLIC_POSTHOG_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
UPSTASH_REDIS_URL
UPSTASH_REDIS_TOKEN
NEXT_PUBLIC_APP_URL
```

### 0.2 Local `.env` for development
The repo's existing `.env` has every key as an empty string. As you collect each value below, paste it into `.env`. Mocks fall back automatically when a key is empty — so the app keeps running while you fill them in.

---

## 1. Database (~5 min, free tier OK)

**MongoDB Atlas** — `https://cloud.mongodb.com`

1. Create a free M0 cluster (any region close to your users; Mumbai/Singapore for India).
2. Database access → Add user → save the password.
3. Network access → Add IP → "Allow from anywhere" (0.0.0.0/0) for dev. Tighten before prod.
4. Connect → Drivers → copy the connection string.

Env vars:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.xxx.mongodb.net/syntra?retryWrites=true&w=majority
MONGODB_DB_NAME=syntra
```

After populating: `pnpm seed` will run the v3 seeder and load Sundaram Pharma + 17 collections of v3 demo data.

---

## 2. Redis cache + rate limit (~3 min)

**Upstash Redis** — `https://console.upstash.com`

1. Create database → free tier → pick region matching MongoDB.
2. Copy the REST URL and REST token from the Details panel.

Env vars:
```
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=AY...
```

---

## 3. Auth (~5 min)

**Clerk** — `https://clerk.com`

1. Create an application named Syntra.
2. Configure → Settings → Multi-session enabled, Organizations enabled.
3. API Keys → copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
4. Webhooks → add endpoint `https://<your-prod-domain>/api/clerk/webhooks` for `user.created`, `user.updated`, `organization.created`, `organization.membership.created`. Copy the signing secret.

Env vars:
```
CLERK_SECRET_KEY=sk_test_...     # or sk_live_ in prod
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## 4. Maps (~3 min)

**Mapbox** — `https://account.mapbox.com`

1. Create an account → free tier (50K map loads/month is enough for v1).
2. Tokens → create a new token with `styles:read`, `fonts:read`, `tiles:read`, `datasets:read`.
3. URL restrictions: add `localhost:3000`, your prod domain, your staging domain. **Required** — without restrictions, leaked tokens cost real money.

Env var:
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```

---

## 5. Email (~30 min plus ~24h DNS propagation)

**SendGrid** — `https://signup.sendgrid.com`

1. Free tier = 100 emails/day. For prod use Pro at $19.95/mo (50K/mo).
2. Settings → Sender Authentication → Authenticate Your Domain → walk through SPF, DKIM, DMARC DNS records. Add them at your domain registrar.
3. Wait 24h for DNS propagation. Verify in SendGrid dashboard.
4. Settings → API Keys → create a "Mail Send" full-access key.

Env vars:
```
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=alerts@<your-domain>
```

Until DNS propagates, the worker uses the mock SendGrid that logs payloads to `reports/mock-emails/`.

---

## 6. WhatsApp + SMS (~1–2 weeks of waiting for approval)

**Twilio** — `https://console.twilio.com`

1. Buy a Twilio number ($1/month) for SMS.
2. WhatsApp Business → Apply for production access. **This takes 1–2 weeks.** Until approved, use the WhatsApp sandbox (limited to opt-in users).
3. Account → API Credentials → copy SID and Auth Token.

Env vars:
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886    # sandbox until approved
TWILIO_FROM_NUMBER=+1xxx                       # the number you bought
```

In India specifically, voice-call alerts (M53 in the buildplan) have the same approval friction. Default to sandbox.

---

## 7. Payments (~2–3 business days for Razorpay KYC)

**Razorpay** — `https://dashboard.razorpay.com`

1. Sign up with the legal entity name. Indian businesses need PAN, GST, bank account details.
2. KYC takes 2–3 business days. While pending, use test mode keys.
3. Settings → API Keys → generate test keys (immediately) and live keys (after KYC).
4. Webhooks → add `https://<your-domain>/api/webhooks/razorpay` with events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.captured`, `payment.failed`. Copy the webhook secret.

Env vars:
```
RAZORPAY_KEY_ID=rzp_test_xxx        # or rzp_live_xxx after KYC
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

---

## 8. LLM provider (~2 min)

**Anthropic** — `https://console.anthropic.com`

1. Add a payment method (your YC startup credits should be applied).
2. API Keys → create one. Copy.
3. Settings → Usage limits → set a daily cap (recommended: $50/day for v1).

Env var:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Without this, all LLM calls fall back to deterministic stubs in `packages/shared/mocks/anthropic.ts`. Useful for dev — useless for the demo's "Why this matters" or risk-brief narrative quality.

---

## 9. Telemetry (~5 min)

**Sentry** — `https://sentry.io`

1. Create a Next.js project named `syntra-web` and a Node project named `syntra-worker`.
2. Each gives a DSN. The web one matters most for v1.
3. Set up a release hook in your deploy command (Sentry's CLI takes care of it).

Env var:
```
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**PostHog** — `https://app.posthog.com`

1. Create a project. Copy the project API key.
2. Configure → Toolbar URLs → add your prod and staging domains.

Env var:
```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 10. Domain + DNS (~1 hour, plus ~24h propagation)

**Domain registrar** — Namecheap, Cloudflare, Porkbun, GoDaddy. Cloudflare is cheapest and has the best DNS UI.

Recommended candidates (verify availability + trademark first):
1. `syntra.app` — clean, modern
2. `getsyntra.com` — fallback if `.app` taken
3. `syntra.io` — if you want `.io` for B2B
4. `runsyntra.com` — fallback fallback

After purchase:
- Add A/CNAME records pointing at your hosting (Vercel auto-configures most of this).
- Add the SendGrid SPF/DKIM records from §5.
- Add Razorpay's verification record if asked (rare).
- If using Cloudflare proxy, set SSL/TLS mode to "Full (strict)".

Env var:
```
NEXT_PUBLIC_APP_URL=https://app.syntra.app    # or whatever you bought
```

---

## 11. Hosting (~30 min for first deploy)

**Vercel** — `https://vercel.com` (recommended for Next.js)

1. Connect your `msnotfound/syntra` GitHub repo.
2. Framework: Next.js auto-detected.
3. Root directory: leave blank (monorepo setup detected via `pnpm-workspace.yaml`).
4. Build command: `pnpm --filter web build`
5. Output directory: `apps/web/.next`
6. Install command: `pnpm install --frozen-lockfile`
7. Environment Variables: paste every value from this file into the Vercel UI.
8. Deploy.

Worker (`apps/worker`) is a separate Node service. Options:
- **Railway** (`https://railway.app`) — simplest for Node + cron, $5/mo starter.
- **Render** (`https://render.com`) — free background worker tier with limits.
- **Fly.io** (`https://fly.io`) — pay-per-use, fast cold starts.

Pick one, deploy `apps/worker` with the same env vars + `pnpm --filter worker start` as the start command.

---

## 12. Trademark + brand check (~30 min, do BEFORE printing on YC app)

Before committing to "Syntra" publicly:

1. **Trademark search** — `https://tmsearch.uspto.gov` (US), `https://ipindiaonline.gov.in/tmrpublicsearch` (India), `https://search.tmview.org` (EU).
2. **Domain availability** — confirm your candidate is buyable.
3. **Social handles** — `@syntra` on X/Twitter, LinkedIn, GitHub. If taken, decide how to disambiguate.
4. **Existing companies** — Google "syntra company" — there's at least one Belgian education provider with this name. Most regions are clear.

If "Syntra" is not viable in your target market, fall back to: Sundra, Syntera, Syntrace, Nexgrid, Coris.

---

## 13. OpenAI (already done in this session)

You added a payment method during the orcha build to unlock TPM. The $2,500 YC credits should still cover months of usage.

Env var (for future codex agent runs and any direct GPT calls):
```
OPENAI_API_KEY=sk-proj-...    # the active key from your codex login
```

---

## 14. Optional but recommended

### 14.1 Status page (~10 min)

**Better Stack** or **Statuspage** — public-facing uptime page. `status.syntra.app` looks professional and YC partners check it.

### 14.2 Cookie / privacy banner

For EU users + Indian DPDP compliance, you'll need a cookie banner. The repo doesn't ship one — add one before prod launch. Options: `cookieyes.com` (free tier ok), `usercentrics.com` (paid).

### 14.3 Customer support inbox

`hello@syntra.app` and `support@syntra.app` forwarding to a real inbox. SendGrid Inbound Parse can pipe this into the app if you want unified ticketing later.

### 14.4 Insurance

For B2B SaaS handling commercial intelligence, you'll want $1M/$2M cyber liability coverage before signing your first paid customer. Vouch, Embroker, At-Bay — any of them quote in 10 minutes.

---

## What you DON'T have to do

- Set up any of the orcha-touched code paths — they all default to mocks when env is empty.
- Manually wire schemas, models, or routes — those are all in `main`.
- Run any test fixtures — `pnpm test` is green (176/176).
- Smoke-test routes — `pnpm dev:web` starts cleanly, all 35 routes return 200.

---

## Suggested ordering

If you can't do everything tonight:

**Tonight**: Razorpay KYC submit (2-3 day clock starts), Twilio WhatsApp Business apply (2-week clock starts), domain purchase, MongoDB Atlas, Anthropic key.

**Tomorrow**: Clerk, SendGrid + DNS records, Mapbox, Sentry + PostHog, Vercel deploy.

**Day 3**: Twilio SMS works, Razorpay test keys work.

**Day 5–7**: Razorpay KYC finishes. Generate live keys. Switch app to live mode.

**Week 2**: Twilio WhatsApp Business approved. Switch dispatch worker from sandbox.

**Week 3+**: First paying customer.
