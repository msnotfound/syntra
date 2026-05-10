# Syntra Premium UI/UX Overhaul Summary

Date: 2026-05-10

## Scope

This pass moved Syntra toward a quieter, denser enterprise interface for supply-chain, finance, and risk officers. The implementation keeps the existing navy-charcoal foundation and replaces startup-style emphasis with hairline borders, compact controls, mono data, restrained motion, and operational information density.

## Stitch Exploration

Stitch MCP was requested for a design system, three generated reference screens, component extraction, and screenshots. The MCP tool calls for workspace lookup and project creation were cancelled by the tool layer before a project could be created, so no Stitch screens or screenshots were available to attach.

## 1. Tokens Upgrade

Updated `packages/ui/tokens.ts`.

Before:
- Single transition token.
- No elevation vocabulary beyond surface colors.
- Typography weights stopped at regular/medium/semibold.
- Sidebar width remained 256px.
- Focus ring used a direct hex class.

After:
- Added elevation tokens `0-3` as micro-luminosity surface/border steps.
- Added motion tokens: instant, quick, poised, considered.
- Added light weight 300 for restrained display usage.
- Added premium spacing slots including 28px and 36px.
- Added keyboard-only focus ring token with 1px accent ring, 2px offset, 0.6 opacity.
- Added accent hover/muted, semantic state, and map tokens.
- Upgraded sidebar token to 288px.

## 2. Tailwind Config Upgrade

Updated `apps/web/tailwind.config.ts`.

Before:
- Tailwind consumed the existing color/radius subset.
- Default shadow utilities remained available.
- No custom motion keyframes.

After:
- Wired new token colors, spacing, weights, and motion names.
- Disabled Tailwind shadow utilities by mapping shadow scale to `none`.
- Added `fade-up-poised`, `shimmer-restrained`, and `focus-pulse` keyframes.
- Added animation utilities for restrained reveal, shimmer, and focus pulse.

## 3. Shell Rework

Updated:
- `apps/web/components/shell/Sidebar.tsx`
- `apps/web/components/shell/TopBar.tsx`
- `apps/web/app/app/[orgSlug]/layout.tsx`

Before:
- Sidebar was 256px with tight nav rhythm.
- Org switcher lived in the top bar.
- Top bar was 48px and search was right-mounted.

After:
- Sidebar is 288px with 24px section rhythm and a top org switcher.
- Active nav uses a 2px accent border, lifted surface, and accent text.
- Top bar is 56px with center command trigger, `Cmd-K` chip, notification button tooltip, user pill, and pre-flight status pill: `12 alerts open · 3 critical`.

## 4. Overview Redesign

Updated `apps/web/app/app/[orgSlug]/page.tsx`.

Before:
- Map and active alerts came first, with basic stat cards below.
- Alert list used inline severity color styles.
- No first-paint reveal.

After:
- Added 4-column metric strip with mono values and tiny sparklines.
- Kept the map as the dominant left pane.
- Reworked right column as `Today's Intelligence` with grouped alert cards, severity badges, entity chips, and mono timestamps.
- Added staggered reveal using `data-stagger-index` and `--stagger-index`.
- Replaced inline severity hex usage with semantic classes.

## 5. Alert Detail Polish

Updated `apps/web/app/app/[orgSlug]/alerts/[id]/page.tsx`.

Before:
- Header stacked severity, title, metadata, and actions with more vertical bulk.
- Map used a hardcoded 320px height.
- Why-this-matters was plain body text.
- Mitigation actions used inline hardcoded colors.

After:
- Header is tighter, with severity badge, title, metadata, and mono UTC timestamp aligned for desktop.
- Action cluster uses compact 32px controls with 6px rhythm and active scale.
- Why-this-matters uses a thin accent pull-quote treatment and more comfortable line height.
- Map uses `aspect-[16/9]` and `height="100%"`.
- Mitigation statuses and action buttons use semantic Tailwind tokens.

## 6. Public Landing

Rebuilt `apps/web/app/page.tsx`.

Before:
- Trial/pricing-oriented startup page with brighter CTAs and a dashboard placeholder.
- Inline blue glow shadow around the preview.
- Multiple marketing sections.

After:
- Oversized light-weight hero typography.
- Single muted accent line.
- Ghost `Request access ->` CTA with subtle hover accent.
- Restrained product preview surface.
- Three product surfaces: Intel, Command, Foundry.
- Footer keeps only: `Built on the Warfront geopolitical intelligence platform`.

## 7. Premium Micro-Interactions

Updated:
- `apps/web/app/globals.css`
- `apps/web/components/briefs/GenerateBriefButton.tsx`
- `apps/web/components/scenario/ScenarioBuilder.tsx`
- `apps/web/components/watchlist/NLBar.tsx`
- `apps/web/app/app/[orgSlug]/scenarios/new/page.tsx`
- `apps/web/app/app/[orgSlug]/settings/notifications/page.tsx`
- `apps/web/app/admin/inject-event/page.tsx`

Before:
- Generic `animate-spin` loaders remained in several places.
- Shadows existed on modals/dropdowns.
- Focus behavior was component-local and inconsistent.

After:
- Added global `:focus-visible` ring and mouse-click focus suppression.
- Added `prefers-reduced-motion: reduce`.
- Added stagger and surface-lift utilities.
- Replaced remaining spinner usage with restrained skeleton shimmer.
- Removed remaining app/UI shadow utility usage.

## 8. Density & Rhythm Pass

Updated:
- `apps/web/components/map/WorldMap.tsx`
- `apps/web/components/alerts/AlertRow.tsx`
- several silent controls in touched components.

Before:
- Map and alert row used inline hardcoded severity/map colors.
- A few icon-only controls lacked labels.
- Success colors used direct Tailwind green utility classes.

After:
- Map marker colors come from `@syntra/ui/tokens`.
- Alert row severity borders use semantic CSS classes.
- Success states use `text-success`.
- Icon-only controls touched in this pass now include `aria-label`/`title`.

## Verification

- `git diff --check` passed.
- `pnpm --filter web typecheck` could not run because `node_modules` is missing and `tsc` is unavailable in the workspace.

## Git Status

The requested atomic commits could not be created because Git metadata is on a read-only mount:

```text
fatal: Unable to create '/mnt/WindowsData/Users/MAYANK SAHU/Desktop/LinuxFiles/warfront/syntra/.git/worktrees/syn-premium-uiux/index.lock': Read-only file system
```

The working tree contains the implementation changes and can be committed from a writable Git checkout.
