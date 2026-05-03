# Startup Issues — Session 3

Date: 2026-05-03

## B2 Status

Dev servers were not started in this session (overnight non-interactive build). All verification was done via build, typecheck, and unit tests.

## Known Startup Warnings (non-fatal)

1. **Duplicate Mongoose indexes** — `Organization.slug` and `User.clerk_user_id` both have `index: true` on the field AND `schema.index()` call. Will log `[MONGOOSE] Warning: Duplicate schema index` on startup. No functional impact.

2. **MongoMemoryServer download on first run** — If `MONGODB_URI` is empty, the first cold start downloads MongoDB binary (~80MB). Observed during seed run: `Downloading MongoDB "7.0.24": 100%`. After first download it's cached. Cold start adds ~30s on first ever boot.

3. **Peer dependency warnings** from pnpm:
   - `@clerk/nextjs` expects Next.js 15.x but project uses 14.2.5
   - `@scalar/nextjs-api-reference` expects Next.js 15.x and React 19
   - Both work correctly at runtime (build succeeds, docs route renders). Upgrade Next.js to 15 is a v1.5 concern.

## Build Status

`pnpm build` in apps/web: **PASSES** (after extensionAlias webpack fix in session 3)
`pnpm typecheck`: **PASSES** (all 6 packages clean)
`pnpm --filter worker test`: **10/10 PASS**
