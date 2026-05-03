# YC Readiness Report — Syntra v1
Date: 2026-05-04 | Session 4

---

## What Appears in the Screen Recording

| Screen | What's shown | Real vs Mock |
|--------|-------------|--------------|
| Landing page `/` | Hero, pricing, How it works, FAQ | All static — no credential dependency |
| `/onboarding/org` | Step 1/5 — org name, industry, size | Mongo: real if MONGODB_URI set, else in-memory |
| `/onboarding/watchlist` → `/onboarding/alerts-prefs` → `/onboarding/team` → `/onboarding/demo` | Steps 2–5 | In-memory safe |
| `/app/sundaram-pharma` | Map + 8 seeded alerts sidebar + stat cards | Map: mock gray unless NEXT_PUBLIC_MAPBOX_TOKEN set |
| `/app/sundaram-pharma/alerts` | Feed of 8 alerts, severity filter, status filter | Real Mongo if seeded |
| `/app/sundaram-pharma/alerts/{id}` | Alert detail: why_matters, sources, recommended actions, map | All from seed data |
| `/app/sundaram-pharma/watchlist` | 29 entities, type tabs, map | 29 entities seeded |
| `/admin/inject-event` | 4 live demo presets with Inject Live button | Creates real Event + Alert |
| After inject → `/app/sundaram-pharma` | New alert appears at top of feed | Real if Mongo connected |

---

## 60-Second Demo Script

```
00:00 — Open landing page / in browser. Scroll past hero.
        Point to: "Watchlist-driven alerts in real time. ₹15,000/month."
        Click "View live demo" → /app/sundaram-pharma

00:08 — Dashboard loads. Point to map with watchlist pins and alert sidebar.
        "This is Sundaram Pharma — a pharma exporter to East Africa."
        "Here's their watchlist — 29 entities: suppliers, ports, routes, countries."

00:15 — Click Alerts in sidebar → /app/sundaram-pharma/alerts
        "8 active alerts right now. One critical — Bab-el-Mandeb closure."
        Click the critical alert row.

00:22 — Alert detail loads.
        Point to "Why This Matters To You" panel (contextual LLM text).
        "The AI explains exactly why this event affects their specific supply chain —
        not generic text, their India–East Africa route, their consignment,
        their freight cost impact."
        Point to Sources panel (Reuters, Maritime Executive, Al Jazeera).

00:35 — Navigate to /admin/inject-event
        "Now watch a live alert appear."
        Click "Inject live" on Red Sea Strike preset.
        1.2s later → redirected to /app/sundaram-pharma
        New alert appears at top of the dashboard feed.
        "That ran matching against their watchlist in real time."

00:50 — Back to landing / (or pricing section scroll)
        "₹15,000/month. 14-day free trial. Setup in 5 minutes."
        Click "Start free trial" → /onboarding/org
        Fill name: "Sundaram Pharma", Industry: Pharmaceuticals → Continue

01:00 — End on /onboarding/watchlist ("Set up your watchlist")
```

---

## Credentials: Real vs Mock at Recording Time

| Service | Status | Visible in recording? | Fallback behavior |
|---------|--------|----------------------|-------------------|
| MongoDB | Unknown — fill in .env | Dashboard data | In-memory (data survives until process restart) |
| Mapbox | Unknown — fill in .env | Map tiles on dashboard | Gray placeholder div with "Dashboard preview" text |
| Clerk | Not configured | Sign-up/sign-in flow | Mock — all /app/* accessible without login |
| Anthropic | Not configured | "Why This Matters" text | Seed data has hardcoded contextual text — looks real |
| SendGrid/Twilio | Not configured | Not visible in video | No impact |
| Razorpay | Not configured | Not visible in video | No impact |

**Minimum for recording**: MongoDB + seed data. Mapbox makes the map look real but is optional.

---

## Visible Mock Fingerprints to Avoid

1. **`[MOCK]` lines in terminal** — worker process prints `[MOCK] MONGODB_URI not set` etc. Keep terminal out of frame or use real MONGODB_URI.
2. **Gray map placeholder** — if Mapbox token missing, the map div shows "Dashboard preview" with emoji. Either:
   - Set NEXT_PUBLIC_MAPBOX_TOKEN before recording, OR
   - Record only the alert detail page (which has a small map — if map is blank, zoom past it quickly)
3. **`/app/sundaram-pharma` in URL bar** — this is fine and intentional. Shows the product is real.
4. **`Created_at` timestamps** — alerts created by seed show today's date. The `occurred_at` in the event_snapshot ranges from "4 min ago" to "3 days ago". The dashboard sidebar uses `created_at` for the time display — which will show very recent times. Fine for demo.
5. **Admin basic auth dialog** — if recording `/admin/inject-event`, the browser will show a native Basic Auth dialog. Credentials: `admin` / `syntra-admin` (or whatever ADMIN_USERNAME/ADMIN_PASSWORD is set to). Pre-authenticate before recording.
6. **`app.syntra.app` in mock URL bar** — the hero browser chrome shows `app.syntra.app/app/sundaram-pharma`. This looks polished. Not a mock fingerprint.

---

## Backup Plans

| Failure | Backup |
|---------|--------|
| MongoDB Atlas unreachable | Use in-memory (run `pnpm seed` after starting dev server; data persists until restart) |
| Mapbox token invalid | Skip map — show only alert list + alert detail. Both look great without map. |
| `pnpm dev` won't start | Vercel preview deployment (push to main → Vercel auto-deploys) |
| Alert inject fails | Show existing 8 seeded alerts. The critical "Houthi strike" alert is already in the feed. |
| Live alert doesn't appear after inject | Pre-refresh the page. The alert will be in DB; it just needs a page reload. |

---

## Explicitly NOT in v1 (script avoids these)

- No news aggregation / automatic event ingestion — all events are manually injected
- No sanctions screening (OFAC/UN) — that's v1.5 / M17
- No mobile app — desktop-only during recording
- No live carrier API — map pins are static watchlist entities, not live vessel positions
- No email/WhatsApp delivery visible — channels fire but receipts not shown
- No multi-user / role-based access demo — only Priya Mehta's account shown
- No CSV bulk import UI — only manual entity add (not demonstrated)
- No white-label theming
- No billing / payment flow demo

---

## Pre-Recording Checklist

```bash
# 1. Fill in .env at minimum:
#    MONGODB_URI=mongodb+srv://...
#    NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# 2. Seed demo data
cd packages/db && npx tsx seed/index.ts

# 3. Start web (one terminal — keep out of frame)
pnpm --filter web dev

# 4. Verify these URLs return 200:
#    http://localhost:3000/
#    http://localhost:3000/app/sundaram-pharma
#    http://localhost:3000/app/sundaram-pharma/alerts
#    http://localhost:3000/admin/inject-event  (will prompt Basic Auth → admin/syntra-admin)

# 5. Set browser zoom to 90% for clean recording width

# 6. Clear browser history / incognito so no autofill appears
```
