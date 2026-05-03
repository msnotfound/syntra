# Route Audit — Session 3

Date: 2026-05-03

## UI Routes

| Route | File | Status |
|-------|------|--------|
| / | apps/web/app/page.tsx | FOUND — exports `LandingPage` |
| /onboarding/org | apps/web/app/onboarding/org/page.tsx | FOUND |
| /onboarding/team | apps/web/app/onboarding/team/page.tsx | FOUND |
| /onboarding/watchlist | apps/web/app/onboarding/watchlist/page.tsx | FOUND |
| /onboarding/alerts-prefs | apps/web/app/onboarding/alerts-prefs/page.tsx | FOUND |
| /onboarding/demo | apps/web/app/onboarding/demo/page.tsx | FOUND |
| /app/[orgSlug] | apps/web/app/app/[orgSlug]/page.tsx | FOUND |
| /app/[orgSlug]/alerts | apps/web/app/app/[orgSlug]/alerts/page.tsx | FOUND |
| /app/[orgSlug]/alerts/[id] | apps/web/app/app/[orgSlug]/alerts/[id]/page.tsx | FOUND |
| /app/[orgSlug]/watchlist | apps/web/app/app/[orgSlug]/watchlist/page.tsx | FOUND |
| /app/[orgSlug]/settings | apps/web/app/app/[orgSlug]/settings/page.tsx | FOUND |
| /app/[orgSlug]/settings/alerts | apps/web/app/app/[orgSlug]/settings/alerts/page.tsx | FOUND |
| /app/[orgSlug]/api | apps/web/app/app/[orgSlug]/api/page.tsx | FOUND |
| /admin | apps/web/app/admin/page.tsx | FOUND |
| /admin/orgs | apps/web/app/admin/orgs/page.tsx | FOUND |
| /admin/events | apps/web/app/admin/events/page.tsx | FOUND |
| /docs | apps/web/app/docs/route.ts | FOUND — implemented as a route handler (not page.tsx), serves Scalar API reference via GET handler |

Note: `/docs` is a route handler (GET export), not a page. This is correct — Scalar requires direct response control. Confirmed present in build output as `○ /docs`.

## API Routes

| Route | File | Handlers | Status |
|-------|------|----------|--------|
| /api/v1/events | apps/web/app/api/v1/events/route.ts | GET | FOUND |
| /api/v1/events/[id] | apps/web/app/api/v1/events/[id]/route.ts | GET | FOUND |
| /api/v1/alerts | apps/web/app/api/v1/alerts/route.ts | GET | FOUND |
| /api/v1/alerts/[id]/acknowledge | apps/web/app/api/v1/alerts/[id]/acknowledge/route.ts | POST | FOUND |
| /api/v1/watchlist | apps/web/app/api/v1/watchlist/route.ts | GET, POST | FOUND |
| /api/v1/watchlist/[id] | apps/web/app/api/v1/watchlist/[id]/route.ts | PATCH, DELETE | FOUND |
| /api/v1/risk | apps/web/app/api/v1/risk/route.ts | GET | FOUND |
| /api/v1/orgs/[slug]/settings | apps/web/app/api/v1/orgs/[slug]/settings/route.ts | GET, PATCH | FOUND (added session 3) |
| /api/v1/webhooks/test | apps/web/app/api/v1/webhooks/test/route.ts | POST | FOUND (added session 3) |
| /api/openapi.json | apps/web/app/api/openapi.json/route.ts | GET | FOUND |
| /api/webhooks/razorpay | apps/web/app/api/webhooks/razorpay/route.ts | POST | FOUND |

## Summary

All 28 routes verified present and exporting correct handlers. Build output confirms all routes compile and render.
