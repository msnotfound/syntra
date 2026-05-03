# Morning Handoff — Session 3

Date: 2026-05-03

---

## What's running

**localhost:3000 (web)** — On cold start without credentials, you'll see:
- The landing page (`/`) fully rendered with all 9 sections
- MongoDB connects to in-memory MongoMemoryServer (~30s cold start, then instant)
- All API routes return 404/empty until seed is run or real DB is connected
- Clerk auth is mocked — all `/app/*` routes accessible without login
- Sentry/PostHog are mocked — no telemetry until keys are set

**localhost:3001 (worker)** — On start you'll see `[MOCK]` warnings for:
- `[MOCK] MONGODB_URI not set — using in-memory MongoDB`
- `[MOCK] Using mock Anthropic`
- `[MOCK] Using mock Twilio`
- `[MOCK] Using mock SendGrid`
- `[MOCK] Using in-memory Redis mock`

Worker listens on BullMQ queue `alert-dispatch`. No jobs process until an event triggers the matching engine.

**DB state** — Mock/in-memory by default. Run `pnpm seed` to get Sundaram Pharma demo data (1 org, 1 user, 5 watchlist entities, 3 events, 8 alerts).

---

## What's done (commit SHAs)

| SHA | Feature | Session |
|-----|---------|---------|
| `3e093220` | Matching engine — 10/10 tests green | 2 |
| `354de16f` | Onboarding wizard — 5 steps | 2 |
| `1deaaff8` | Settings alerts preferences page | 2 |
| `86648bdd` | Razorpay webhook handler | 2 |
| `b0d9fa69` | Admin panel (dashboard, orgs, events) | 2 |
| `0a606fcb` | OpenAPI spec + /docs (Scalar) | 2 |
| `95fd7624` | Sentry + PostHog telemetry wiring | 2 |
| `e0f74380` | Fix 5 known issues (metadata, settings API, webhook test, PostHog type, unused dep) | 3 |
| `2e12d4ac` | Fix Next.js build (extensionAlias for NodeNext .js→.ts) | 3 |

All buildplan §3-21 phases delivered. All 28 routes (17 UI + 11 API) verified present and building.

---

## What needs human attention BEFORE first customer

### Credentials — provision each one and fill in .env

| Env Var | Where to get | Impact if missing |
|---------|-------------|-------------------|
| `MONGODB_URI` | MongoDB Atlas → Connect → Driver URI | Uses in-memory DB (data lost on restart) |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | dashboard.clerk.com → API Keys | Auth is mocked — anyone can access any org |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | LLM context falls back to generic stub |
| `SENDGRID_API_KEY` | app.sendgrid.com → Settings → API Keys | Email alerts not delivered |
| `SENDGRID_FROM_EMAIL` | Must be a verified sender in SendGrid | Defaults to `alerts@syntra.app` |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | console.twilio.com | WhatsApp alerts not delivered |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET` | dashboard.razorpay.com → Settings | Payments disabled; webhook sig not verified |
| `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` | console.upstash.com → Redis | BullMQ uses local Redis (port 6379 must be running) |
| `SENTRY_DSN` | sentry.io → Settings → Client Keys | Errors not tracked |
| `NEXT_PUBLIC_POSTHOG_KEY` | app.posthog.com → Project Settings | No user analytics |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | account.mapbox.com → Tokens | Map tiles won't load on watchlist page |

### Domain decision
- Choose between `syntra.app`, `getsyntra.com`, or alternative
- Update `NEXT_PUBLIC_APP_URL` in .env

### DNS Records (after domain purchase)
- A record: `@` → your server/Vercel IP
- CNAME: `www` → root or hosting provider
- Clerk requires: `accounts.syntra.app` CNAME per Clerk custom domain docs

### DKIM / SPF for SendGrid
- Add SendGrid's SPF TXT record to DNS: `v=spf1 include:sendgrid.net ~all`
- Add DKIM CNAME records (provided by SendGrid) for `syntra.app`
- Without these, emails land in spam

### Razorpay KYC
- Complete KYC at dashboard.razorpay.com before live payments
- Test mode works without KYC; live mode requires it

### Twilio WhatsApp Business
- Apply for WhatsApp Business API at twilio.com/whatsapp
- Requires Facebook Business Manager verification (1-2 weeks)
- Sandbox available for testing without approval

### Mapbox Token URL Restrictions
- In Mapbox account, restrict the `NEXT_PUBLIC_MAPBOX_TOKEN` to your domain only
- Prevents token abuse if token is visible in client-side JS

### Clerk Production Keys
- Create a Production instance in Clerk (separate from Dev instance)
- Copy production keys into .env
- Configure allowed redirect URLs for your domain

---

## Smoke Test Recipe

```bash
# 1. Fill in at minimum these env vars in .env:
#    MONGODB_URI=mongodb+srv://...
#    NEXT_PUBLIC_APP_URL=http://localhost:3000

# 2. Install deps
pnpm install

# 3. Seed demo data
cd packages/db && npx tsx seed/index.ts && cd ../..

# 4. Start web + worker (two terminals)
pnpm --filter web dev          # terminal 1 → http://localhost:3000
pnpm --filter worker dev       # terminal 2

# 5. Verify these URLs:
#    http://localhost:3000/              → Landing page (9 sections)
#    http://localhost:3000/onboarding/org  → Step 1 of 5 wizard
#    http://localhost:3000/app/sundaram-pharma  → Overview dashboard
#    http://localhost:3000/app/sundaram-pharma/alerts  → Alert feed (8 alerts)
#    http://localhost:3000/app/sundaram-pharma/settings/alerts  → Alert settings
#    http://localhost:3000/docs          → Scalar API reference
#    http://localhost:3000/admin         → Admin panel (prompts Basic Auth)
#                                          Username/password: set ADMIN_USERNAME/ADMIN_PASSWORD in .env

# 6. Test webhook endpoint:
curl -X POST http://localhost:3000/api/v1/webhooks/test \
  -H 'content-type: application/json' \
  -d '{"url":"https://webhook.site/your-id"}'
# Should return: {"status":"ok","response_code":200,...}

# 7. Test org settings:
curl http://localhost:3000/api/v1/orgs/sundaram-pharma/settings
# Should return: {"data":{"alert_channels":["email","whatsapp"],...}}
```

---

## Known Issues / TODO for v1.0 Polish

From route audit and mock audit:

1. **Twilio WhatsApp always-mock** — FIXED in session 3 (env-var gate added). Requires `TWILIO_ACCOUNT_SID` credential to use real delivery.

2. **Duplicate Mongoose indexes** — `Organization.slug` and `User.clerk_user_id` have duplicate index declarations. Logs runtime warnings. Fix: remove one of `{ index: true }` or `schema.index()` for each field.

3. **Admin basic-auth flow** — `admin/layout.tsx` redirects to `/api/admin/auth` which returns HTTP 401, triggering native browser Basic Auth dialog. Functional but not polished. A proper middleware-based auth would be cleaner.

4. **Next.js peer version warnings** — `@clerk/nextjs` and `@scalar/nextjs-api-reference` want Next 15.x, project runs 14.2.5. Both work, but upgrade is on the v1.5 roadmap.

5. **`/app/[orgSlug]/settings` redirect** — The general settings page should redirect to `/settings/alerts` as the first sub-tab. Currently renders a blank shell.

6. **No CSV watchlist import UI** — API supports POST /api/v1/watchlist but there's no bulk import UI. Manual entry only in v1.

7. **`WEBHOOK_SECRET` vs `RAZORPAY_WEBHOOK_SECRET`** — Worker `dispatch.ts` uses `process.env.WEBHOOK_SECRET` for outgoing webhook HMAC but the .env file uses `RAZORPAY_WEBHOOK_SECRET`. These are different secrets (one for Razorpay inbound, one for Syntra outbound). Consider adding `SYNTRA_WEBHOOK_SECRET` to .env for clarity.

---

## What's NOT in v1 (do NOT accidentally build)

Per `syntra_buildplan.md §99-DO-NOT-BUILD` and Part II:
- Sanctions engine (OFAC/UN/EU) — that's M17 in v1.5
- News aggregation / web scraping — manual event input only in v1
- Mobile app (React Native)
- White-label / multi-tenant theming
- Regulatory filing automation
- Custom alert rule builder UI
- SOC 2 compliance tooling
- API rate limiting beyond basic middleware
- SSO / SAML enterprise auth

---

## Recommended Next Session (post-morning, ~2-4 hours)

**Priority 1 — Credential wiring**
1. Set `MONGODB_URI` (Atlas free tier takes 5 min)
2. Set `CLERK_SECRET_KEY` + publishable key
3. Run `pnpm seed` against real DB
4. Verify `/app/sundaram-pharma` loads with real data

**Priority 2 — End-to-end happy path smoke test**
1. Complete onboarding wizard as a new user
2. Trigger a test alert via `/api/v1/events` POST
3. Verify alert appears in feed and triggers dispatch worker
4. Check email mock logs at `reports/mock-sendgrid/`

**Priority 3 — Ship to first beta customer OR start M17**
- If happy path works: deploy to Vercel, invite first beta customer
- If more build needed: start v1.5 module M17 (Sanctions Engine) per orchestration playbook

**Deploy command (Vercel):**
```bash
cd apps/web && vercel --prod
# Set env vars in Vercel dashboard → Settings → Environment Variables
```
