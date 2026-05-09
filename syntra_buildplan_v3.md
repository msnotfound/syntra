# Syntra — End-to-End Build Plan

> **Product name:** Syntra. The B2B division of Warfront.
> **Window:** 5 days for v1, agent-led. Command-tier modules (v1.5+) covered in Part II.
> **Output:** Live, hosted, paying-customer-ready v1 with the demo flow needed for YC video + Canopy presentation.
> **Audience for this doc:** Coding agents (Claude Code, OpenCode) + the two founders.
> **Visual language:** governed by `syntra_design_guide.md`. If this doc and the design guide ever conflict, the design guide wins.

---

## 0. North Star

A real-time geopolitical risk monitoring and alerting product for mid-market exporters, freight forwarders, customs brokers, and trade finance operators with cross-border exposure to volatile regions. Delivered as: a hosted multi-tenant dashboard, multi-channel alerts (email + WhatsApp + Slack-ready webhook), and a developer API.

The thesis: incumbents (Stratfor, Recorded Future, Dataminr, Janes) sell to F500 at $100K+ ACVs. Everyone below that line — 50K+ Indian/SE Asian exporters, regional logistics operators, mid-tier banks doing trade finance into volatile markets — is unserved. We are the API-first, mid-market-priced version. Long-term: the data layer every supply chain, insurance, and trade finance product embeds.

---

## 0.1 Brand Identity & Naming

**Syntra is the B2B division of Warfront.** Warfront is the parent brand and operates the consumer/OSINT product at warfront.live, plus the geopolitical event ingestion infrastructure that Syntra reads from. Syntra is the standalone product name for the trade-and-supply-chain product line documented in this plan.

**Naming rules — apply consistently:**

- Product name in all UI, copy, marketing, and customer-facing communications: **Syntra**.
- Tier labels inside Syntra (do not treat as separate products): **Syntra Trade** (v1, the wedge), **Syntra Command** (v1.5, modules M16–M27), **Syntra Foundry-class** (v2, the enterprise moat). Same data layer underneath all three; tier-gated features.
- Parent brand "Warfront" appears only in: (a) the marketing footer as "Syntra is built on the Warfront geopolitical intelligence platform," (b) internal references to existing Warfront infrastructure (the events DB, the ingestion stack, the corroboration pipeline), (c) historical context where relevant. **Never co-branded inside the app shell.** No "Warfront" in page titles, sidebar, email from-name, API key prefix, or status page.
- Email from-name: `Syntra <alerts@syntra.app>`.
- API key prefix: `syn_live_` and `syn_test_` (was `wf_live_` / `wf_test_`).
- Repo name: `syntra/` (was `warfront-trade/`).

**Domain — TBD before deployment.** Default candidate is `syntra.app` for marketing and `app.syntra.app` for the dashboard. Pre-flight checklist before locking it in:

- DNS availability check on `syntra.app`, `syntra.io`, `getsyntra.com`.
- Trademark conflict search in target jurisdictions (India, Singapore, UAE, US, EU). "Syntra" is a real-world name used by at least one Belgian education company and a handful of smaller SaaS products; trademark conflicts in *our* trade/supply-chain category are unlikely but must be verified before printing the name on a YC application or signed customer contract.
- Fallback order if `syntra.app` is taken: `syntra.io` → `getsyntra.com` → `syntra.co`.

If the domain check forces a name change, do it before the v1 launch announcement, not after. Renaming after public launch is materially more expensive than renaming pre-launch.

---

## 1. The Buyer (ICP)

**Primary:** Indian exporters, ₹50 cr–₹500 cr annual cross-border revenue, with shipments transiting Red Sea / Persian Gulf / Black Sea / Suez, or operating in 5+ African / MENA / SE Asian markets.

**Secondary:** Regional freight forwarders, customs brokers (India / SEA / GCC), trade finance officers at mid-tier banks lending into frontier markets.

**Buyer persona:** Head of Operations / Head of Supply Chain / COO. Not the CEO. Not IT.

**Budget signoff threshold:** ₹50K–₹3L/month without committee approval. Above that → procurement → 3+ month sales cycle. v1 stays under the threshold.

---

## 2. The Job-To-Be-Done

When a geopolitical event happens (Red Sea attack, port closure, sanctions update, regional unrest, embargo, infrastructure strike), the operations head needs to know within 15 minutes:

1. Are any of *my* shipments / suppliers / routes / counterparties affected?
2. How severe is the disruption likely to be?
3. What are my options (re-route, hold, accelerate, hedge)?
4. What do I tell my customers / board?

Currently solved via WhatsApp groups, Twitter, late news, and panicked calls to the freight forwarder. Average lag: 4–8 hours. Cost of lag: missed re-route windows, missed hedging windows, missed customer communications.

---

## 3. Product Scope

### What's in v1

- Multi-tenant org structure with email/password + Google OAuth
- Watchlist management (entities: supplier, port, route, country, region, asset)
- Real-time matching engine (existing Warfront events ↔ customer watchlists)
- Email alerts (SendGrid) + WhatsApp alerts (Twilio) + generic webhook
- Customer dashboard (map, alert feed, watchlist, alert detail, history)
- Public REST API with API keys + rate limiting
- Self-serve onboarding (CSV upload of watchlist + manual review by us)
- Razorpay subscriptions (Starter / Growth tiers)
- Admin panel (org management, alert debugging, manual event injection for demos)
- Telemetry (PostHog) — feature usage + funnel
- Public marketing landing page

### What's explicitly NOT in v1 (DO NOT BUILD)

> Listed here at the top because agents will drift. Re-read this list before adding any feature.

- ❌ Microservices architecture (one Next.js app + one worker process is enough)
- ❌ Neo4j knowledge graph (MongoDB is fine)
- ❌ Elasticsearch (MongoDB text indexes are fine for v1)
- ❌ Custom ML models (NER, anomaly detection, sentiment) — use LLM where needed
- ❌ Satellite imagery integration
- ❌ Social media ingestion (Telegram, X) — existing Warfront RSS is enough
- ❌ Multi-tier supply chain mapping (single-tier suppliers only in v1)
- ❌ Scenario simulation / Monte Carlo / what-if modeling
- ❌ Mobile app / PWA / offline mode
- ❌ Hindi / Tamil / Telugu language support
- ❌ White-label / multi-brand
- ❌ On-premise / air-gapped deployment
- ❌ SOC 2 / ISO 27001 prep work (basic security only — see §13)
- ❌ GraphQL (REST is enough)
- ❌ gRPC, mTLS, service mesh
- ❌ Kubernetes (Vercel + Railway)
- ❌ A second product line / second buyer segment / "while we're at it…"
- ❌ Sanskrit branding for sub-products
- ❌ Anything not in §3a above

If an agent proposes anything from this list, the answer is no.

---

## 4. Stack (LOCKED — do not negotiate)

```
FRONTEND
  Next.js 14 (App Router)
  React Server Components by default
  TypeScript (strict mode)
  Tailwind CSS
  shadcn/ui (component library)
  Mapbox GL JS (map)
  Recharts (charts)
  TanStack Query (client-side fetching where needed)
  Zod (validation)

BACKEND
  Next.js API routes (REST)
  Separate Node.js worker process for cron + matching + alert dispatch
  Mongoose (existing Warfront MongoDB)
  Redis (Upstash) — cache, rate limit, alert queue
  BullMQ — alert dispatch queue

AUTH
  Clerk (multi-tenant orgs out of the box) OR Auth.js with Google OAuth + email/password
  Decision: Clerk if budget allows, Auth.js if not. Pick day 1, do not switch.

ALERTS
  SendGrid (transactional email)
  Twilio WhatsApp Business API (start sandbox immediately, real approval takes 1–2 weeks)
  Generic webhook for Slack/custom

PAYMENTS
  Razorpay subscriptions

OBSERVABILITY
  PostHog (product analytics)
  Sentry (errors)
  Logtail or Axiom (structured logs)

HOSTING
  Vercel (Next.js app)
  Railway (worker process + Redis)
  MongoDB Atlas (existing Warfront cluster, new database namespace)

SUPPORTING
  Resend (transactional email backup if SendGrid blocks)
  Slack (internal alerts)
  Linear (issue tracking)
```

**No alternatives.** If an agent suggests Fastify instead of Next.js routes, no. If an agent suggests Postgres instead of MongoDB, no. The stack is locked because we already have Warfront infrastructure on MongoDB and the migration cost is not justified by v1.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              CUSTOMER DASHBOARD (Next.js on Vercel)         │
│   - Auth (Clerk)                                            │
│   - Org-scoped pages: /dashboard, /watchlist, /alerts       │
│   - Public API routes: /api/v1/*                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         MongoDB Atlas (syntra database)               │
│   - organizations, users, watchlist_entities,               │
│     alerts, api_keys, subscriptions                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ reads existing collections
┌─────────────────────────────────────────────────────────────┐
│      Existing Warfront MongoDB (events, articles, etc.)     │
│      [READ ONLY from B2B side — do not modify schema]       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        WORKER PROCESS (Node.js on Railway)                  │
│   - Matching cron (every 5 min)                             │
│   - Alert dispatcher (BullMQ consumer)                      │
│   - Cleanup jobs                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│   SendGrid │ Twilio WhatsApp │ Webhook │ Razorpay │ PostHog │
└─────────────────────────────────────────────────────────────┘
```

One frontend app, one worker process, two MongoDB databases (one new, one existing read-only), one Redis. Total moving parts: 5. That's the ceiling.

---

## 6. Data Model

New database: `syntra`. Do not touch existing Warfront collections except read-only.

### Collections

```typescript
// organizations
{
  _id: ObjectId,
  name: string,
  slug: string,                        // URL-safe, unique
  plan: "trial" | "starter" | "growth" | "enterprise",
  status: "active" | "suspended" | "cancelled",
  trial_ends_at: Date,
  razorpay_customer_id: string | null,
  razorpay_subscription_id: string | null,
  contact_email: string,
  contact_phone: string | null,
  settings: {
    alert_channels: ("email" | "whatsapp" | "webhook")[],
    webhook_url: string | null,
    severity_threshold: "critical" | "high" | "medium" | "low",
    quiet_hours_start: string | null,  // "22:00" IST
    quiet_hours_end: string | null,
    timezone: string,                  // "Asia/Kolkata" default
  },
  created_at: Date,
  updated_at: Date,
}

// users (Clerk handles auth; this is our metadata)
{
  _id: ObjectId,
  clerk_user_id: string,
  email: string,
  name: string,
  org_id: ObjectId,
  role: "owner" | "admin" | "member",
  created_at: Date,
  last_seen_at: Date,
}

// watchlist_entities
{
  _id: ObjectId,
  org_id: ObjectId,
  type: "supplier" | "port" | "route" | "country" | "region" | "asset",
  name: string,
  // Geographic
  latitude: number | null,
  longitude: number | null,
  country_code: string | null,         // ISO 3166-1 alpha-2
  region: string | null,
  // Type-specific
  metadata: {
    // For supplier: { industry, importance, notes }
    // For port: { unlocode, type }
    // For route: { waypoints: [{lat, lng}], buffer_km }
    // For country/region: just name + code
    [key: string]: any,
  },
  active: boolean,
  created_at: Date,
  updated_at: Date,
}

// alerts
{
  _id: ObjectId,
  org_id: ObjectId,
  event_id: ObjectId,                  // ref to existing Warfront events
  watchlist_entity_ids: ObjectId[],    // can match multiple entities
  severity: "critical" | "high" | "medium" | "low",
  match_reasons: ("proximity" | "country" | "route" | "supplier_country")[],
  // Snapshot of event at alert time (for resilience if event changes)
  event_snapshot: {
    title: string,
    description: string,
    location: { lat: number, lng: number },
    country: string,
    occurred_at: Date,
    sources: { url: string, name: string }[],
  },
  // Lifecycle
  created_at: Date,
  dispatched_at: Date | null,
  channels_sent: ("email" | "whatsapp" | "webhook")[],
  acknowledged_at: Date | null,
  acknowledged_by_user_id: ObjectId | null,
  acknowledgement_note: string | null,
}

// api_keys
{
  _id: ObjectId,
  org_id: ObjectId,
  name: string,                        // "Production API key"
  key_hash: string,                    // SHA-256 of the actual key
  key_prefix: string,                  // first 8 chars for display: "syn_live_..."
  scopes: ("read:events" | "read:alerts" | "write:watchlist")[],
  rate_limit_per_minute: number,
  created_by_user_id: ObjectId,
  created_at: Date,
  last_used_at: Date | null,
  revoked_at: Date | null,
}

// usage_events  (for billing + analytics)
{
  _id: ObjectId,
  org_id: ObjectId,
  type: "alert_sent" | "api_call" | "watchlist_added",
  metadata: { ... },
  created_at: Date,
}
```

### Indexes (create on day 1, not later)

```
organizations: { slug: 1 } unique, { razorpay_subscription_id: 1 }
users: { clerk_user_id: 1 } unique, { org_id: 1 }
watchlist_entities: { org_id: 1, active: 1 }, { latitude: 1, longitude: 1 }, { country_code: 1 }
alerts: { org_id: 1, created_at: -1 }, { event_id: 1 }, { acknowledged_at: 1 }
api_keys: { key_hash: 1 } unique, { org_id: 1 }
usage_events: { org_id: 1, created_at: -1 }, { type: 1, created_at: -1 }
```

---

## 7. Auth & Multi-Tenancy

- **Clerk Organizations** (preferred) — handles users, orgs, invites, roles out of the box.
- Every page under `/app` is org-scoped via the URL: `/app/[orgSlug]/...`
- Server-side check on every page/API route: `getAuth()` → fetch user → verify membership in `params.orgSlug` → load org → continue. Any failure → 404 (don't leak existence).
- Three roles: **owner** (billing + delete org), **admin** (manage users, watchlist, settings), **member** (view + acknowledge alerts).
- API keys are org-scoped, not user-scoped. Created by admins.

---

## 8. Watchlist System

### UI

- Single page: `/app/[orgSlug]/watchlist`
- Tabs: Suppliers | Ports | Routes | Countries | Regions | Assets
- For each tab: searchable, sortable table + "Add" button
- Bulk import: CSV upload with column mapping wizard (5 minute MVP — use a library like Papaparse)
- Map view at the top: all active watchlist entities pinned

### Add flow per type

- **Supplier:** name, address (geocode via Mapbox API), industry, importance (1-5)
- **Port:** UN/LOCODE autocomplete (use a static dataset — there are ~10K ports, ship as JSON)
- **Route:** click waypoints on a map; auto-buffer 200km radius
- **Country:** dropdown of ISO countries
- **Region:** predefined list (Red Sea, Persian Gulf, Sahel, Eastern Europe, etc.)
- **Asset:** name + location (e.g., "our Mumbai warehouse")

### Validation

- Max entities per plan: Trial 50, Starter 100, Growth 500, Enterprise unlimited
- Geocoding required for all spatial entities — reject if Mapbox returns no result

---

## 9. Matching Engine

### Algorithm (v1 — keep stupid)

Cron every 5 minutes (worker process):

```
1. events = MongoDB.events.find({
     created_at: { $gte: now - 10min }   // 5min overlap for safety
   })

2. For each event:
     For each org with status = active:
       matches = []
       
       // Proximity match (200km haversine)
       nearby = watchlist_entities.find({
         org_id: org._id,
         active: true,
         latitude: { $exists: true },
       }).filter(e => haversine(e, event.location) < 200km)
       
       // Country match
       country_match = watchlist_entities.find({
         org_id: org._id,
         active: true,
         $or: [
           { type: "country", country_code: event.country },
           { country_code: event.country, type: { $in: ["supplier", "port", "asset"] } }
         ]
       })
       
       // Route match
       route_match = watchlist_entities.find({
         org_id: org._id,
         active: true,
         type: "route",
       }).filter(r => routeIntersects(r.metadata.waypoints, event.location, r.metadata.buffer_km))
       
       matches = unique(nearby ∪ country_match ∪ route_match)
       
       if matches.length > 0:
         severity_passes = event.severity matches org.settings.severity_threshold
         quiet_hours_passes = !inQuietHours(now, org.settings)
         
         if severity_passes:
           create_alert({
             org_id, event_id, watchlist_entity_ids: matches.map(m => m._id),
             severity, match_reasons, event_snapshot: snapshot(event)
           })
           
           if quiet_hours_passes:
             enqueue_dispatch(alert_id)
           else:
             // queue for end of quiet hours
             enqueue_dispatch(alert_id, runAt: org.settings.quiet_hours_end)

3. Update last_run_at metadata for cron health
```

### Performance budget

- Must complete in <60 seconds for 100 active orgs × 200 watchlist entities each.
- At v1 scale (5–20 orgs), trivially fast.
- Add Redis cache of orgs + their watchlist_entities, refresh every 5 min.

### Test cases (write these as Jest tests on day 1)

1. Event in Mumbai → org with Mumbai supplier → match (proximity)
2. Event in Yemen → org with Red Sea route → match (route)
3. Event in Sudan → org with Sudan in country watchlist → match (country)
4. Event in Tokyo → org with no Asia watchlist → no match
5. Critical event → org with severity_threshold=high → match
6. Medium event → org with severity_threshold=high → no alert
7. Event during quiet hours → alert created but dispatch deferred
8. Same event matches 3 entities of same org → ONE alert, 3 entity_ids
9. Cron runs twice in overlap window → no duplicate alerts (idempotency on event_id+org_id)
10. Org status=suspended → no matching

---

## 10. Alert Dispatch

### Channels

- **Email (SendGrid):** rich HTML template with map snapshot (use Mapbox Static API), event details, "why this matters to you" section listing affected entities, acknowledgement button (deep link with one-click ack token)
- **WhatsApp (Twilio):** plain text, severity emoji, location, 1-line description, link to dashboard. Start Twilio WhatsApp sandbox on day 1 — production approval takes time.
- **Webhook:** POST JSON payload to org.settings.webhook_url with retry (3 attempts, exponential backoff)

### Email template structure

```
Subject: [SEVERITY] Event near {entity_name} — {short_event_title}

Hero:
  Map image (Mapbox Static, 600x300) showing event location + affected entities

Summary:
  What: {event_title}
  Where: {location}, {country}
  When: {occurred_at, relative}
  Severity: {badge}

Why this matters to you:
  Affects:
    - {entity_1.name} ({entity_1.type}) — {distance}km away
    - {entity_2.name} ({entity_2.type}) — country match

Sources:
  - {source_1.name}: {url}
  - {source_2.name}: {url}

Recommended actions: (LLM-generated, see below)
  - {action_1}
  - {action_2}

[Button: Acknowledge in Dashboard]
[Button: View Full Details]

Footer:
  Manage alerts | Unsubscribe | Snooze for 24h
```

### LLM-generated "recommended actions"

- For each alert, call Claude/GPT with:
  - Event details
  - Customer's affected entities
  - Customer's industry (from org metadata)
- Prompt returns 2–3 short, actionable bullets
- Cache per (event_id, org_id) — don't re-generate
- Budget: ~$0.001 per alert. Cap at $50/day across all orgs in v1.

### Idempotency

- BullMQ job ID = `alert_dispatch:{alert_id}` — automatic dedup
- Email "Message-ID" header = alert_id — prevents double-send if SendGrid retries

---

## 11. Dashboard

### Pages (all under `/app/[orgSlug]/`)

1. **`/`** — Overview
   - Map (full-width hero) with all watchlist entities + last 7 days of alerts as event pins
   - Sidebar: "Active alerts (last 24h)" feed, max 10
   - Top stats: total entities, alerts this week, alerts unacknowledged

2. **`/alerts`** — Alert feed
   - Filters: severity, region, time range, entity, acknowledged status
   - Each row: severity badge, title, affected entities, time, ack button
   - Click → alert detail modal with full event, sources, map, recommended actions

3. **`/alerts/[id]`** — Alert detail (also accessible via email deep link)
   - Full event info
   - Map zoomed to event location with affected entities highlighted
   - Source articles with thumbnails
   - LLM-generated context
   - Acknowledgement form (with optional note)
   - "Forward to team" → email/WhatsApp share

4. **`/watchlist`** — Watchlist management (see §8)

5. **`/api`** — API keys + docs
   - List of keys (prefix only, never show full key after creation)
   - Generate new key (show once, copy to clipboard)
   - Revoke
   - Usage stats: requests today/week, top endpoints
   - Embedded API documentation (use Mintlify components or just MDX)

6. **`/settings`** — Org settings
   - Alert channels (toggle email/WhatsApp/webhook)
   - Severity threshold
   - Quiet hours
   - Webhook URL + test button
   - Team members (invite, role change, remove)
   - Billing (current plan, change plan, cancel, invoices)

7. **`/onboarding`** — First-run wizard (see §13)

### Design principles

- Dark mode default (operations users work in dark dashboards all day)
- Information density: closer to Linear / Pylon than Stripe
- No marketing copy inside the app. Functional language only.
- All times in user's timezone with UTC offset shown
- All distances in km (mention miles in settings later)
- Loading states everywhere — no blank screens
- Error states with actionable messages

---

## 12. Public REST API

### Endpoints (v1)

```
GET    /api/v1/events                 — list recent events, filterable
GET    /api/v1/events/:id             — single event
GET    /api/v1/alerts                 — list this org's alerts
GET    /api/v1/alerts/:id             — single alert
POST   /api/v1/alerts/:id/acknowledge — mark acknowledged
GET    /api/v1/watchlist              — list entities
POST   /api/v1/watchlist              — create entity
PATCH  /api/v1/watchlist/:id          — update entity
DELETE /api/v1/watchlist/:id          — delete (soft)
GET    /api/v1/risk?lat=&lng=&radius= — point-in-time risk score for a location
```

### Auth

- Header: `Authorization: Bearer syn_live_...`
- Resolve API key → org → scope check → request
- Rate limit per key: starter 100/min, growth 1000/min, enterprise custom
- Use Upstash rate limit (sliding window)

### Response format

- All responses JSON, snake_case
- Standard envelope: `{ data: ..., meta: { ... }, error: null }`
- Standard error format: `{ data: null, error: { code, message, details } }`
- HTTP status codes used semantically (200/201/400/401/403/404/429/500)

### Documentation

- Auto-generate OpenAPI spec from Zod schemas (use `zod-to-openapi`)
- Render with Mintlify or Scalar
- Include `curl` examples for every endpoint
- Include a "Quick start" with 5-minute setup

### Versioning

- Path-prefixed (`/v1/`). Never break v1 once announced.

---

## 13. Onboarding Flow

### Self-serve (post-signup)

Step 1: **Org setup** — name, industry (dropdown), primary regions of operation (multi-select)
Step 2: **Add first watchlist entities** — three quick options:
  - "Upload CSV" → wizard with column mapping
  - "Add manually" → opens watchlist page
  - "Start with a template" → pre-built templates ("Indian pharma exporter to Africa", "Indian textile exporter to MENA", etc.) — these auto-populate ~30 entities to play with
Step 3: **Pick alert preferences** — channels, severity, quiet hours
Step 4: **Invite team** — optional, can skip
Step 5: **Demo alert** — fire a sample alert immediately so they see the product working

### Concierge onboarding (for first 20 paying customers)

- We do step 2 manually for them
- They send us a list of their suppliers/routes/markets
- We research and ingest within 24h
- This is a feature, not a bug — it's how we learn the domain and build templates

---

## 14. Billing

### Plans

| Plan | Price (₹/mo) | Entities | Alerts/mo | API calls/mo | Channels |
|---|---|---|---|---|---|
| Trial | Free 14 days | 50 | Unlimited | 1,000 | Email |
| Starter | 15,000 | 100 | Unlimited | 1,000 | Email + Webhook |
| Growth | 50,000 | 500 | Unlimited | 10,000 | Email + WhatsApp + Webhook |
| Enterprise | Custom | Unlimited | Unlimited | Custom | All + SLA |

### Razorpay integration

- Razorpay Subscriptions (monthly billing)
- Webhook handler at `/api/webhooks/razorpay` for subscription lifecycle events
- On subscription_charged → extend org plan validity
- On subscription_cancelled → downgrade to trial at end of period
- On subscription_halted (failed payment) → email owner, suspend after 7 days grace
- Invoices auto-emailed by Razorpay; we link to them in `/settings/billing`

### USD pricing (later)

- Don't build in v1. Ship INR only. Add USD when first international customer asks.

---

## 15. Admin Panel

### Routes (under `/admin`, accessible only to email allowlist)

- **`/admin/orgs`** — list all orgs, plan, MRR, last activity, alerts sent (pagination)
- **`/admin/orgs/[id]`** — drill in: users, watchlist, recent alerts, billing
- **`/admin/events`** — list recent events from existing Warfront DB
- **`/admin/inject`** — manually create a fake event (for demos + testing matching live)
- **`/admin/alerts`** — global alert log, filterable
- **`/admin/health`** — cron last-run, queue depth, error rates

### Why this matters

The injection tool is your demo lifeline. You need to be able to trigger a "live" alert on demand during YC video / Canopy demo / customer calls. Build it on day 1.

---

## 16. Design System

> Visual language is governed by `syntra_design_guide.md`. This section is the build-plan-side mirror of that doc. If the two ever conflict, the design guide wins.

### Visual language

- **Reference apps:** Linear, Bloomberg Terminal, Pylon, Datadog, Vercel dashboard, Resend dashboard.
- **Avoid:** generic AI startup landing pages, gradient hero sections, glassmorphism, "futuristic" aesthetics, mesh backgrounds, decorative illustrations, friendly consumer-SaaS patterns.

### Tokens (v2 — navy-charcoal)

```
Background:    bg-base       (#0B0E14)   — app shell background
Surface:       bg-surface    (#151921)   — cards, panels, sidebar
Surface 2:     bg-surface-2  (#1E2530)   — borders, hairlines, selected/hover states
Surface 3:     bg-surface-3  (#262C36)   — input fields, code blocks, deep wells

Text-primary:    text-primary    (#FAFAFA)   — headings, primary copy
Text-secondary:  text-secondary  (#94A3B8)   — labels, captions, tab inactive
Text-muted:      text-muted      (#64748B)   — timestamps, disclaimers, metadata

Accent:    blue-500   (#3B82F6)   — primary actions, links, focus rings, active indicators
Severity:
  Critical:  red-500     (#EF4444)
  High:      orange-500  (#F97316)
  Medium:    yellow-500  (#EAB308)
  Low:       blue-400    (#60A5FA)
  Info:      text-secondary  (#94A3B8)

Font: Inter / Geist Sans (UI), Geist Mono / JetBrains Mono (mandatory for IDs, timestamps, coordinates, API keys, currency values, severity scores)
Sizes: 12 / 13 / 14 / 16 / 20 / 24 / 32 (no other sizes)
Weights: 400 / 500 / 600 (no other weights)
Spacing: 4px base — Tailwind defaults
Radii:   4px (chips, badges) / 6px (cards, inputs). No radii larger than 6px in the operational suite.
```

### Borders, not shadows

- Card and panel separation uses thin borders (`border border-[#1E2530]`).
- **Shadows are disabled in the operational suite.** Do not use Tailwind's `shadow-*` utilities anywhere in the dashboard, alerts, watchlist, or settings pages. Marketing landing page is the only exception (subtle glow on the hero screenshot is allowed).

### Interaction primitives

- **All transitions:** `150ms ease-out`. Do not use longer durations. No spring animations.
- **Buttons and nav items:** `active:scale-95` on press. No other transforms.
- **Hover states:** background shift only (e.g. `hover:bg-surface-2`). No translateY, no shadow lift, no border glow.
- **Focus rings:** 2px accent blue outline, no offset.

### Components

Use shadcn/ui primitives. Don't reinvent. The Syntra-specific components (kept lean) are:
- `<SeverityBadge severity="critical" />`
- `<EntityChip type="supplier" name="..." />`
- `<TimeAgo date={...} />`
- `<MapMarker type="event" severity="..." />`

Command-tier components (added in v1.5, see §17 of the design guide): `<StatusPill>`, `<ComplianceFlag>`, `<ValueExposureBar>`, `<ImpactChain>`, `<RiskScoreDial>`, `<ScenarioCard>`, `<AssigneeAvatar>`, `<HeatmapLegend>`. Total component inventory after v1.5: 12. Resist additions — every new primitive is a tax on consistency.

### Map style

- Use Mapbox `dark-v11` style.
- Custom markers for: events (severity-colored), watchlist entities (type-iconed).
- Cluster events when zoomed out.
- No 3D terrain, no animations on map (performance).

---

## 16.5 Design Tokens — v2 Migration Notes

This subsection exists to document the token migration from the original zinc palette to the v2 navy-charcoal palette, and to lock the rule that coding agents read tokens from a single source of truth.

### Old → New token mapping

| v1 token (zinc) | v1 hex | v2 token (navy-charcoal) | v2 hex | Use |
|---|---|---|---|---|
| `bg-zinc-950` | `#09090B` | `bg-base` | `#0B0E14` | App shell background |
| `bg-zinc-900` | `#18181B` | `bg-surface` | `#151921` | Cards, panels, sidebar |
| `bg-zinc-800` | `#27272A` | `bg-surface-2` | `#1E2530` | Borders, hairlines, hover states |
| `bg-zinc-700` | `#3F3F46` | `bg-surface-3` | `#262C36` | Input fields, code blocks |
| `bg-zinc-600` | `#52525B` | `text-disabled` | `#475569` | Disabled controls |
| `text-zinc-50`  | `#FAFAFA` | `text-primary`   | `#FAFAFA` | Headings, primary copy *(value unchanged)* |
| `text-zinc-400` | `#A1A1AA` | `text-secondary` | `#94A3B8` | Labels, captions |
| `text-zinc-500` | `#71717A` | `text-muted`     | `#64748B` | Timestamps, disclaimers |

Severity colors, accent blue, font choices, type scale, and spacing scale are **unchanged** between v1 and v2. Only the neutral palette shifted from pure-gray zinc to navy-tinted slate.

### Sidebar width — v1 → v2

- v1: 224px (`w-56`).
- v2: **256px (`w-64`).** Apply everywhere — §11.1 dashboard shell, settings, onboarding, Command-tier screens.

### Token authority rule

All implementations import design tokens from `packages/ui/tokens.ts`. **Do not hardcode hex values, Tailwind color classes, spacing literals, radii, or transition durations in module code.** The token file is the canonical mirror of `syntra_design_guide.md` §2–5. Modifying it requires a CCR (it is a contract surface — see orchestration doc §6).

The supervisor agent's per-cycle scan (orchestration §5.2 step 1f) greps for legacy zinc tokens and flags any branch that hardcodes them. This is enforcement, not guidance.

### Existing screen specs are unchanged

All ASCII layout sketches in §11 (overview dashboard, alert feed, alert detail, watchlist) and the per-screen prompt blocks in `syntra_design_guide.md` §8 remain valid. Only the underlying token values changed. Do not regenerate screen layouts to "modernize" them — they are already correct under v2 tokens.

---

## 17. Seed Data (for demo + first customers)

### Demo customer (build this first, day 1)

Pick ONE real Indian exporter and build their watchlist properly. Suggested: an Indian pharma exporter to Africa (e.g., Cipla / Sun Pharma scale, but use a smaller fictional analogue if avoiding name conflicts).

Watchlist:
- 12 suppliers across India (Mumbai, Hyderabad, Vadodara, Chennai)
- 4 ports (JNPT, Mundra, Chennai, Cochin)
- 3 routes (India → East Africa via Suez, India → Gulf via Persian Gulf, India → Southern Africa direct)
- 8 destination countries (Kenya, Nigeria, Ghana, South Africa, UAE, Saudi Arabia, Egypt, Tanzania)
- 2 owned assets (warehouse in Nairobi, distribution hub in Dubai)

This watchlist will produce alerts naturally because real events are happening in these regions constantly.

### Templates (for self-serve onboarding)

Build 5 templates:
1. Indian pharma exporter to Africa
2. Indian textile exporter to MENA
3. Indian auto-parts exporter to SE Asia + Eastern Europe
4. Mid-market freight forwarder (India ↔ Gulf)
5. Trade finance bank (Sub-Saharan Africa lending)

Each template = a JSON file with ~30 prebuilt entities. Customer applies → entities cloned into their org → they edit.

---

## 18. Deployment

### Environments

- **Production:** main branch → Vercel (frontend) + Railway (worker) → atlas cluster (existing) + new Upstash Redis
- **Staging:** staging branch → Vercel preview + separate Railway worker → same atlas cluster, staging db
- **Local:** docker-compose for Redis, local Mongo connection to staging DB

### Secrets management

- Vercel env vars for frontend
- Railway env vars for worker
- Never commit `.env` — use `.env.example` with placeholder values
- Rotate all keys quarterly (calendar reminder)

### CI/CD

- GitHub Actions: on PR → typecheck + lint + test → block merge if any fail
- On merge to main → auto-deploy to Vercel + Railway
- Manual gate to production for breaking changes (db migrations)

### Database migrations

- Use a simple migration script (mongo-migrate or custom Node script)
- Migrations run via worker process on startup
- Always additive in v1 (no destructive migrations)

---

## 19. Telemetry

### PostHog events to track

- `signup_completed`
- `org_created`
- `onboarding_step_completed` (with step name)
- `onboarding_completed`
- `watchlist_entity_added` (with type)
- `alert_received` (system-side, dispatched)
- `alert_viewed` (user opens the alert)
- `alert_acknowledged`
- `api_key_created`
- `api_call_made` (sampled — 1 in 100)
- `subscription_started` (with plan)
- `subscription_cancelled`

### Funnels to monitor

1. Signup → first watchlist entity → first alert received → first alert acknowledged
2. Signup → trial → paid conversion
3. API key created → first API call → 100th API call

### Sentry

- Capture all unhandled errors
- Alert to Slack on any error rate spike

---

## 20. Demo Flow (YC video + Canopy)

This is the artifact that matters most. Build the product to support this flow flawlessly.

### 90-second demo script

```
[0:00–0:10] HOOK
"In November 2023, Houthi attacks closed the Red Sea overnight. Mid-market 
exporters lost ₹X cr because they found out 6 hours late from their freight 
forwarders. We built the system that would have told them in 6 minutes."

[0:10–0:25] PROBLEM
"Stratfor and Recorded Future cost $150K a year and sell to Fortune 500 
intelligence teams. The 50,000 mid-market exporters and freight forwarders 
across India and Southeast Asia get nothing — they rely on WhatsApp groups 
and panicked phone calls."

[0:25–1:10] PRODUCT (live demo)
"This is Sundaram Pharma — a real Indian exporter shipping to Africa and 
the Gulf. Here's their watchlist: 12 suppliers, 4 ports, 3 routes, 8 
destination markets."

[click admin → inject event]

"A Houthi missile strike just hit a tanker off Hodeidah. Our system 
matched it against Sundaram's Red Sea route and their Suez-routed 
shipments in 4 seconds."

[show alert appearing in dashboard]
[show email landing in inbox]
[show WhatsApp preview]

"They get an alert with what happened, why it matters to *them* 
specifically, and recommended actions. Same data is available via API 
for their internal systems."

[show curl returning JSON]

[1:10–1:25] TRACTION + ASK
"We have N customers in active pilot conversations, an iDEX defense 
champion fast-tracking us for sovereign contracts, and the underlying 
data infrastructure has been processing 3M+ events for the last 18 
months. We're applying to YC to build the data layer every supply chain, 
insurance, and trade finance product will embed."
```

### What the demo MUST show working perfectly

- The injection → alert appearance pipeline (rehearse 20 times)
- Email landing in inbox during the recording
- The dashboard rendering without flicker
- The API curl returning real JSON
- The map smoothly zooming to event location

### Build the "demo mode" toggle

- A flag on the seeded demo org that reduces matching cron from 5 minutes to 5 seconds
- A dedicated injection endpoint that creates an event + immediately runs matching for one org
- This is the only way the demo flows in real time on video

---

## 21. Pricing & Positioning

(See §14 for prices.) Public positioning:

- **Tagline:** "Real-time geopolitical risk for everyone Stratfor doesn't sell to."
- **Subhead:** "Watchlist-driven alerts, multi-channel, API-first. Built for mid-market exporters, freight forwarders, and trade finance teams."
- **Three-line pitch:**
  - Geopolitical events affect your shipments hours before you hear about them.
  - We monitor 200+ sources in real time and alert you only when *your* watchlist is affected.
  - Email + WhatsApp + API. ₹15K/month. 14-day free trial.

### Landing page sections

1. Hero with the tagline + "Start free trial" CTA + screenshot
2. The problem (3 stats, no fluff)
3. How it works (3 steps with mini-screenshots)
4. Pricing (3 cards)
5. Who it's for (4 personas with one-line descriptions)
6. API preview (one curl + JSON response)
7. FAQ (8 questions)
8. CTA repeat
9. Footer (about, contact, status, docs)

No testimonials section in v1 (we don't have any yet — fake ones will sink credibility).

---

## 22. Repo Structure

Single monorepo. Turborepo not needed — pnpm workspaces is enough.

```
syntra/
├── apps/
│   ├── web/                    # Next.js dashboard + landing + API routes
│   │   ├── app/
│   │   │   ├── (marketing)/    # public landing
│   │   │   ├── (auth)/         # login, signup
│   │   │   ├── app/[orgSlug]/  # org-scoped dashboard
│   │   │   ├── admin/          # admin panel
│   │   │   └── api/v1/         # public REST API
│   │   ├── components/
│   │   ├── lib/
│   │   └── ...
│   └── worker/                 # Node.js cron + dispatcher
│       ├── src/
│       │   ├── cron/matching.ts
│       │   ├── workers/dispatch.ts
│       │   ├── workers/cleanup.ts
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── db/                     # mongoose models + connection
│   ├── shared/                 # shared types, schemas, utils
│   ├── ui/                     # shadcn components + design tokens
│   │   ├── tokens.ts           # CANONICAL design token source (mirrors syntra_design_guide.md §2-5)
│   │   └── components/         # shadcn primitives + Syntra-specific components
│   └── llm/                    # LLM helpers (recommended actions)
├── specs/                      # this file + per-module specs (see §23)
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 23. Agent Briefs (per module)

For Claude Code / OpenCode, create one spec file per module under `/specs`. Each spec is the only context the agent should need to build that module.

### Required spec files

```
specs/
├── 00-OVERVIEW.md              # link to this doc
├── 01-stack.md                 # §4 expanded
├── 02-data-model.md            # §6 expanded with full Mongoose schemas
├── 03-auth.md                  # §7 + Clerk integration code
├── 04-watchlist.md             # §8 with full UI spec + API spec
├── 05-matching.md              # §9 with pseudocode + 10 test cases
├── 06-alerts.md                # §10 with email template HTML
├── 07-dashboard.md             # §11 with page-by-page wireframes
├── 08-api.md                   # §12 with OpenAPI spec
├── 09-onboarding.md            # §13 with step-by-step flow
├── 10-billing.md               # §14 with Razorpay webhook handler
├── 11-admin.md                 # §15
├── 12-design.md                # Mirror of syntra_design_guide.md. Update when design guide updates. Token table lives here for agent reference. The 8 per-screen prompt blocks (design guide §8) are the canonical visual references.
├── 13-seed-data.md             # §17 with full demo customer JSON
├── 14-deployment.md            # §18 with deploy commands
├── 15-telemetry.md             # §19
├── 16-demo.md                  # §20 with rehearsal checklist
└── 99-DO-NOT-BUILD.md          # §3b — paste at top of every agent session
```

### Agent invocation pattern

For each module:
```
"Build module 04-watchlist per /specs/04-watchlist.md.
Stack is locked per /specs/01-stack.md.
Data model is /specs/02-data-model.md.
DO NOT BUILD anything in /specs/99-DO-NOT-BUILD.md.
Output: working code, type-checked, with tests for the matching logic.
Commit when complete."
```

Constrain hard. Agents drift when the brief is loose.

---

## 23.5 Build Order (Critical Path)

The order matters more than the parts. Build in this sequence, not in the order the sections appear in this doc. Every item below depends on the items above it.

### Pre-build (start tonight, before any code)

These have async lead times — start them now or they will block the build.

1. **Razorpay account KYC** — submit, takes 2–3 business days
2. **Twilio WhatsApp Business API application** — submit, takes 1–2 weeks (sandbox works immediately for dev)
3. **SendGrid account + sender domain authentication** (SPF + DKIM DNS records) — takes 24h to propagate
4. **MongoDB Atlas user + IP whitelist** for the new b2b database
5. **Upstash Redis instance** provisioned
6. **Mapbox account + production token** with URL restrictions
7. **Vercel + Railway + GitHub repo** created and linked
8. **Domain decision + DNS pointed** (suggestion: app.syntra.app)
9. **Clerk account created** (if going Clerk route) and test org created
10. **Sentry + PostHog projects created**, SDK keys saved

### Pre-build content work (also tonight)

11. **Write the YC video script first.** Every sentence becomes a feature requirement. Anything not in the script does not get built. This is the single most important pre-build artifact.
12. **Research the seed demo customer** (one real Indian exporter, full watchlist). 2 hours.
13. **Pick the demo event** (one specific historical event you'll inject during the recording). 30 minutes.
14. **Pre-write 8 realistic alerts** for the seeded customer (use Claude in chat, save as JSON). These populate the dashboard so it never looks empty in screenshots or recordings.
15. **Generate dashboard mockups** using `syntra_design_guide.md` §8 per-screen prompt blocks. Use Stitch / Claude Design / v0. Generate 2–3 variants per screen, pick the strongest, save to `/specs/design-mockups/{screen-name}.png`. These mockups become the visual references coding agents compare their output against. v2 tokens (navy-charcoal, `w-64` sidebar) are baked into the prompt blocks — do not reskin v1 zinc mockups, regenerate from the v2 prompt blocks.
16. **Write per-module spec files** (§23) — at minimum the first 6 (stack, data model, auth, watchlist, matching, dashboard).

### Build phase — sequencing

The dependency graph is roughly:

```
        ┌── 1. Foundations ──┐
        │                     │
        ▼                     ▼
   2. Data + Auth      3. Design System
        │                     │
        └──────┬──────────────┘
               ▼
        4. Watchlist CRUD
               │
               ▼
        5. Matching Engine ◄── (read-only existing Warfront events)
               │
               ▼
        6. Alert Dispatch ──► SendGrid + WhatsApp sandbox + Webhook
               │
               ▼
        7. Dashboard (overview + alerts + alert detail)
               │
        ┌──────┴──────┐
        ▼             ▼
   8. Admin       9. Public API
   Panel          + API Keys
        │             │
        └──────┬──────┘
               ▼
        10. Onboarding Flow + Templates
               │
               ▼
        11. Billing (Razorpay)
               │
               ▼
        12. Telemetry wiring
               │
               ▼
        13. Landing Page + API Docs
               │
               ▼
        14. Demo Mode + Injection Tool
               │
               ▼
        15. Polish + Rehearsal + Recording
```

### Build phase — module-by-module

For a 5-day window with aggressive agent leverage, here's the order with rough effort weight (S/M/L/XL):

| # | Module | Effort | Blocks | Parallel-safe with |
|---|---|---|---|---|
| 1 | **Foundations:** Next.js scaffold, deploy hello-world to Vercel, Tailwind, shadcn, repo structure | S | Everything | — |
| 2 | **Data layer:** Mongoose models, DB connection, indexes, Upstash Redis wired up | S | 4, 5, 6 | 3 |
| 3 | **Design system:** color tokens, typography, base components (SeverityBadge, EntityChip, TimeAgo, MapMarker) | S | 7, 8, 13 | 2 |
| 4 | **Auth + multi-tenancy:** Clerk integration, org-scoped routing, role middleware | M | 7, 8, 9, 10 | — |
| 5 | **Watchlist CRUD:** UI tabs per type, geocoding via Mapbox, CSV upload | M | 5, 7 | — |
| 6 | **Matching engine:** worker process scaffold, cron, matching algo, 10 test cases passing | L | 6 (alerts), demo | — |
| 7 | **Alert dispatch:** BullMQ queue, SendGrid template + send, WhatsApp sandbox send, webhook POST, idempotency | L | 7 (dashboard), demo | 8 |
| 8 | **Dashboard pages:** /overview, /alerts, /alerts/[id], /watchlist | L | demo | 9 |
| 9 | **Public API:** routes, API key auth, rate limiting, OpenAPI generation | M | 13 (docs) | 8 |
| 10 | **Admin panel + injection tool:** /admin/* routes, manual event injection (CRITICAL FOR DEMO) | M | demo | — |
| 11 | **Onboarding wizard:** steps 1-5, templates, demo alert at end | M | first-customer flow | — |
| 12 | **Billing:** Razorpay subscription create, webhook handler, plan enforcement | M | paying customers | — |
| 13 | **Telemetry:** PostHog event wiring, Sentry init, structured logs | S | — | — |
| 14 | **Landing page + API docs:** marketing page, /docs route with Mintlify or Scalar | M | first-signup flow | — |
| 15 | **Polish + rehearsal:** seed data load, run demo flow 20 times, fix every glitch, record YC video | L | shipping | — |

### Critical-path priority (if you have to cut)

If you fall behind, cut in this order (drop the bottom items first):

**Must-have for v1 launch + demo:**
- Foundations, Data, Design System, Auth, Watchlist, Matching, Alert Dispatch (email at minimum), Dashboard, Admin Panel + Injection Tool, Polish + Rehearsal

**Important but cuttable to post-launch:**
- WhatsApp dispatch (use UI preview screenshot instead)
- Webhook dispatch
- Public API + docs (mention in pitch, ship in week 2)
- Onboarding wizard (manual onboarding for first 10 customers)
- Billing (manual Razorpay invoice for first 5 customers)
- Templates
- Landing page (single static page is fine for v1)

**Cut without remorse if needed:**
- Telemetry (add post-launch)
- Quiet hours
- Acknowledgement notes
- Forward-to-team
- API docs site (one README with curl examples is enough)

### Parallelization

If you have two builders working in parallel (you + your friend, or you + multiple agent sessions), parallel-safe pairs:

- Modules 2 + 3 (data + design)
- Modules 8 + 9 (dashboard + API)
- Modules 11 + 12 (onboarding + billing)
- Modules 13 + 14 (telemetry + landing page)

Do NOT parallelize modules 5 + 6 — alert dispatch depends on matching producing real alerts. Do NOT parallelize module 6 + 7 with anything that touches data schemas — race conditions on schema changes will burn hours.

### Rules during build

1. **Never start a new module until the previous one passes its acceptance test.** Half-done modules accumulate into unshippable mess.
2. **Commit at every module boundary.** If a module breaks, you can revert cleanly.
3. **The injection tool (#10) is a hard gate.** If you can't trigger an alert manually for the seeded demo customer by end of module 10, stop and fix it before continuing. Without it, the demo doesn't work.
4. **Rehearse the demo flow at end of each day.** Even if half-broken, run through it. You'll catch issues early.
5. **Last 20% of time is for polish.** Don't compress this. The difference between landing the demo and not is in the last 20%.

### Honest expectation

A 5-day window with aggressive agent leverage realistically gets you through modules 1–10 cleanly + 11–14 in a partial / polished-enough state + module 15. Modules 9 (full API), 11 (full onboarding wizard), and 14 (full landing page) will likely be 60–70% of what you'd want at v1 launch. That's fine for the YC video and Canopy demo. Customer-ready polish on these comes in week 2.

---

## 24. Definition of Done (v1)

The build is "done" when all of the following are true:

- [ ] Live URL deployed to production with custom domain
- [ ] Anyone can sign up, create an org, add 5 watchlist entities, and receive a real alert from real Warfront events within 1 hour
- [ ] Razorpay subscription works end-to-end (test mode is fine for v1 launch, switch to live once first customer signs)
- [ ] WhatsApp sandbox alert delivered to a test number
- [ ] All 10 matching test cases pass
- [ ] API key works: can curl `/api/v1/events` and get JSON
- [ ] Admin injection tool works: click button → alert delivered to seeded demo org
- [ ] 90-second demo recording works without retakes (rehearsed end-to-end successfully 5 times)
- [ ] Sentry capturing errors, PostHog capturing events
- [ ] Landing page deployed at root domain with all sections from §21
- [ ] Public API docs deployed at `/docs`
- [ ] At least one external person (not the founders) successfully signs up and reaches "received first alert" without help

---

## 25. Post-v1 Roadmap (NOT for the 5-day build)

Listed here so the agents do not preemptively build:

- Slack integration (proper, not just webhook)
- Microsoft Teams integration
- Multi-tier supplier mapping
- Custom severity scoring per customer
- Scenario simulation
- LLM-based natural language watchlist queries ("alert me about anything affecting Suez")
- Mobile app
- Hindi UI
- USD pricing + Stripe
- SOC 2 prep
- White-label
- Embed widget for customer's own dashboards
- Connector marketplace (SAP, Oracle, Zoho)

---

## Appendix A — Open Decisions (resolve day 1, do not block build)

1. **Auth provider:** Clerk vs Auth.js — pick based on Clerk free-tier limits at expected v1 scale
2. **Domain name:** decide before deployment (suggestion: `app.syntra.app` — domain TBD, see §0.1 below)
3. **Razorpay account:** must exist and be KYC-verified before billing works (can take 2–3 days — start now)
4. **WhatsApp Business API approval:** start Twilio process day 1, will likely not be live by demo (use sandbox + screenshot)
5. **SendGrid sender domain authentication:** SPF + DKIM setup required for inbox delivery (do day 1)
6. **MongoDB Atlas IP whitelist:** add Vercel + Railway IPs day 1
7. **Mapbox token:** create production token with URL restrictions

## Appendix B — Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp Business API not approved by demo | High | Medium | Use sandbox + UI preview screenshot |
| SendGrid emails go to spam during demo | Medium | High | Authenticate domain + use a warmed-up sender |
| Matching cron silently fails on Railway | Medium | High | Sentry alert + heartbeat ping to internal Slack |
| Existing Warfront events DB schema changes | Low | High | Read-only access + Zod schema validation on read |
| Razorpay subscription bugs in v1 | Medium | Medium | Manual invoicing fallback for first 5 customers |
| Demo flow breaks on recording day | Medium | Critical | Build admin injection tool day 1, rehearse 20+ times |
| Customer churns because alert quality is poor | High | High | Manual analyst review of first 100 alerts per customer |

---

## Appendix C — What Success Looks Like at End of 5 Days

- Live, paying-customer-ready product at a real URL
- One real seeded demo customer (researched, watchlist populated)
- Clean 90-second demo recording for YC video
- Slide deck for Canopy presentation built around the same flow
- Public landing page driving signups
- Admin tooling to onboard first 10 customers in week 2
- API documentation live
- The two founders confident enough in the product to give a live walkthrough to any potential customer or investor on Zoom

---

*End of plan. Hand to agents. Build. Ship.*

---

# PART II — BEYOND v1: SYNTRA COMMAND-TIER MODULES

> **Read first.** Everything from §0–§25 above is **v1: 5 days, ship the wedge**. Do not cross-contaminate the two scopes. If you are in the 5-day build window, close this doc here and do not read further. The post-v1 sections below describe what comes after the v1 wedge is in market — *not what gets built during the 5-day window*.

---

## 26. Strategic Frame — "Better Than Palantir, For The Companies Palantir Won't Sell To"

### 26.1 Honest comparison

| Dimension | Palantir Foundry / Gotham | Syntra (Command tier, v1.5+) |
|---|---|---|
| Target customer | F500, sovereign, defense | Mid-market enterprises, ₹50cr–₹5,000cr revenue |
| Deal size | $1M–$100M+/year | ₹50K–₹50L/month (≈ $7K–$70K/year) |
| Time to first value | 6–18 months (with FDEs) | 24–72 hours self-serve |
| Deployment model | Forward-deployed engineers + on-prem options | Self-serve SaaS + concierge for first 50 |
| Data integration | Custom ontology, slow setup | Pre-built sector templates, CSV/ERP connectors |
| Decision intelligence | Strong (war-gaming, AIP) | Match where it matters (scenarios, VaR, sanctions) — skip what mid-market doesn't need |
| Real-time event ingestion | Generally batched, customer-supplied | **Native moat** — 3M+ events processed; existing Warfront data layer |
| API-first | API exists but is secondary | API is the product surface |
| Verticalization | Horizontal platform | Vertical (trade, supply chain, frontier markets) |
| Ecosystem | Closed, contractor-led | Open API + connector marketplace |

### 26.2 Where we don't pretend

- **We are not replacing Palantir at the DOD or F500.** Their forward-deployed engineering org is a real moat that we cannot replicate in 12 months. State that explicitly in any conversation with investors. Lying about this gets caught fast.
- **We are not building an ontology layer for v1.5.** Multi-tier supplier graphs (§27.1) are a *constrained* graph, not a general-purpose ontology framework. That's correct — building a Foundry-grade ontology engine is a multi-year project and not the wedge.
- **We are not chasing classified workflows.** "Secure multi-stakeholder workspace" features (suggested by some of the LLM proposals) get deferred to v2.5+ when there is a defense customer ready to pay for it. Building it speculatively wastes 8–12 weeks.

### 26.3 Where we win

- **Time to value:** Hours, not months. Self-serve onboarding + sector templates + automated watchlist ingestion.
- **Price floor:** Mid-market budgets without procurement-committee theater.
- **Real-time event truth:** The existing Warfront ingestion stack is the moat the Foundry platform never had — pre-built, geo-tagged, multi-source-corroborated event data. This is a 3+ year head start no Palantir customer has on day 1.
- **Vertical depth:** Pre-built supply chain ontology for the sectors we serve (pharma, textiles, auto, freight, trade finance) ships in v1.5.
- **AI-native:** Post-v1 features assume LLM-in-the-loop everywhere (scenarios, briefs, NL queries, alternative-route suggestions). Palantir's AIP is bolted on; ours is the substrate.

### 26.4 The expansion narrative for buyers and investors

Three Syntra tiers, three buyer conversations. **Same product, same data layer, tier-gated features:**

- **Syntra Trade (v1):** "Real-time geopolitical alerts for your watchlist." → Head of Ops. ₹15K–₹50K/mo. Self-serve. The wedge.
- **Syntra Command (v1.5):** "Operational risk system of record for cross-border businesses." → COO + Head of Supply Chain + Compliance. ₹2L–₹10L/mo. Sales-assisted. The expansion.
- **Syntra Foundry-class (v2):** "Decision intelligence + compliance automation + supplier control across your entire trade lifecycle." → CEO + Board. ₹25L–₹1Cr/mo. Sales-led + concierge. The Palantir-class outcome at one-tenth the cost and one-fifth the time-to-value.

One product (Syntra). Three tiers. Three sales motions. The same MongoDB collections power all three; v1.5 and v2 features are gated by org-level feature flags, not separate codebases or separate brands.

---

## 27. Post-v1 Module Roadmap (Synthesized From Six Independent Reviews)

These features were proposed across six independent technical reviews (llm01, llm002, lm03, llm04, llm05, llm06). Features that appeared in three or more reviews are surfaced as **Tier A — the moat**. Features appearing in two reviews are **Tier B — strong differentiators**. Single-review features are **Tier C — specialized, build only when a paying customer asks**.

### 27.1 Tier A — Build first after v1 ships (weeks 2–10)

These six features are what convert v1 from "alerting tool" into "operational risk system of record."

#### Module 16 — Multi-Tier Supplier Graph
**Mentioned by:** llm06, llm04, llm05
**Effort:** L (8–12 days)
**Tier gating:** Growth + Enterprise

Extend `watchlist_entities` with `tier: 1|2|3` and `parent_entity_id: ObjectId | null`. Customer can upload (or have us research) tier-2 / tier-3 supplier relationships. When the matching engine fires, the alert payload includes the **impact propagation chain** — "Event in Yemen → affects tier-2 supplier in Djibouti → which feeds your tier-1 supplier in Mumbai → affecting your shipments to Kenya." This is the data moat: each customer that contributes their supplier graph compounds the network value, and reproducing it requires a parallel decade of customer relationships.

**What changes in the data model:**
```typescript
// watchlist_entities — additions
{
  tier: 1 | 2 | 3,
  parent_entity_id: ObjectId | null,
  relationship_type: "raw_material" | "component" | "finished_good" | "logistics" | null,
  criticality: 1 | 2 | 3 | 4 | 5,    // 5 = single-source, no substitute
}

// new collection: supply_paths
{
  _id: ObjectId,
  org_id: ObjectId,
  path: ObjectId[],   // ordered list of entity IDs from raw material → customer
  primary_product: string,
  monthly_volume_estimate: number | null,
  monthly_value_estimate_inr: number | null,
}
```

**Matching extension:** when an event matches a tier-2 entity, propagate up the `parent_entity_id` chain and include all ancestors in the alert.

**UI:** new "Supply Graph" view (see Design Guide §17, Screen 9) — DAG visualization with severity-colored impact propagation.

#### Module 17 — Sanctions & Compliance Engine
**Mentioned by:** llm01, llm04, lm03, llm05
**Effort:** M (5–7 days)
**Tier gating:** Growth + Enterprise

Cross-reference all watchlist entities + counterparties against OFAC SDN, UN Security Council Consolidated List, EU Restricted Parties, UK HM Treasury, India MEA restricted lists, and (where available) regional defense restricted-party lists.

- Periodic sync (daily) from public sources via worker cron — store a versioned `sanctions_lists` collection in Mongo
- Match algorithm: name + alias + country + DOB-where-applicable, with fuzzy match (Levenshtein + soundex hybrid; we are not building a custom NER for this)
- New alert type: `compliance_alert` (separate from physical risk alerts), severity always = "critical" when a watchlist entity hits a sanctions list
- Audit trail: every screening run is logged with (`entity_id`, `list_version`, `matched: bool`, `match_score`, `screened_at`) for legal defensibility
- Alert content includes the specific list, the entry, and a link to the public source

**Why this is a Palantir differentiator:** Foundry has compliance modules but they're configured custom per customer over months. We ship pre-wired with the lists pre-loaded. This is the single fastest path from "alerting tool" to "compliance defensibility tool" — and trade finance teams *cannot* operate without this once they've used it.

#### Module 18 — Incident Workflow & Triage System
**Mentioned by:** llm06, llm002, llm01, lm03
**Effort:** M (5–7 days)
**Tier gating:** Starter + (basic) | Growth + (full)

Convert alerts from notifications into a system of record:

- Add to `alerts` schema: `status: "new" | "investigating" | "mitigated" | "accepted_risk" | "false_positive"`, `assignee_user_id`, `comments: [{user_id, body, created_at}]`, `attachments: [{filename, url}]`, `resolution_note: string`, `resolved_at: Date`
- New page: `/app/[org]/alerts/[id]` adds a right-hand "Activity" panel — comments, status changes, assignee changes, audit log
- Alert email/Slack/Teams now includes "Assign to me / Mark investigating / Forward to team" interactive buttons
- New view: `/app/[org]/alerts?view=triage` — kanban-style swimlanes by status, like Linear
- SLA timers per status: e.g., "Critical alerts unassigned > 30 minutes" triggers escalation to org owner

**Why this is sticky:** once a customer is running their geopolitical incident response through Syntra for 30 days, the audit trail of resolutions becomes a compliance artifact they can't migrate off without losing their entire incident history. This is the lock-in mechanism Palantir uses at the F500 level; we use the same mechanism at the mid-market level.

#### Module 19 — Scenario Planner / War-Gaming Simulator
**Mentioned by:** llm05, llm04
**Effort:** L (10–14 days)
**Tier gating:** Growth + Enterprise

The signature Palantir feature, ported to mid-market scope:

- New page `/app/[org]/scenarios` — user defines a hypothetical event (Suez closed 14 days, Iran sanctions tightened, Indo-Pak airspace closed, cyclone in Bay of Bengal, port strike in Hamburg)
- Worker re-runs matching against a synthetic event with the user's parameters
- Output: list of affected entities, projected severity, estimated VaR exposure (uses Module 21), LLM-suggested mitigations + alternative routes (uses Module 22)
- Scenarios are saveable, shareable (read-only links), and re-runnable monthly
- Pre-built scenario library: top 20 scenarios by sector (Indian pharma exporter, MENA freight forwarder, etc.)

**Implementation note:** v1.5 scenarios are deterministic — single hypothetical event applied against current state. Monte Carlo / stochastic scenarios are v2 work; do not let an agent reach for `numpy` and start building a probabilistic engine. The 80/20 of decision value comes from "what if this *one* thing happens" not "1,000 simulated trajectories."

#### Module 20 — Risk Heatmap & Portfolio Exposure Dashboard
**Mentioned by:** llm002, llm04, lm03
**Effort:** M (4–6 days)
**Tier gating:** All paid tiers (basic) | Growth+ (advanced)

- New homepage panel: dynamic risk score per org (0–100), per sector, per region, per route
- Score formula (v1.5 — keep stupid): weighted sum of (active alerts × severity weight) + (entity density in hot zones) + (historical match frequency last 90 days)
- Mapbox heatmap layer on the overview map: red intensity = current risk density per region
- Drill-down: click a region → list of contributing alerts + entities at risk
- Time-series chart (Recharts): risk score trend over last 90 days
- Compare to peers (anonymized): "Pharma exporters in your size bracket: median 42, you: 67"

**Why this is critical:** the v1 dashboard is reactive ("here's what just happened"). The heatmap is proactive ("here's how exposed you are right now, regardless of whether anything is happening"). This is what executives look at; it's what gets shown in board meetings; it's what justifies the renewal.

#### Module 21 — Value-at-Risk (VaR) & Financial Exposure Engine
**Mentioned by:** lm03, llm04
**Effort:** M (5–7 days)
**Tier gating:** Growth + Enterprise

- Allow users to attach financial values to entities: average monthly shipment value per route, average PO value per supplier, asset value per warehouse
- When alert fires, aggregate financial exposure: "Event affects 3 entities — estimated stalled value: ₹4.2 Cr ± ₹1.1 Cr"
- New panel on alert detail: "Estimated impact" with confidence interval
- New view: `/app/[org]/exposure` — total VaR across all watchlist, broken down by region/route/supplier

**Why this matters more than it sounds:** the Ops Head can't get budget for Syntra without escalating to the COO. The COO doesn't care about "an alert near Hodeidah" — they care about "₹4.2 Cr of stalled cargo." VaR is the language of the buyer above your buyer. It collapses the sales cycle.

### 27.2 Tier B — Build in months 3–6

#### Module 22 — Alternative Route / Mitigation Suggestion Engine
**Mentioned by:** lm03 (also overlaps with llm04's enhanced "recommended actions")
**Effort:** M (4–6 days)

When a route or port is compromised, LLM + spatial query suggests alternatives in the alert payload: "Red Sea closed → fallback: Cape of Good Hope (+12 days, ~+18% freight cost), nearest unaffected port: Salalah, Oman."

Use a static dataset of major shipping lanes + ports + transit-time matrices (open data exists). LLM picks alternatives + writes the prose. Cache per (event, route, scenario) tuple.

#### Module 23 — Native Slack & Microsoft Teams Integration
**Mentioned by:** llm06, llm002
**Effort:** M (5 days for Slack, 4 days for Teams)

OAuth-based app installs (not just webhook). Block Kit / Adaptive Cards with interactive buttons (`Acknowledge`, `Assign to me`, `Forward`, `Mark investigating`). Two-way sync — actions taken in Slack/Teams sync to Syntra's incident workflow.

This is Tier B not Tier A only because the v1 webhook is a usable workaround for 3 months. After Module 18 (incident workflow) ships, this is the highest-leverage integration to build next — buyers live in Slack, not in our dashboard.

#### Module 24 — Custom Severity Scoring & Per-Entity Rules
**Mentioned by:** llm06, llm002
**Effort:** S (3–4 days)

Per-entity override rules: "for our Red Sea route, alert me on `severity ≥ low`; for everything else, `severity ≥ high`." Per-entity channel routing, per-entity quiet hours, per-entity escalation paths.

UI: rules panel on each watchlist entity detail page. Engine: rules layer evaluated after match-detection, before dispatch. Org-level defaults remain; entity rules override.

#### Module 25 — Scheduled Risk Digests
**Mentioned by:** llm002, llm01
**Effort:** S (2–3 days)

Daily 8am digest, weekly Monday digest, monthly board-ready digest. Configurable cadence per org. Content: alerts since last digest, severity heatmap delta, watchlist health (entities with no nearby events vs. entities in active hot zones), recommended next steps.

This is the daily-habit lever. Even when nothing critical is happening, the customer opens Syntra because the digest landed in their inbox. v1 is purely reactive; this turns it routine.

#### Module 26 — Risk Brief Generator (PDF + Shareable Public Link)
**Mentioned by:** llm06, llm002, llm01
**Effort:** M (4–5 days)

One-click "Generate brief" button on alert detail. LLM produces a 1-page structured PDF (org logo, severity summary, what happened, why it matters to your operations, recommended actions, status of mitigation, sources). Also exposes a 7-day-valid public read-only URL ("share with your customer / your bank / your board").

This is the network effect feature: every shared link is a marketing surface, and stakeholders who read it want their own login.

#### Module 27 — Natural-Language Watchlist Query
**Mentioned by:** llm06, llm04
**Effort:** M (3–5 days)

A search/chat input: "Alert me about anything affecting shipments from Mumbai to East Africa via Suez" or "Track our top 20 suppliers in MENA." LLM parses → structured filter rules → saved as a "Smart Watchlist" entity. Show the parsed translation for confirmation.

This is a UX moat. The Foundry equivalent is "ask your forward-deployed engineer" — slow, expensive, ours is instant and self-serve.

### 27.3 Tier C — Build only when a paying customer asks

These appear in single reviews and are genuinely valuable but should not pre-empt Tier A/B. Each is a 1–3 week project; build only when at least one Growth or Enterprise customer has it as a top-3 ask.

| # | Feature | Source | Effort | When to build |
|---|---|---|---|---|
| 28 | AIS / vessel position correlation | llm01 | L | When 5+ freight forwarder customers ask |
| 29 | ERP connectors (Zoho → Tally → SAP B1) | llm01 | XL each | When concierge onboarding becomes the bottleneck |
| 30 | Auto vendor / 3PL status ping | lm03 | M | When incident workflow (M18) is mature |
| 31 | Historical risk heatmap (procurement overlay) | lm03 | S | After Module 20 ships and procurement teams ask |
| 32 | AI Negotiation / Contract Redline Agent | llm05 | XL | Defer until a procurement-tier customer signs ≥ ₹10L/mo |
| 33 | Asset Lifecycle Management | llm05 | XL | Defer indefinitely — adjacent product, not core wedge |
| 34 | Secure Multi-Stakeholder Workspace (classified) | llm05 | XL | Defer until a defense / sovereign customer is in-cycle |

### 27.4 Explicit non-goals (still)

These appeared in the LLM proposals or are tempting adjacencies. They are still **NOT being built** in the v1.5 / v2 scope without an explicit revisit:

- ❌ Custom on-premise / air-gapped deployment (until a sovereign customer signs a ≥ $250K/year deal)
- ❌ White-label (until 3+ customers ask)
- ❌ Custom ML models for entity extraction (LLM is fine; do not start training BERT-class models)
- ❌ Knowledge graph / general ontology engine (constrained supply graph in M16 only)
- ❌ Mobile-native app (responsive web is enough through v2)
- ❌ Multi-region active-active deployment (single region is fine until ≥ ₹5Cr ARR)
- ❌ A second buyer segment or a "while we're at it" adjacent product

If an agent proposes anything from this list, the answer is still **no**.

---

## 28. Updated Build Sequence (Post-v1)

### 28.1 Phase map

```
v1 (5 days)             — Wedge.   Modules 1–15. Already specced above.
v1.1 stabilization      — Week 2.  Bug-bash, onboard first 5 paying customers manually,
                                    fix matching false positives.
v1.5 Command (8–12 wks) — Modules 16–21 (Tier A) — six features = the Palantir-class moat.
v1.7 Expansion (4–6 wks) — Modules 22–27 (Tier B).
v2 Sector Depth (3+ mo) — Modules 28–34 (Tier C, gated by customer pull).
```

### 28.2 Build order within v1.5 (Tier A)

Order matters. Build in this sequence:

| Phase | Modules | Why this order |
|---|---|---|
| 1 (wks 2–4) | M17 Sanctions + M18 Incident Workflow | Lowest implementation risk, highest immediate revenue defense (compliance + workflow stickiness). Start here while v1 is still stabilizing. |
| 2 (wks 4–7) | M16 Multi-tier Supplier Graph + M20 Risk Heatmap | M16 unlocks the data moat narrative; M20 unlocks the executive buyer. Build in parallel — they touch different schemas. |
| 3 (wks 7–10) | M21 VaR + M19 Scenario Planner | M21 is the financial-impact language; M19 reuses M21 + M16 for the "what if" experience. M19 must come after M16 because tier propagation feeds scenarios. |

### 28.3 Build order within v1.7 (Tier B)

| Phase | Modules | Parallel? |
|---|---|---|
| 4 (wks 11–13) | M23 Slack/Teams + M25 Digests | Yes — independent surfaces |
| 5 (wks 13–15) | M22 Mitigation Suggestions + M24 Custom Severity Rules | Yes — different code paths |
| 6 (wks 15–17) | M26 Risk Brief Generator + M27 NL Watchlist Query | Yes — both LLM-orchestration features, same prompt-eng infra |

### 28.4 Updated Definition of Done (v1.5 — "Command" tier launch)

The v1.5 release is "done" when all of the following hold:

- [ ] All six Tier A modules (M16–M21) deployed to production behind feature flags
- [ ] At least 3 paying v1 customers upgraded to Growth tier with M16+M17+M18 enabled
- [ ] Sanctions list sync running daily without intervention for 14 consecutive days
- [ ] Multi-tier supplier graph: at least 1 customer has uploaded ≥50 supplier relationships and we have observed at least 5 alerts that propagated through the graph
- [ ] Risk heatmap loads in <2s on dashboard for a customer with 500 entities
- [ ] VaR figures present on alert details for any customer who has populated financial values
- [ ] One scenario playthrough recorded as a customer demo asset
- [ ] No regression on v1 metrics: alert-dispatch latency stays <30s p95, matching cron stays <60s

### 28.5 Definition of Done (v2 — "Foundry-class moat")

Soft target — define when v1.7 is shipping. Rough acceptance criteria:

- 50+ paying customers, ≥10 on Enterprise tier
- API powering at least 3 third-party integrations / partners
- One reference customer who publicly says "we replaced our [Stratfor/Dataminr/internal team/etc.] with Syntra Command"
- A documented "pilot in 30 days" sales motion that reliably converts

---

## 29. Parallel Sub-Agent Orchestration Playbook

> **Audience:** Whoever is operating Claude Code, OpenCode, Cursor agents, Aider, or any other coding agent harness against this codebase. The goal is to build v1.5 in 8–12 weeks of calendar time using ≈ 4–8 weeks of agent-execution time, by parallelizing aggressively.

### 29.1 The core principle

**Modules are parallel-safe if and only if they do not share a write surface.**

A "write surface" is:
- The same file
- The same database collection schema (additive writes from two agents simultaneously is fine; *both* changing the same field is not)
- The same API route file
- The same shared package's exported type

If two modules share a write surface, they must run serially or be re-decomposed until they don't.

### 29.2 Parallel-safe partition for v1.5

Tier A modules grouped into parallel-safe waves:

```
WAVE 1 (run all four in parallel — different write surfaces)
├── M17 Sanctions Engine        (new collection: sanctions_lists, new alert subtype)
├── M18 Incident Workflow       (additions to alerts collection only)
├── M20 Risk Heatmap            (new collection: risk_scores, new dashboard panel)
└── M21 VaR Engine              (additions to watchlist_entities for value, new exposure view)

WAVE 2 (depends on WAVE 1 — must run after)
├── M16 Multi-tier Supplier Graph   (depends on M21 schema for value propagation)
└── M19 Scenario Planner             (depends on M16 + M21)
```

Wave 1 = 4 agents in parallel for ~7–10 days each = ~10 days wall-clock.
Wave 2 = 2 agents in parallel for ~10–14 days = ~14 days wall-clock.
Total v1.5 wall-clock: **3.5–4 weeks** if execution is clean. Plan for 6–8 weeks accounting for review, integration, and the second-order issues that always emerge.

### 29.3 The contract pattern (mandatory, do not skip)

Before spawning *any* parallel work, the **lead agent** (or you, manually) creates a `/specs/contracts/` directory containing immutable contract files that all parallel agents read but *none* of them write to. These files are the canonical source of truth that prevents schema collisions.

```
specs/contracts/
├── 00-data-model.contract.ts        # All Mongoose schemas. Single source of truth.
├── 01-api-routes.contract.ts        # All public + internal API route signatures (Zod).
├── 02-events.contract.ts            # Internal event bus / queue payload shapes.
├── 03-feature-flags.contract.ts     # Feature flag names + types.
├── 04-shared-utils.contract.ts      # Shared utilities: haversine, geocoding, dispatch keys.
└── README.md                        # "Modify only via a contract change request — see §29.7"
```

Each contract file is plain TypeScript with `export type` declarations and zero runtime code. Agents `import type { ... } from '@/contracts/...'` and write *implementations* against the contracts. If an agent needs to extend a contract, it does so via a contract change request (§29.7) — it does **not** silently modify the contract file from inside its own module.

### 29.4 The git-worktree pattern

Each parallel agent runs in its own git worktree, off main:

```bash
# Once, per module:
git worktree add ../syntra-m17 -b feature/m17-sanctions origin/main
git worktree add ../syntra-m18 -b feature/m18-incident-workflow origin/main
git worktree add ../syntra-m20 -b feature/m20-risk-heatmap origin/main
git worktree add ../syntra-m21 -b feature/m21-var-engine origin/main
```

Each worktree is a separate working directory on disk. You launch one Claude Code session per worktree. They cannot collide on filesystem state. When a module is done, it submits a PR to main; the lead agent reviews + merges; other module worktrees pull main and rebase.

### 29.5 The supervisor agent

In addition to the per-module agents, run **one supervisor agent** in a separate Claude Code session whose only job is:

1. Reading the latest commit from each worktree's branch every hour (or on push)
2. Running typecheck + tests across the unified main + all open branches in a temporary merge
3. Detecting contract-file drift (any agent that touched `/specs/contracts/*` without a contract change request → flagged)
4. Posting status + blockers to a single `/reports/supervisor-log.md` file
5. NEVER writing application code

The supervisor's prompt:

```
You are the supervisor agent for Syntra Command (v1.5). You do not write
application code. Your only responsibilities:

1. Every 30 minutes, run `git fetch --all` and check the diff on every
   branch matching feature/m*. For each branch:
     a. Run `pnpm typecheck` against a hypothetical merge of all branches.
     b. Run `pnpm test` for that branch's modules.
     c. Check whether any file in /specs/contracts/ was touched. If yes,
        verify a corresponding /specs/contract-changes/{module}-{n}.md exists.

2. Append a one-line status per branch to /reports/supervisor-log.md:
     [timestamp] [branch] [tests] [typecheck] [contracts-touched] [notes]

3. If a branch is failing for >2 consecutive checks, flag it:
     - Open /reports/blockers/{branch}.md with the failure output.
     - Do not attempt to fix. Wait for the lead human or per-module agent.

4. If two branches modify the same file in /apps/web/app/api/v1/* or
   /apps/web/app/(app)/[orgSlug]/* you flag a merge collision early.

You write only to /reports/. You read everything. You do not run agents
on other modules; you only observe.
```

### 29.6 Per-module agent prompt template

For each Tier A module, the agent prompt is:

```
ROLE: You are the implementation agent for Module M{N} — {Module Name}.

CONTEXT:
  - Read /specs/00-OVERVIEW.md
  - Read /specs/99-DO-NOT-BUILD.md (every session, before any code)
  - Read /specs/{N}-{module-slug}.md (your spec)
  - Read /specs/contracts/00-data-model.contract.ts and any contract
    file your spec references.
  - Read /reports/supervisor-log.md for current state of other modules.

CONSTRAINTS:
  - You may write only inside these paths:
      apps/web/app/(app)/[orgSlug]/{module-route}/**
      apps/web/app/api/v1/{module-route}/**
      apps/web/components/{module-slug}/**
      apps/worker/src/jobs/{module-slug}/**
      packages/db/models/{module-slug}.ts
      tests/{module-slug}/**
  - You may NOT modify /specs/contracts/* directly.
  - If you need a new contract type or a contract change, write a contract
    change request to /specs/contract-changes/{module}-{seq}.md and STOP.
    Wait for human approval before continuing.
  - You may NOT touch any other module's files. If you think you need to,
    write a /reports/cross-module-request/{from}-to-{to}.md and STOP.

ACCEPTANCE CRITERIA (in spec):
  {paste the module's acceptance criteria}

WORKFLOW:
  1. Plan: write /reports/plan-{module}.md before any code. List files
     you will create, files you will modify, tests you will write.
  2. Implement.
  3. Test: every change has an associated unit test or integration test.
     `pnpm test` must pass before commit.
  4. Typecheck: `pnpm typecheck` must pass before commit.
  5. Commit at every logical step with imperative messages. Push frequently.
  6. When acceptance criteria pass: write /reports/done-{module}.md and stop.

DO NOT:
  - Attempt to "improve" the design system, routing, or stack.
  - Add new dependencies without writing a /reports/dep-request/{n}.md.
  - Re-implement utilities that already exist in /packages/shared.
  - Commit code that does not pass typecheck + tests.
  - Mark a task done without writing /reports/done-{module}.md.

If at any point you are unsure: STOP. Write your question to
/reports/questions/{module}-{seq}.md. Do not guess.
```

### 29.7 Contract change request protocol

When a module needs to extend a shared contract:

```
File: /specs/contract-changes/m17-001.md

# Contract Change Request — M17 Sanctions Engine

## What needs to change
Add a new optional field to the `Alert` type in `00-data-model.contract.ts`:

  alert_subtype: "physical_risk" | "compliance" | "operational" | null

## Why
The M17 sanctions engine produces alerts that are categorically different
from physical-risk alerts. UI needs to render them differently (different
icon, different color, different "Why this matters" panel). This requires
a discriminator field on the Alert type.

## Backward compatibility
- Optional + nullable.
- Default null = treat as "physical_risk" (legacy v1 behavior).
- No migration needed for existing alerts.

## Affected modules
- M17 (writes the new value)
- M18 (reads it for triage filtering)
- M19 (must be aware in scenario simulations)
- Dashboard (renders subtype icon)

## Approval needed from
- Lead human (Maya)

STATUS: AWAITING APPROVAL — DO NOT MERGE
```

Lead reviews → approves → updates the contract file → notifies all in-flight worktrees to rebase.

This is bureaucratic on purpose. The cost of slowing one agent down for a few hours is much lower than the cost of two agents silently disagreeing on a schema and discovering it during integration.

### 29.8 Specific orchestration recipes

**Claude Code (terminal):**

```bash
# Open four terminal panes, one per worktree:
cd ../syntra-m17 && claude

# In Claude Code, paste the per-module prompt from §29.6 with M=17.
# Repeat in panes 2, 3, 4 with M=18, 20, 21.

# Pane 5 = supervisor:
cd ../syntra && claude

# Paste supervisor prompt from §29.5.
```

**Claude Code (with /agents subagent):**

```
> /agents
> Create supervisor agent: [paste §29.5 prompt]
> /agents
> Create m17-implementer: [paste §29.6 prompt with M=17]
> # ... repeat for 18, 20, 21
```

Each subagent has its own context window — they don't pollute each other. Claude Code routes sub-tasks via the Task tool. Do NOT spawn more than 4 parallel implementer subagents in one Claude Code instance — beyond that, supervisor cycles starve.

**OpenCode / Cursor agents:** same pattern, different harness. Each agent gets its own workspace. Use the same contract files + worktree pattern.

**Aider:** less natural for parallel work because Aider is interactive and single-threaded by design. Use Aider for the *contract change reviews* (human-paced) rather than for the parallel module work itself.

### 29.9 Integration day cadence

Every 5 working days, regardless of module progress:

1. **Freeze** all per-module agents (post a `/reports/integration-freeze.md`)
2. **Rebase** every active branch onto main
3. Run **full integration test suite** — supervisor agent generates the report
4. Triage failures: contract collisions get logged as contract change requests; logic collisions get assigned to the responsible module agent
5. **Merge cleared modules** to main
6. **Unfreeze** — agents resume

Integration day is non-negotiable. Skipping integration day is how 4 weeks of parallel agent work becomes 6 weeks of merge-conflict hell.

### 29.10 What goes wrong and how to recover

| Failure mode | Symptom | Recovery |
|---|---|---|
| Two agents both extend the same Mongoose schema differently | Typecheck fails on integration day | Both submit contract change requests retroactively; lead picks one and the other rebases |
| Agent silently modifies `/specs/contracts/*` | Supervisor flags it within 30 min | Revert that commit; agent re-submits as a contract change request |
| Agent invents a new dependency not in the lockfile | Build fails on Vercel | Reject the dep; ask agent to use existing tooling; if genuinely needed, lead approves |
| Agent declares "done" but acceptance criteria don't pass | `done-{module}.md` exists but tests still fail in supervisor log | Reopen the module; agent retries; if 3 retries, escalate to human |
| Agent drifts into v2 features without permission | Spec says M17, code includes M28-style ERP connector | Revert; agent re-reads `99-DO-NOT-BUILD.md`; if drift recurs, kill that agent's session and restart from last clean commit |
| Two parallel agents both touch the same React component | Merge conflict on integration day | Re-decompose: split the component into per-feature subcomponents; each agent owns one |

### 29.11 Honest expectations on parallel agent throughput

- **Linear throughput of one agent on one module:** roughly 60–80% of an experienced solo developer on the same module, at 2–3× wall-clock speed (because the agent doesn't tire, doesn't context-switch, doesn't go to lunch).
- **Effective parallel throughput with 4 agents + supervisor + integration discipline:** roughly 2.5–3.5× a single agent working serially. Not 4× — coordination overhead, integration time, and contract-change reviews eat the rest.
- **Gain over a single solo developer working serially:** roughly 5–7× wall-clock time on the v1.5 scope, conditional on you (the human) running the integration discipline. Drop the discipline → drop the multiplier to roughly 1.5–2×.

The parallel agent multiplier is *real but conditional*. The condition is the contract+supervisor+integration-day discipline. Without that, parallelism actively destroys throughput because integration becomes the new critical path and is much slower than the original work would have been.

---

## 30. Updated Spec File Structure (v1.5)

```
specs/
├── 00-OVERVIEW.md                  # link to this doc
├── 01-stack.md                     # §4
├── 02-data-model.md                # §6 + new collections from §27
├── 03-auth.md                      # §7
├── 04-watchlist.md                 # §8
├── 05-matching.md                  # §9
├── 06-alerts.md                    # §10
├── 07-dashboard.md                 # §11
├── 08-api.md                       # §12
├── 09-onboarding.md                # §13
├── 10-billing.md                   # §14
├── 11-admin.md                     # §15
├── 12-design.md                    # §16 + new screens (Design Guide §17)
├── 13-seed-data.md                 # §17
├── 14-deployment.md                # §18
├── 15-telemetry.md                 # §19
├── 16-demo.md                      # §20
├── 17-multi-tier-suppliers.md      # M16 (NEW)
├── 18-sanctions-engine.md          # M17 (NEW)
├── 19-incident-workflow.md         # M18 (NEW)
├── 20-scenario-planner.md          # M19 (NEW)
├── 21-risk-heatmap.md              # M20 (NEW)
├── 22-var-engine.md                # M21 (NEW)
├── 23-mitigation-engine.md         # M22 (NEW)
├── 24-slack-teams-integration.md   # M23 (NEW)
├── 25-custom-severity-rules.md     # M24 (NEW)
├── 26-scheduled-digests.md         # M25 (NEW)
├── 27-risk-briefs.md               # M26 (NEW)
├── 28-nl-watchlist-query.md        # M27 (NEW)
├── contracts/
│   ├── 00-data-model.contract.ts
│   ├── 01-api-routes.contract.ts
│   ├── 02-events.contract.ts
│   ├── 03-feature-flags.contract.ts
│   ├── 04-shared-utils.contract.ts
│   └── README.md
├── contract-changes/               # one file per CCR (see §29.7)
└── 99-DO-NOT-BUILD.md              # §3b + §27.4 — paste at top of every agent session
```

---

## 31. Updated Risk Register (v1.5 specific)

Additions to Appendix B:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sanctions list source format changes (OFAC/UN/EU change export schema) | Medium | High | Schema validation on every sync; hard fail + alert lead human if changed |
| LLM costs balloon when scenario simulator becomes popular | Medium | Medium | Cache scenarios per (org, params) tuple; cap per-org daily LLM spend; degrade to deterministic results when over budget |
| Supplier graph data quality is poor (customers don't know their tier-2 suppliers) | High | Medium | Concierge: we research the first ~50 customers' graphs ourselves; this is a feature, not a bug, until automated-discovery (M28+) is built |
| Multi-tier matching propagation creates alert noise | High | High | Severity damps with each tier hop; configurable per customer in M24 |
| Parallel agent merge conflicts compound | Medium | High | §29.7 contract discipline + integration day cadence (§29.9). If skipped, revert to serial execution. |
| Supervisor agent itself loops or stalls | Low | Medium | Hard timeout per supervisor cycle (5 min); if it stalls, restart it from last log |
| Customer churns because Tier A features are half-shipped behind feature flags for too long | Medium | High | Each Tier A module ships fully or not at all; no "preview" releases to customers; feature flags are for staged rollout, not unfinished work |

---

## Appendix D — Feature Source Map (Six Independent Reviews)

For traceability, the six independent reviews and which features each surfaced:

| # | Source | Multi-tier | Sanctions | Incident WF | Scenarios | Risk Heatmap | VaR | Slack/Teams | Custom Sev | Digests | Briefs | NL Query | Mitigation | AIS | ERP | Vendor Ping | Hist. Heatmap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| llm01 | review #1 | | ✓ | ✓ | | | | | | ✓ | ✓ | | | ✓ | ✓ | | |
| llm002 | review #2 | | | ✓ | | ✓ | | ✓ | ✓ | ✓ | ✓ | | | | | | |
| lm03 | review #3 | | ✓ | ✓ | | | ✓ | | | | | | | | | ✓ | ✓ |
| llm04 | review #4 | ✓ | ✓ | | ✓ | ✓ | ✓ | | | | | ✓ | | | | | |
| llm05 | review #5 | ✓ | ✓ | | ✓ | | | | | | | | | | | | |
| llm06 | review #6 | ✓ | | ✓ | | | | ✓ | ✓ | | ✓ | ✓ | | | | | |
| **count** | | **3** | **4** | **4** | **2** | **3** | **2** | **2** | **2** | **2** | **3** | **2** | **0\*** | **1** | **1** | **1** | **1** |

*\*Mitigation suggestions appear implicitly in llm04's "enhanced recommended actions" but were called out explicitly only by lm03.*

Tier A = features mentioned in 3+ reviews. Tier B = features mentioned in 2. Tier C = single review.

---

## Appendix E — One-Page Cheat Sheet for Coding Agents

Pin this to the top of every Claude Code / OpenCode session for v1.5:

```
═══════════════════════════════════════════════════════════════════
  SYNTRA — COMMAND-TIER MODULES (v1.5) — AGENT CHEAT SHEET
═══════════════════════════════════════════════════════════════════

WHO YOU ARE
  Implementation agent for Module M{N}. You are not a senior
  architect, you are not a product manager. You build what the
  spec says.

BEFORE EVERY EDIT
  1. Read /specs/99-DO-NOT-BUILD.md
  2. Read /specs/{N}-*.md (your module's spec)
  3. Read /specs/contracts/00-data-model.contract.ts
  4. Read /reports/supervisor-log.md for collision warnings

YOU MAY WRITE TO
  - Files inside your module's allowed paths (per spec)
  - /reports/plan-{module}.md (planning)
  - /reports/done-{module}.md (completion)
  - /reports/questions/{module}-{n}.md (when stuck)
  - /specs/contract-changes/{module}-{n}.md (when contract needs change)

YOU MAY NOT
  - Modify /specs/contracts/* directly
  - Touch other modules' code paths
  - Add dependencies without /reports/dep-request/{n}.md
  - Skip tests
  - Mark done without /reports/done-{module}.md

WHEN STUCK
  Stop. Write /reports/questions/{module}-{seq}.md. Wait.

WHEN FINISHED
  All tests pass. Typecheck clean. /reports/done-{module}.md exists.
  No further edits until reviewed.
═══════════════════════════════════════════════════════════════════
```

---

*End of Part II. Hand to agents. Build. Ship. Repeat.*

---

# PART III — SYNTRA OPERATIONAL FOUNDRY

> **Scope:** 39 features approved post-YC-submission, grouped into 11 modules (M28–M38). This is the build-out from "real-time alerting tool" to "operational risk system of record" — the Palantir-equivalent at mid-market scale.
>
> **Window:** Realistic wall-clock with parallel agent execution: 10–14 weeks. With a solo developer working serially: 6+ months. With the full discipline from the orchestration playbook (contract files, supervisor agent, integration days every 5 working days): ~10 weeks.
>
> **Customers first.** Do not build all 11 modules before talking to customers. Ship v1 to 3+ paying design partners in the first 2 weeks. Modules below are prioritized in the order that maximizes "what design partners will actually ask for" based on the buyer-persona analysis in §1, not in alphabetical or technical-dependency order.

---

## 32. Strategic Context — Why These 39

Picked 39 features from a brainstorm of 118. The selection clusters around three moats, plus two operational layers:

**Moat 1 — Trust / Provenance (Theme 1):** Intel Provenance Graph, source reliability, confidence intervals, time-of-knowledge audit, "how we know this" panel. This is the differentiator against AI-generated noise products that will flood this category. Procurement teams *must* see methodology to clear a deal above ₹2L/month.

**Moat 2 — Data / Ontology (Themes 4, parts of 6):** Multi-tier supplier graph, customer graph, asset registry, shipments + POs as first-class objects, contract terms, counterparty risk. This is the Palantir-equivalent — every customer that contributes their operational graph compounds the data moat. The harder it is to leave, the higher the LTV.

**Moat 3 — Decision Intelligence (Themes 3, 7):** VaR + portfolio + exposure delta + concentration metrics + lead-time analytics + predictive alerts + probabilistic forecasting. This is the language of the buyer above your buyer (CFO/COO). Unlocks deal sizes ₹5L+/month.

**Operational layer A — Coverage depth (Theme 6):** Custom sources, Telegram/Discord, satellite imagery, AIS vessel tracking, flight tracking, weather, sanctions, tariffs, regulatory feeds. The "we know things others don't" moat.

**Operational layer B — Workflow + Onboarding + Channels (Themes 5, 8, 9):** Incident workflow, war room, smart digests, rich-card WhatsApp, URL/annual report/CSV onboarding, sector templates. Stickiness + faster time-to-value.

The 11 modules below map to these moats. Modules within the same moat are usually parallel-safe; modules across moats may have dependencies (specifically, M28 Provenance is foundational and many downstream modules read from it).

---

## 33. Module Specifications (M28–M38)

### Module 28 — Intel Provenance Layer

**Features:** #1 Intel Provenance Graph, #2 Source reliability scoring, #3 Confidence intervals on every claim, #6 Time-of-knowledge audit, #7 "How we know this" panel.

**What it unlocks:** The trust moat. Every claim Syntra surfaces is traceable to its sources, methodology, and confidence level. Procurement teams can audit; courts and insurers can verify; the buyer can defend the data internally.

**Data model additions:**

```typescript
// New collection: source_articles
{
  _id: ObjectId,
  url: string,                          // canonical URL of the article
  publication: string,                  // "Reuters", "Al Jazeera", etc.
  publication_domain: string,
  title: string,
  excerpt: string,                      // first 500 chars
  full_text: string | null,             // optional, license permitting
  language: string,                     // ISO 639-1
  published_at: Date,
  ingested_at: Date,
  reliability_tier: "A" | "B" | "C" | "D" | "E" | "F",
  reliability_reason: string,           // human-curated rationale
  bias_disclosure: {
    state_affiliation: string | null,   // e.g. "Iranian state media"
    editorial_lean: "left" | "center" | "right" | "unknown",
    funding_disclosure: string | null,
  } | null,
  hash: string,                         // SHA-256 of canonical form for integrity
}

// New collection: extraction_runs
{
  _id: ObjectId,
  source_article_id: ObjectId,
  extraction_started_at: Date,
  extraction_finished_at: Date,
  pipeline_version: string,             // "syntra-extract-v1.4.2"
  steps: [{
    step: "lang_detect" | "ner" | "geocode" | "classify" | "severity_score",
    duration_ms: number,
    inputs_hash: string,
    outputs: any,                       // step-specific structured output
    confidence: number,                 // 0.0 - 1.0
    model_used: string | null,          // for LLM steps
    failed: boolean,
    error: string | null,
  }],
  resulting_event_id: ObjectId | null,  // null if extraction didn't produce an event
}

// Additions to events collection
{
  // ... existing fields
  source_article_ids: ObjectId[],       // articles that fed this event
  extraction_run_ids: ObjectId[],
  corroboration: {
    source_count: number,
    distinct_publications: number,
    confidence: number,                 // aggregated confidence 0-1
    first_seen_at: Date,                // earliest source publication
    last_seen_at: Date,
  },
  confidence_interval: {                // for severity, location radius, etc.
    severity_lower: "low" | "medium" | "high" | "critical",
    severity_upper: "low" | "medium" | "high" | "critical",
    location_radius_km_p10: number,
    location_radius_km_p90: number,
  },
}

// Additions to alerts collection
{
  // ... existing fields
  knowledge_timestamps: {
    syntra_first_knew_at: Date,         // when we ingested first source
    customer_notified_at: Date,
    publicly_confirmed_at: Date | null, // optional, set later when confirmed
    advantage_minutes: number | null,   // computed: customer_notified - publicly_confirmed
  },
  methodology_summary: string,          // LLM-generated summary of how we know
}

// New collection: source_reliability_dictionary (curated, versioned)
{
  domain: string,
  publication: string,
  tier: "A" | "B" | "C" | "D" | "E" | "F",
  reason: string,
  bias: { ... },
  curator: string,
  curated_at: Date,
  superseded_by: ObjectId | null,
}
```

**Reliability tier rubric (Admiralty Code, Syntra-adapted):**

- **A — Completely reliable.** Wire services with global newsroom standards: Reuters, AP, Bloomberg News, AFP. Government primary sources for their own announcements (OFAC updates, IMO advisories).
- **B — Usually reliable.** Established broadsheets with standards: BBC, Al Jazeera English, NYT, FT, WSJ, The Hindu, Nikkei Asia, Lloyd's List, gCaptain.
- **C — Fairly reliable.** Trade press, regional broadsheets: Maritime Executive, BusinessDay Nigeria, The East African, Hindustan Times.
- **D — Not usually reliable.** Tabloid press, partisan outlets, state media of authoritarian regimes, anonymous Telegram channels.
- **E — Unreliable.** Known disinformation outlets, satire mistaken for news.
- **F — Reliability cannot be judged.** New sources without track record.

**API surface:**

```
GET  /api/v1/alerts/{id}/provenance            — full provenance graph for an alert
GET  /api/v1/events/{id}/sources               — source articles feeding an event
GET  /api/v1/events/{id}/extraction-trace      — step-by-step extraction log
GET  /api/v1/sources/{domain}/reliability      — get reliability tier for a domain
POST /api/v1/sources/reliability/dispute       — customer disputes a tier (manual review)
```

**UI surface:**

- New screen: **Provenance Graph View** (design guide §23, Screen 17). DAG showing alert → events → source articles → extraction steps. Click any node to see metadata.
- New panel on alert detail: **"How we know this"** (design guide §22.X). Expandable section showing methodology, source list with reliability badges, confidence intervals, time-of-knowledge.
- New screen: **Source Reliability Center** (design guide §23, Screen 18). Browse all sources, filter by tier, customer can dispute.
- New badge component: **ReliabilityBadge** (A–F with color and tooltip).
- New badge component: **ConfidenceInterval** (range + uncertainty visualization).

**Dependencies:** None (foundational — many other modules read this).

**Effort:** L+ (12–16 agent days). The largest non-coverage module.

**Cost:** Internal storage growth from extraction logs ~5 GB/month at scale. Negligible API cost — provenance is read-only of existing data.

**Acceptance criteria:**

- [ ] Every alert has a clickable "View provenance" button that opens the graph view
- [ ] Provenance graph renders for any alert in <2 seconds (cached after first render)
- [ ] At least 200 sources catalogued with reliability tiers in seed data
- [ ] Customer can dispute a tier; dispute lands in admin review queue
- [ ] Time-of-knowledge calculated correctly (verified against 10 historical events with known public-confirmation timestamps)
- [ ] "How we know this" panel renders LLM-generated methodology summary in <1 second using cached generation

---

### Module 29 — Decision Log

**Features:** #16 Decision log.

**What it unlocks:** Append-only audit trail of every operational decision the customer's team made in response to alerts. Becomes the post-incident review corpus and the "show me what we did about Suez 2024" artifact for board meetings.

**Data model additions:**

```typescript
// New collection: decisions
{
  _id: ObjectId,
  org_id: ObjectId,
  alert_id: ObjectId | null,            // null if standalone decision
  scenario_id: ObjectId | null,         // null if real-event-driven
  decision_type: "rerouting" | "force_majeure" | "supplier_switch"
                | "hold_shipment" | "accept_risk" | "escalate"
                | "notify_customer" | "claim_filing" | "other",
  decision_summary: string,
  rationale: string,
  decided_by_user_id: ObjectId,
  decided_at: Date,
  affects_entities: ObjectId[],         // watchlist entities affected
  estimated_value_inr: number | null,   // money implications
  actual_outcome: string | null,        // filled in retrospectively
  outcome_recorded_at: Date | null,
  attachments: [{ filename, url, size }],
  tags: string[],
}
```

**API:**
```
GET    /api/v1/decisions                 — list with filters
POST   /api/v1/decisions                 — log a new decision
GET    /api/v1/decisions/{id}            — single decision
PATCH  /api/v1/decisions/{id}/outcome    — record what actually happened
GET    /api/v1/alerts/{id}/decisions     — decisions tied to an alert
```

**UI:** New screen **Decision Log** (design guide §23, Screen 19). Linear-style list, filter by type/date/user, expandable rows. Inline form on alert detail to log a new decision.

**Dependencies:** None.

**Effort:** S (3–4 agent days).

**Cost:** Storage only.

**Acceptance criteria:**
- [ ] Every alert detail page has a "Log decision" inline form
- [ ] Decision log page filters by org, alert, user, type, date range
- [ ] Decisions can have outcomes recorded post-hoc; both the decision and outcome are timestamped immutably
- [ ] Audit log entry created for every decision write (cross-references existing `audit_events` collection)

---

### Module 30 — Financial Exposure Engine

**Features:** #21 VaR per alert, #22 Portfolio exposure dashboard, #23 Daily exposure delta email, #24 Insurance premium modeling, #25 What-if cost calculator, #26 Concentration risk metrics (HHI), #27 Lead-time-at-risk analytics.

**What it unlocks:** Translates risk into rupees. The CFO/COO conversation. Justifies deal sizes in the ₹5L+/month range.

**Data model additions:**

```typescript
// Additions to watchlist_entities (already in M21 from v1 plan, expand)
{
  // ... existing
  monthly_value_inr: number | null,
  asset_value_inr: number | null,
  lead_time_days: number | null,
  alternative_supplier_ids: ObjectId[], // for HHI analysis
}

// New collection: exposures (computed)
{
  _id: ObjectId,
  org_id: ObjectId,
  computed_at: Date,
  computation_window: "current" | "daily_snapshot",
  total_value_at_risk_inr: number,
  confidence_lower_inr: number,
  confidence_upper_inr: number,
  by_region: { region: string, var_inr: number }[],
  by_route: { route: string, var_inr: number }[],
  by_supplier: { entity_id: ObjectId, var_inr: number }[],
  hhi_by_region: number,                // 0-10000
  hhi_by_supplier: number,
  lead_time_at_risk: {
    p50_days: number,
    p90_days: number,
    affected_pos: number,
  },
  active_alert_ids: ObjectId[],
}

// New collection: exposure_deltas (daily)
{
  _id: ObjectId,
  org_id: ObjectId,
  date: Date,
  var_yesterday_inr: number,
  var_today_inr: number,
  delta_inr: number,
  delta_pct: number,
  drivers: [{ event_id: ObjectId, contribution_inr: number, narrative: string }],
}

// New collection: insurance_models (per org)
{
  org_id: ObjectId,
  current_coverage_inr: number,
  current_premium_annual_inr: number,
  carrier: string | null,
  recommended_coverage_inr: number,
  recommended_coverage_rationale: string,
  premium_estimate_low_inr: number,
  premium_estimate_high_inr: number,
  last_computed_at: Date,
}
```

**API:**
```
GET  /api/v1/exposure/current               — point-in-time portfolio exposure
GET  /api/v1/exposure/by-dimension          — breakdown by region/route/supplier
GET  /api/v1/exposure/concentration         — HHI scores
GET  /api/v1/exposure/lead-time-at-risk     — LTaR analytics
GET  /api/v1/exposure/deltas?days=30        — historical deltas
GET  /api/v1/exposure/insurance-model       — premium modeling output
POST /api/v1/exposure/what-if               — run a what-if calc with custom params
```

**Cron jobs:**
- Daily at 00:30 IST: snapshot all org exposures into `exposures` collection
- Daily at 06:00 IST: compute deltas, queue 23.x digest emails
- Weekly Sunday 02:00 IST: recompute insurance models

**UI:**
- **Portfolio Exposure Dashboard** (design guide §23, Screen 20) — already partially specced as M20 v1.5; expand
- **Concentration Risk View** (design guide §23, Screen 21) — HHI heatmap by region/supplier
- **Lead-Time-at-Risk panel** on dashboard (design guide §23, Screen 22)
- **What-If Calculator** modal (design guide §23, Screen 23) — accessible from any alert or scenario
- **Insurance Model card** on settings/billing (design guide §23, Screen 24)
- New email template: **Daily Exposure Delta** (design guide §22.X)

**Dependencies:** None (depends on watchlist value fields which were already in v1's M21).

**Effort:** L (10–14 agent days). Multiple sub-features.

**Cost:** Storage; LLM calls for narrative generation in deltas and insurance rationale (~₹2/org/day). FX rate API (free tier on exchangerate.host or open.er-api.com).

**Acceptance criteria:**
- [ ] All 7 features deliverable from a single dashboard surface
- [ ] Daily exposure delta computed and emailed to org owners by 08:00 IST customer timezone
- [ ] HHI computed correctly against fixture supplier portfolio (3 known cases)
- [ ] What-if calculator returns results in <2 seconds for any scenario in pre-built library
- [ ] Insurance premium estimates within ±20% of broker-quoted ranges for 5 fixture customer profiles

---

### Module 31 — Operational Ontology

**Features:** #31 Multi-tier supplier graph, #32 Customer concentration graph, #33 Asset registry, #34 Shipment objects, #35 PO-level tracking, #36 Contract terms ingestion, #37 Counterparty risk scoring, #40 Bulk import via natural language.

**What it unlocks:** The Palantir-equivalent data layer. Every customer's full operational graph as queryable, joinable, alert-able first-class objects. Once a customer has 200+ entities + 50+ shipments + their contracts loaded, churn is functionally impossible.

**Data model additions:**

```typescript
// Major refactor: watchlist_entities becomes a discriminated union
// (or keep as-is and add specialized collections below)

// New collection: assets (owned infrastructure)
{
  _id: ObjectId,
  org_id: ObjectId,
  asset_type: "warehouse" | "distribution_hub" | "office" | "plant"
            | "vessel_owned" | "vehicle_fleet" | "other",
  name: string,
  location: { lat, lng, country, region },
  value_inr: number | null,
  capacity: { unit: string, value: number } | null,
  active: boolean,
  metadata: Record<string, unknown>,
}

// New collection: shipments
{
  _id: ObjectId,
  org_id: ObjectId,
  shipment_ref: string,                 // customer's internal ref
  status: "planned" | "loaded" | "in_transit" | "delivered" | "delayed" | "lost",
  origin: { entity_id: ObjectId, port: string, lat, lng },
  destination: { entity_id: ObjectId, port: string, lat, lng },
  current_position: { lat, lng, timestamp } | null,  // populated by AIS module if linked
  vessel: { name, imo, mmsi } | null,   // null if not maritime
  flight: { number, registration } | null,  // null if not air
  contents_summary: string,
  value_inr: number,
  insured_value_inr: number | null,
  insurance_policy_number: string | null,
  customer_id: ObjectId | null,
  po_ids: ObjectId[],
  estimated_arrival: Date,
  actual_arrival: Date | null,
  alerts_history: ObjectId[],
}

// New collection: pos (purchase orders)
{
  _id: ObjectId,
  org_id: ObjectId,
  po_number: string,
  customer_id: ObjectId | null,
  supplier_id: ObjectId | null,
  status: "draft" | "issued" | "in_production" | "shipped" | "delivered" | "closed" | "cancelled",
  value_inr: number,
  currency: string,
  fx_locked_at_inr_rate: number | null,
  expected_delivery: Date,
  actual_delivery: Date | null,
  shipment_ids: ObjectId[],
  contract_id: ObjectId | null,
  line_items: [{ sku, description, quantity, unit_price_inr }],
  force_majeure_triggered: boolean,
  force_majeure_event_ids: ObjectId[],
}

// New collection: counterparties (extends watchlist_entities or replaces)
{
  _id: ObjectId,
  org_id: ObjectId,
  type: "supplier" | "customer" | "broker" | "carrier" | "insurer" | "bank" | "regulator" | "joint_venture" | "other",
  name: string,
  legal_entity_name: string | null,
  jurisdiction: string,
  registration_number: string | null,
  // risk scoring
  risk_score: number,                   // 0-100, computed
  risk_breakdown: {
    financial_health: number,           // from public filings or self-declared
    sanctions_exposure: number,         // from M28/M58
    geopolitical_exposure: number,      // computed from location + active events
    cyber_security: number | null,      // optional, requires self-attestation
    performance_history: number,        // computed from shipments delivered/delayed
  },
  risk_score_history: [{ date, score }],
  parent_entity_id: ObjectId | null,    // for tier-2/3 relationships
  tier: 1 | 2 | 3,
  criticality: 1 | 2 | 3 | 4 | 5,
}

// New collection: contracts
{
  _id: ObjectId,
  org_id: ObjectId,
  counterparty_id: ObjectId,
  contract_type: "supply" | "service" | "logistics" | "insurance" | "credit" | "lease" | "other",
  effective_date: Date,
  expiry_date: Date | null,
  document_url: string,
  document_text: string,                // extracted text
  // LLM-extracted clauses
  extracted_clauses: {
    force_majeure: { text, scope, notice_period_days, cure_period_days } | null,
    lead_time: { commitment_days, penalty_per_day_inr } | null,
    termination: { notice_period_days, conditions } | null,
    payment_terms: { net_days, currency } | null,
    quality: { spec_reference, penalty_terms } | null,
    confidentiality: { scope, term_years } | null,
    governing_law: { jurisdiction, dispute_resolution } | null,
    [other_clause: string]: unknown,
  } | null,
  extraction_confidence: number,         // 0-1, LLM reported
  extraction_run_id: ObjectId,           // ref to M28
  human_verified: boolean,
  metadata: Record<string, unknown>,
}

// New collection: graph_edges (relationships between any entities)
{
  _id: ObjectId,
  org_id: ObjectId,
  from_collection: string,               // "watchlist_entities" | "shipments" | "pos" | etc.
  from_id: ObjectId,
  to_collection: string,
  to_id: ObjectId,
  edge_type: "supplies" | "ships_via" | "owned_by" | "insured_by" | "depends_on"
           | "alternative_to" | "subsidiary_of" | "transports" | "covers",
  weight: number,                        // 0-1, importance
  metadata: Record<string, unknown>,
}
```

**Why graph_edges as a separate collection:** the relationships are the value, not the nodes. Mongo's join performance on a flat edges collection (with proper compound indexes on `(org_id, from_id, edge_type)` and `(org_id, to_id, edge_type)`) is acceptable for graphs up to ~50K edges per org. For larger, use an aggregation pipeline + caching.

**API:**
```
# Counterparties (extends existing watchlist endpoints)
GET    /api/v1/counterparties
POST   /api/v1/counterparties
GET    /api/v1/counterparties/{id}/risk-profile
GET    /api/v1/counterparties/{id}/relationships

# Assets, shipments, POs (full CRUD)
GET    /api/v1/assets, POST, PATCH, DELETE
GET    /api/v1/shipments, POST, PATCH, DELETE
GET    /api/v1/pos, POST, PATCH, DELETE

# Graph
GET    /api/v1/graph/{entity_type}/{id}/upstream
GET    /api/v1/graph/{entity_type}/{id}/downstream
GET    /api/v1/graph/path?from={id}&to={id}
POST   /api/v1/graph/edges
DELETE /api/v1/graph/edges/{id}

# Contracts
GET    /api/v1/contracts
POST   /api/v1/contracts/upload         — multipart, triggers extraction
GET    /api/v1/contracts/{id}
GET    /api/v1/contracts/{id}/clauses
PATCH  /api/v1/contracts/{id}/clauses/{clauseKey}  — human override

# Bulk NL import
POST   /api/v1/import/natural-language  — body: { text, intent_hint }
                                           returns: extracted entities for confirmation
POST   /api/v1/import/confirm           — confirms and creates entities
```

**UI:**
- **Multi-Tier Supplier Graph** (design guide §23, Screen 25) — DAG visualization
- **Customer Concentration Graph** (design guide §23, Screen 26) — sister to supplier graph
- **Asset Registry** (design guide §23, Screen 27) — table + map
- **Shipment Tracker** (design guide §23, Screen 28) — list + per-shipment detail with map and AIS overlay if linked
- **PO Tracker** (design guide §23, Screen 29) — table with status pipeline
- **Counterparty Risk Center** (design guide §23, Screen 30) — risk scores, risk history charts, drill-in
- **Contract Library** (design guide §23, Screen 31) — list + per-contract detail with extracted clauses panel
- **Bulk NL Import** (design guide §23, Screen 32) — paste a paragraph, see extracted entities highlighted, confirm

**Dependencies:** Builds on existing watchlist; depends on M28 for contract extraction provenance.

**Effort:** XL (18–24 agent days). The single largest module. Strong candidate to split into 31a (entities — assets, shipments, POs, counterparties), 31b (graph), 31c (contracts + NL import).

**Cost:** LLM calls for contract extraction (~₹50–200 per contract depending on length) and NL import (~₹2 per import).

**Acceptance criteria:**
- [ ] Sundaram Pharma seed expanded with: 12 tier-1 suppliers, 25 tier-2 suppliers, 4 owned assets, 8 customers, 30 shipments, 60 POs, 5 contracts
- [ ] Contract upload extracts force majeure clause within 60 seconds, with confidence score visible
- [ ] Bulk NL import successfully extracts 8+ entities from a paragraph in <10 seconds
- [ ] Graph queries (upstream, downstream, path) return in <500ms for orgs with <500 entities
- [ ] Counterparty risk score visibly updates within 5 minutes of an alert affecting that counterparty

---

### Module 32 — Incident Workflow + War Room

**Features:** #41 Incident workflow, #45 War room mode.

**What it unlocks:** Converts Syntra from notification tool to operational system of record. War room mode handles the once-a-quarter major incident where ops/exec/customer/insurer/broker all need to coordinate.

**Data model additions:**

```typescript
// Extends alerts collection
{
  // ... existing fields including v1.5 status, assignee, comments
  war_room_id: ObjectId | null,
}

// New collection: war_rooms
{
  _id: ObjectId,
  org_id: ObjectId,
  name: string,                          // "Suez closure — March 2026"
  trigger_alert_id: ObjectId,            // the alert that opened it
  associated_alert_ids: ObjectId[],
  status: "open" | "monitoring" | "closed",
  opened_by_user_id: ObjectId,
  opened_at: Date,
  closed_at: Date | null,
  participants: [{
    user_id: ObjectId | null,            // null for external invitees
    email: string,
    role: "owner" | "ops" | "exec" | "customer" | "insurer" | "broker" | "external",
    invited_at: Date,
    last_active_at: Date | null,
  }],
  decision_log: ObjectId[],              // refs to M29 decisions
  action_items: [{
    id: string,
    description: string,
    assigned_to_user_id: ObjectId,
    due_at: Date,
    completed_at: Date | null,
  }],
  chat_messages: [{
    id: string,
    user_id: ObjectId | null,
    sender_email: string,
    body: string,
    sent_at: Date,
    attachments: [{ filename, url }],
  }],
  retrospective: {
    completed: boolean,
    learnings: string | null,
    playbook_updates: string[] | null,
  } | null,
}
```

**API:**
```
POST   /api/v1/war-rooms                  — open a war room
POST   /api/v1/war-rooms/{id}/invite
GET    /api/v1/war-rooms/{id}             — full state
POST   /api/v1/war-rooms/{id}/messages
POST   /api/v1/war-rooms/{id}/action-items
PATCH  /api/v1/war-rooms/{id}/action-items/{itemId}
POST   /api/v1/war-rooms/{id}/close       — triggers retrospective workflow
```

**UI:**
- **Triage Board** (design guide §23, already specced as Screen 11 in v1.5) — extend with war-room indicator
- **War Room** (design guide §23, Screen 33) — dedicated workspace with chat, action items, decision log, participant list, associated alerts panel
- **Post-Incident Retrospective** (design guide §23, Screen 34) — structured form post-close

**Dependencies:** M18 from v1.5 (incident workflow base).

**Effort:** M+ (6–8 agent days).

**Cost:** Negligible. War rooms are infrequent (estimated 1–4/quarter per active org).

**Acceptance criteria:**
- [ ] War room can be spun up from any alert detail page in <3 clicks
- [ ] External invitees (no Syntra account) can participate via signed magic-link URL with scoped permissions
- [ ] Closing a war room triggers a retrospective form; findings auto-link to participating decisions in M29
- [ ] War room page loads in <1.5 seconds including last 100 chat messages

---

### Module 33 — Coverage Expansion (Open Data Sources)

**Sub-module 33a (open data, free or low-cost):**

**Features:** #57 Weather/oceanographic data, #58 Sanctions list real-time monitoring, #59 Tariff/customs change monitoring, #60 Regulatory change feed.

**What it unlocks:** Multi-source corroboration. The "we know things others don't" moat starts here.

**Data model additions:**

```typescript
// New collection: data_feeds (registry of all ingestion sources)
{
  _id: ObjectId,
  feed_type: "weather" | "sanctions" | "tariff" | "regulatory" | "ais" | "flight" | "satellite" | "telegram" | "discord" | "custom",
  name: string,
  provider: string,
  cost_model: "free" | "freemium" | "paid",
  cost_usd_per_month: number | null,
  rate_limit: { requests_per_minute, requests_per_day } | null,
  last_sync_at: Date | null,
  last_sync_status: "ok" | "degraded" | "failed",
  active: boolean,
  config: Record<string, unknown>,
}

// Sanctions: extends existing sanctions_lists collection from v1.5 M17 with versioned entries
// Tariff/customs: new collection
{
  _id: ObjectId,
  jurisdiction: string,
  hs_code: string,
  effective_from: Date,
  expires_at: Date | null,
  rate_pct: number,
  rate_specific_inr: number | null,
  source_url: string,
  ingested_at: Date,
}

// Regulatory: new collection
{
  _id: ObjectId,
  jurisdiction: string,
  category: "export_control" | "import_ban" | "sanctions"
          | "environmental" | "labor" | "data_privacy" | "other",
  title: string,
  summary: string,
  effective_date: Date,
  source_url: string,
  ingested_at: Date,
  affects_industries: string[],          // SIC/NIC codes
}
```

**Specific data sources:**
- **Weather:** Open-Meteo (free), NOAA (free), JTWC tropical cyclone advisories (free)
- **Sanctions:** OFAC SDN (XML, free), UN Consolidated (XML, free), EU Restrictive Measures (XML, free), UK HM Treasury (CSV, free), India MEA restricted parties (manual)
- **Tariff:** WTO Tariff Download Facility (free), country-specific gazettes (free, scraped)
- **Regulatory:** Federal Register (US, free), EUR-Lex (EU, free), India Gazette (free), country-specific scrapers

**Cron schedule:**
- Weather: every 15 minutes for active alert regions
- Sanctions: 4× daily
- Tariff: daily
- Regulatory: daily

**Effort:** M (5–7 agent days).

**Cost:** Free.

---

### Module 34 — Coverage Expansion (Paid Real-Time Feeds)

**Features:** #54 Satellite imagery integration, #55 AIS vessel tracking, #56 Flight tracking.

**What it unlocks:** Verification capability. "Customer's vessel MV Maersk Hyderabad is currently 12 nm from a security incident in the Red Sea" is qualitatively different from text-based alerts.

**Data sources & costs (current public pricing as of build time — verify before signing):**

- **Satellite:** Sentinel Hub (Copernicus, free tier ~5K requests/month, paid €30–€500/month). Planet Labs SkySat ($$$$, only for paying enterprise customers, defer until ₹25L+/month customer asks).
- **AIS:** AISHub (free, lower fidelity), MarineTraffic API (~$300–$1500/month), Spire Maritime API ($$$, defer). Start with AISHub free + MarineTraffic for tracked vessels only.
- **Flight:** AviationStack free tier (1K req/month), FlightAware (~$100–$500/month). Start free, upgrade only if customers request.

**Data model additions:**

```typescript
// New collection: vessel_positions (time-series, sparse)
{
  _id: ObjectId,
  vessel_imo: string,
  vessel_mmsi: string,
  position: { lat, lng },
  speed_knots: number,
  heading: number,
  course: number,
  timestamp: Date,
  source: "aishub" | "marinetraffic" | "spire",
}

// New collection: flight_positions (time-series)
{
  _id: ObjectId,
  flight_number: string,
  registration: string,
  position: { lat, lng, altitude_ft },
  speed_knots: number,
  heading: number,
  timestamp: Date,
  source: "aviationstack" | "flightaware",
}

// New collection: satellite_observations (sparse, per-area-of-interest)
{
  _id: ObjectId,
  area_of_interest: { type: "Polygon", coordinates: [[[lng, lat]]] },
  observation_date: Date,
  source: "sentinel_hub" | "planet",
  image_url: string,
  cloud_cover_pct: number,
  detected_changes: [{
    change_type: "vessel_traffic" | "infrastructure" | "fire" | "flood" | "other",
    confidence: number,
    description: string,
    bounding_box: [[lng, lat], [lng, lat]],
  }] | null,
  related_event_ids: ObjectId[],
}

// Extends shipments
{
  // ... existing
  ais_tracked: boolean,
  last_ais_update: { lat, lng, timestamp, speed } | null,
}
```

**Cost discipline (CRITICAL):**

```typescript
// New collection: feed_usage (per-org metering)
{
  org_id: ObjectId,
  feed_type: string,
  date: Date,
  api_calls: number,
  cost_inr: number,
  cap_inr_daily: number,                 // org-level cap
  cap_inr_monthly: number,
}
```

**Cost gating logic:**
- Each feed has a `cap_inr_daily` per org (default ₹500 starter, ₹5K growth, ₹50K enterprise).
- Worker checks cumulative cost before every paid API call. If over cap: skip + log + notify org owner.
- Aggregated cost dashboard at `/admin/feed-costs`.

**API:**
```
GET  /api/v1/shipments/{id}/track          — current AIS/flight position
GET  /api/v1/shipments/{id}/track/history  — time-series, paginated
POST /api/v1/satellite/observe              — request satellite observation for AOI (rate-limited)
GET  /api/v1/feeds/usage                    — org's feed cost breakdown
```

**UI:**
- **Live Vessel Tracker** (design guide §23, Screen 35) — Mapbox with live AIS pins, click for vessel detail
- **Flight Tracker** (design guide §23, Screen 36) — same pattern, smaller scope
- **Satellite Observation View** (design guide §23, Screen 37) — image viewer with detected-change overlays
- **Feed Usage Dashboard** (design guide §23, Screen 38, admin-only) — cost monitoring per feed per org

**Dependencies:** M31 (shipments must exist as first-class objects to track).

**Effort:** L (10–14 agent days). Multiple integrations + cost-gating discipline.

**Cost:** $300–$2000/month at launch (mostly MarineTraffic). Monitored per-org and capped.

**Acceptance criteria:**
- [ ] Customer can opt-in any shipment to AIS tracking; positions update every 30 minutes
- [ ] Vessel-position feed cost per org never exceeds plan cap (verified with simulated heavy-usage org)
- [ ] Satellite observation request returns within 5 minutes for AOI-flagged events
- [ ] Admin dashboard shows real-time feed costs per org with per-feed breakdown

---

### Module 35 — Coverage Expansion (Community & Custom Sources)

**Features:** #51 Custom source ingestion, #53 Telegram/Discord channel monitoring.

**What it unlocks:** Customer-specific intelligence. The freight forwarder's WhatsApp group, the ground contact's Telegram, the trade body's Discord. Compounding moat — every customer that adds private feeds enriches the whole.

**Critical disclaimer:** Telegram/Discord channel monitoring requires user opt-in, channel admin permission (where applicable), and explicit ToS compliance. Some channels prohibit automated reading; respect that. Build the *capability* with strong gating, not the *circumvention*.

**Data model additions:**

```typescript
// Extends data_feeds with type: "custom" or "telegram" or "discord"
{
  feed_type: "custom" | "telegram" | "discord",
  name: string,
  config: {
    // for custom feeds (RSS, JSON API, scraper)
    url: string | null,
    auth: { type: "none" | "bearer" | "basic", token: string | null } | null,
    schedule_cron: string,
    extraction_template: string | null,    // JSONPath or selector

    // for Telegram
    bot_token: string | null,
    channel_username: string | null,
    channel_id: number | null,

    // for Discord
    bot_token: string | null,
    server_id: string | null,
    channel_ids: string[] | null,
  },
  added_by_user_id: ObjectId,
  added_for_org_id: ObjectId,             // private to org or shared if null
  reliability_tier: "A" | "B" | "C" | "D" | "E" | "F" | null,
  reliability_assessment_pending: boolean,
  active: boolean,
}
```

**API:**
```
POST   /api/v1/feeds/custom               — submit a custom feed
GET    /api/v1/feeds/custom
PATCH  /api/v1/feeds/custom/{id}
DELETE /api/v1/feeds/custom/{id}

# Telegram/Discord — guarded by feature flag, ToS check, and explicit user agreement
POST   /api/v1/feeds/telegram             — submit
POST   /api/v1/feeds/discord              — submit
```

**UI:**
- **Custom Feed Submission** (design guide §23, Screen 39) — form with reliability disclosure, ToS check, schedule
- **Custom Feed Library** (design guide §23, Screen 40) — list of org's custom feeds with health/reliability
- Telegram/Discord screens behind feature flag — implement only when at least one customer asks. Document the spec but don't build until then.

**Dependencies:** M28 for reliability scoring.

**Effort:** M (5–7 agent days) for custom feeds. Telegram/Discord defer to feature-flagged work.

**Cost:** Bot infrastructure if Telegram/Discord active (~₹500/month).

**Acceptance criteria:**
- [ ] Customer can add a custom RSS or JSON API feed via UI in <2 minutes
- [ ] Custom feed runs on schedule, articles flow into source_articles collection
- [ ] Telegram integration disabled by default, enabled only via admin feature flag per org
- [ ] All custom feeds default to reliability tier "F" (cannot be judged) until manually assessed by Syntra editorial

---

### Module 36 — Predictive & Probabilistic Layer

**Features:** #63 Probabilistic forecasting, #68 Customer-specific predictive alerts.

**What it unlocks:** Lead-indicator analytics. "Based on indicators X, Y, Z, your Suez exposure is likely to be impacted in next 14 days." Moves from reactive to proactive.

**Honest engineering note:** True predictive forecasting requires either (a) statistical/ML models trained on historical data, or (b) human-curated leading-indicator dictionaries. For initial v3 build, **use option (b)**. Defer ML training until 12+ months of customer data exist. The LLM can produce probabilistic narratives from rule-based indicators with surprising believability.

**Data model additions:**

```typescript
// New collection: leading_indicators (curated)
{
  _id: ObjectId,
  indicator_name: string,                 // "Iran-Israel rhetoric escalation"
  category: "diplomatic" | "military" | "economic" | "weather" | "political" | "cyber" | "other",
  measurement_definition: string,         // human-readable + structured
  data_sources: string[],                 // which feeds populate it
  current_level: number,                  // 0-1 normalized
  baseline_level: number,
  trend: "rising" | "stable" | "falling",
  threshold_breached: boolean,
  predicted_outcomes: [{
    outcome_event_type: string,
    affected_regions: string[],
    p7d: number,                          // probability over 7 days
    p30d: number,
    p90d: number,
    rationale: string,
  }],
  last_updated_at: Date,
}

// New collection: predictive_alerts (per org, generated)
{
  _id: ObjectId,
  org_id: ObjectId,
  generated_at: Date,
  forecast_window_days: 7 | 30 | 90,
  affected_entity_ids: ObjectId[],
  predicted_event: {
    event_type: string,
    regions: string[],
    severity: string,
    confidence_pct: number,
  },
  contributing_indicators: ObjectId[],
  recommended_actions: string[],
  status: "active" | "materialized" | "deprecated",
  materialized_event_id: ObjectId | null, // set if forecast came true
}
```

**Cron:** Daily 03:00 IST — refresh all indicators, generate predictive alerts per org.

**API:**
```
GET  /api/v1/forecasts/indicators          — current indicator levels
GET  /api/v1/forecasts/alerts              — org's active predictive alerts
GET  /api/v1/forecasts/{id}                — single forecast detail
GET  /api/v1/forecasts/accuracy-history    — Brier score by org over time
```

**UI:**
- **Predictive Alerts Inbox** (design guide §23, Screen 41) — separate from real-time alerts; clearly labeled "FORECAST" with confidence
- **Leading Indicator Dashboard** (design guide §23, Screen 42) — admin-curated dashboard showing current indicator levels
- **Forecast Accuracy Report** (design guide §23, Screen 43) — shows Brier score over time, what we got right, what we got wrong (transparency)

**Dependencies:** M28 (provenance for every forecast), M30 (exposure for impact estimate), M31 (entities to predict against), M33–M35 (indicator data sources).

**Effort:** L (10–14 agent days). The most subjective module.

**Cost:** LLM calls for indicator narrative generation (~₹100/org/day).

**Acceptance criteria:**
- [ ] At least 30 leading indicators curated and live
- [ ] Each org receives a daily predictive-alerts digest at 09:00 IST
- [ ] Forecast accuracy report visible at /forecasts/accuracy with Brier score (transparency)
- [ ] Predictive alerts NEVER use the same UI treatment as real-time alerts (badge: orange "FORECAST" — not red severity)

---

### Module 37 — Channel Depth (Rich WhatsApp + Smart Email Digests)

**Features:** #75 WhatsApp Business with rich cards, #77 Email with smart digests.

**What it unlocks:** Customer experience. Email digest is the daily-habit lever; WhatsApp rich cards reduce alert acknowledgment friction.

**Already partially built in v1.5 M23 (Slack/Teams integration). Extend pattern.**

**Data model additions:**

```typescript
// Extends users / orgs with digest preferences
{
  digest_preferences: {
    daily: { enabled: boolean, time_local: string, timezone: string },
    weekly: { enabled: boolean, day: 0-6, time_local: string },
    monthly: { enabled: boolean, day: 1-28, time_local: string },
    cadence_overrides: { entity_id: ObjectId, cadence: "instant" | "daily" | "weekly" }[],
  },
}

// New collection: digest_runs
{
  _id: ObjectId,
  org_id: ObjectId,
  user_id: ObjectId,
  digest_type: "daily" | "weekly" | "monthly",
  generated_at: Date,
  alerts_summarized: number,
  rendered_html: string,                  // for re-send and audit
  delivered_at: Date | null,
  opened_at: Date | null,
}
```

**Cron:**
- Hourly: check users with daily/weekly/monthly digests due in their local timezone, generate + queue
- Worker: render via React Email + send via SendGrid

**WhatsApp rich cards:** Twilio's WhatsApp Business API supports template messages with header media + buttons. Approved templates needed; submit during build.

**API:**
```
GET   /api/v1/digests/preferences
PATCH /api/v1/digests/preferences
POST  /api/v1/digests/{type}/preview      — preview a digest without sending
POST  /api/v1/digests/{type}/send-now     — manual trigger
```

**UI:**
- **Digest Preferences** in /settings/notifications (design guide §23, Screen 44) — extends existing settings
- **Digest Preview** modal (design guide §23, Screen 45)

**Dependencies:** Existing alert dispatch; M30 for exposure-delta language in digests.

**Effort:** M (5–7 agent days).

**Cost:** SendGrid email volume (~$0.0006/email, negligible). Twilio WhatsApp messages (~₹0.50–₹1 each at scale).

**Acceptance criteria:**
- [ ] User can set distinct cadences per watchlist entity from settings
- [ ] Daily digest delivered within 5 minutes of scheduled time, in user's local timezone
- [ ] WhatsApp template approved via Twilio Business API (or fallback to plain text in sandbox)
- [ ] Digest open rate trackable in admin dashboard (>40% target for daily, >60% for weekly)

---

### Module 38 — PLG Onboarding Pack

**Features:** #81 Onboard from URL, #82 Onboard from annual report, #83 Onboard from CSV, #84 Sector templates.

**What it unlocks:** Time-to-value. Self-serve sign-up to first useful alert in <5 minutes vs. industry-standard 4–8 weeks (Stratfor onboarding).

**#83 CSV and #84 sector templates already partially built in v1. Extend.**

**Data model additions:**

```typescript
// New collection: onboarding_extractions
{
  _id: ObjectId,
  org_id: ObjectId,
  source_type: "url" | "annual_report" | "csv" | "natural_language" | "template",
  source_input: string,                   // URL or filename or paste
  extraction_run_id: ObjectId | null,
  extracted_entities: [{
    type: string,
    name: string,
    location: { lat?, lng?, country? },
    confidence: number,
    source_excerpt: string,
  }],
  user_confirmed_count: number,
  user_rejected_count: number,
  finalized_at: Date | null,
}
```

**API:**
```
POST /api/v1/onboarding/from-url           — body: { url }
POST /api/v1/onboarding/from-pdf           — multipart, annual report
POST /api/v1/onboarding/from-csv           — multipart
POST /api/v1/onboarding/template           — body: { template_slug }
GET  /api/v1/onboarding/extractions/{id}
POST /api/v1/onboarding/extractions/{id}/confirm  — body: { entity_indices_to_create: number[] }
```

**Implementation specifics:**

- **#81 URL onboarding:** Cheerio + headless Chrome for JS-rendered pages. Crawl: homepage + about + suppliers/customers/products pages. Pass concatenated text to Claude Haiku with extraction prompt. Extract: company name, headquarters, key supplier mentions, key customer mentions, product categories, geographic exposure mentions.
- **#82 Annual report:** PDF parsing via `pdf-parse` for text extraction; Claude Haiku extracts geographic exposure section, key suppliers/customers (often in "Risk Factors" or "Operations" sections of 10-K equivalents). Annual reports are 100+ pages — extract section-by-section to fit context.
- **#83 CSV:** Already exists. Extend with column-mapping wizard for non-standard CSVs.
- **#84 Sector templates:** 10 sector templates (extend the v1 5):
  1. Indian pharma exporter to Africa
  2. Textile exporter (India → US/EU)
  3. Auto component supplier (India → ASEAN/EU)
  4. Freight forwarder MENA
  5. Trade finance bank (mid-tier, India)
  6. Edible oil importer (India ← SE Asia)
  7. Spice exporter (India → Global)
  8. IT services (India → US/EU)
  9. Engineering goods exporter (India → MENA/Africa)
  10. Agri-commodity importer (India ← Africa/SAm)

**UI:**
- **Onboard from URL** (design guide §23, Screen 46) — paste URL, see extracted entities, confirm
- **Onboard from Annual Report** (design guide §23, Screen 47) — upload PDF, see extracted entities, confirm
- **CSV Onboarding with Column Mapping** (design guide §23, Screen 48) — extends existing
- **Sector Template Picker** (design guide §23, Screen 49) — 10 cards, click to instantiate

**Dependencies:** M28 (extraction provenance), M31 (entities are now first-class).

**Effort:** L (10–14 agent days).

**Cost:** LLM calls per onboarding run (~₹20–₹100 depending on input size). High-leverage spend — converts free trials.

**Acceptance criteria:**
- [ ] URL onboarding extracts ≥5 entities for any URL with public supplier/customer mentions, in <30 seconds
- [ ] Annual report onboarding extracts ≥10 entities from a 50+ page PDF in <90 seconds
- [ ] CSV onboarding accepts any column layout via wizard mapping
- [ ] All 10 sector templates instantiate a working watchlist + first-alert-within-1-hour test passes

---

## 34. Updated Build Sequence

### Wave plan (parallel-safe partitions)

```
WAVE 1 (4 agents, ~3 weeks wall-clock)
  M28 Intel Provenance Layer     — foundational, must ship first
  M29 Decision Log               — small, parallel-safe
  M30 Financial Exposure Engine  — independent of M28
  M32 Workflow + War Room        — extends existing v1.5 M18

WAVE 2 (3 agents, ~3 weeks wall-clock, depends on M28)
  M31 Operational Ontology       — split into 31a/31b/31c if 3 agents available
  M33 Open-data Coverage         — independent
  M37 Channel Depth              — extends v1.5 M23

WAVE 3 (3 agents, ~3 weeks wall-clock)
  M34 Paid Real-Time Feeds       — depends on M31 shipments
  M35 Community/Custom Sources   — depends on M28
  M38 PLG Onboarding Pack        — depends on M31

WAVE 4 (1 agent, ~2 weeks wall-clock)
  M36 Predictive Layer           — depends on M28 + M30 + M31 + M33

Total realistic wall-clock: 10–14 weeks with discipline.
Total agent-days: ~95–120.
```

### Definition of Done (per module)

Same as v1.5 in §28.4 + per-module acceptance criteria in §33.

### Definition of Done (Operational Foundry as a whole)

- [ ] All 11 modules deployed to production behind feature flags
- [ ] At least 5 paying customers using v1 features in production for ≥30 days before any v3 module ships to them
- [ ] Each v3 module has been used by at least 1 paying customer with feedback recorded
- [ ] Cost monitoring confirms paid-feed costs are <15% of MRR
- [ ] Forecast accuracy (M36) has 90 days of history with Brier score visible
- [ ] At least 1 customer has uploaded a contract via M31 and confirmed the extraction
- [ ] At least 1 war room (M32) has been opened, run, and retrospected by a real customer

---

## 35. Cost Projections (Third-Party APIs at Scale)

Per-org per month costs at full v3 scope (assuming 50-entity watchlist, 5 tracked shipments, 1 contract upload):

| Module | Service | Cost/org/month |
|---|---|---|
| M28 LLM (provenance summaries) | Anthropic Haiku | ₹200 |
| M30 LLM (exposure narratives) | Anthropic Haiku | ₹100 |
| M30 FX rates | exchangerate.host | ₹0 |
| M31 LLM (contract extraction) | Anthropic Sonnet | ₹500–₹2,000 (one-time per contract) |
| M33 weather | Open-Meteo / NOAA | ₹0 |
| M33 sanctions | Public XML | ₹0 |
| M33 tariffs/regulatory | Public sources | ₹0 |
| M34 AIS | MarineTraffic | ₹300–₹2,000 (depends on tracked vessels) |
| M34 satellite | Sentinel Hub | ₹0–₹500 |
| M34 flight | AviationStack | ₹0–₹200 |
| M35 Telegram/Discord bot | Self-hosted | ₹50 |
| M36 LLM (forecasts) | Anthropic Sonnet | ₹300 |
| M38 LLM (onboarding extractions) | Anthropic Haiku | ₹50 (amortized) |

**Total per active org per month: ₹1,500–₹5,500** (₹18–66 USD).

At ₹2L/mo customer revenue, COGS is ~1–3%. Healthy.

At ₹50K/mo Starter customers, COGS is ~3–11%. Acceptable but watch the AIS-tracked-vessel count carefully — that's the variable cost lever.

**Hard caps to enforce in code:**

```typescript
// per-plan defaults; overridable per org
const PLAN_CAPS = {
  starter:   { var_inr_daily: 100,  ais_vessels: 0,  contracts_per_month: 1 },
  growth:    { var_inr_daily: 500,  ais_vessels: 5,  contracts_per_month: 5 },
  enterprise:{ var_inr_daily: 5000, ais_vessels: 50, contracts_per_month: 50 },
};
```

---

## 36. Updated "DO NOT BUILD" List (still — even now)

Even with "no v0/v1/v2" framing, these remain explicit non-goals:

- ❌ Custom on-premise / air-gapped deployment (until a sovereign customer signs a ≥ $250K/year deal)
- ❌ White-label (until 3+ customers ask AND pay extra)
- ❌ Custom-trained ML models for entity extraction (LLM extraction is fine; do not start training BERT-class models without a paying customer demanding it)
- ❌ True ML probabilistic forecasting (M36 uses rule-based + LLM narratives until ≥12 months of customer data exist)
- ❌ Mobile-native app (responsive web is enough through v3)
- ❌ Multi-region active-active deployment (single region — Mumbai or Singapore — is fine until ≥ ₹5Cr ARR)
- ❌ A second buyer segment (insurance underwriters, governments) until current segment is at 50+ customers
- ❌ Crypto-token compute network (yes, brought back from the brainstorm — still no)
- ❌ Auto-trading on insurance derivatives based on alerts (regulatory minefield — no)
- ❌ Government / classified contract pursuit (defer until at least 1 senior team member has cleared experience)

If a coding agent proposes anything from this list, the answer is **no** regardless of technical merit.

---

## 37. First-Customer-Validation Gate

**Critical reminder, repeating from §32:**

Before building Wave 2 modules, **at least 3 paying design-partner customers must be using v1 in production for ≥30 days.** Their feedback drives Wave 2 priority within the modules listed.

Specifically:
- If 3/3 design partners ask for contract ingestion (M31c) before AIS tracking (M34), promote M31c, demote M34.
- If none of them ask for predictive forecasting (M36) but all three ask for war room (M32), accelerate M32.
- If a feature gets zero asks across 3+ customers in their first 30 days, **defer it indefinitely.**

The 39 features in this plan are a *menu*, not a *route*. Customer pull is the route.

Wave 1 (M28, M29, M30, M32) is buildable speculatively — these are foundational and every customer benefits. After Wave 1, the priority within Wave 2/3/4 should be re-ordered by customer pull, not by this document's order.

---

## Appendix F — Mapping of Approved Features to Modules

For traceability:

| # | Feature | Module |
|---|---|---|
| 1 | Intel Provenance Graph | M28 |
| 2 | Source reliability scoring | M28 |
| 3 | Confidence intervals | M28 |
| 6 | Time-of-knowledge audit | M28 |
| 7 | "How we know this" panel | M28 |
| 16 | Decision log | M29 |
| 21 | VaR per alert | M30 |
| 22 | Portfolio exposure dashboard | M30 |
| 23 | Daily exposure delta email | M30 |
| 24 | Insurance premium modeling | M30 |
| 25 | What-if cost calculator | M30 |
| 26 | HHI concentration metrics | M30 |
| 27 | Lead-time-at-risk | M30 |
| 31 | Multi-tier supplier graph | M31 |
| 32 | Customer concentration graph | M31 |
| 33 | Asset registry | M31 |
| 34 | Shipment objects | M31 |
| 35 | PO-level tracking | M31 |
| 36 | Contract terms ingestion | M31 |
| 37 | Counterparty risk scoring | M31 |
| 40 | Bulk NL import | M31 |
| 41 | Incident workflow | M32 |
| 45 | War room mode | M32 |
| 51 | Custom source ingestion | M35 |
| 53 | Telegram/Discord monitoring | M35 |
| 54 | Satellite imagery | M34 |
| 55 | AIS vessel tracking | M34 |
| 56 | Flight tracking | M34 |
| 57 | Weather/oceanographic | M33 |
| 58 | Sanctions monitoring | M33 |
| 59 | Tariff/customs | M33 |
| 60 | Regulatory feed | M33 |
| 63 | Probabilistic forecasting | M36 |
| 68 | Customer-specific predictive alerts | M36 |
| 75 | WhatsApp rich cards | M37 |
| 77 | Smart email digests | M37 |
| 81 | Onboard from URL | M38 |
| 82 | Onboard from annual report | M38 |
| 83 | Onboard from CSV | M38 |
| 84 | Sector templates | M38 |

---

*End of Part III. Build in waves. Listen to customers. Don't build all 39 before talking to anyone who pays.*
