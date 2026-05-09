# Syntra — Design Guide

> **Purpose:** Feed this document to Stitch, Claude Design, v0, Galileo, or any AI design tool to generate visual mockups for the Syntra dashboard. Also usable as the design brief for any human designer.
>
> **Output expected:** Pixel-accurate mockups for 8 key screens that match the visual language below. These mockups become the reference images for the coding agents during the 5-day build.

---

## 1. Product Context (one paragraph for the design tool)

Syntra is a real-time geopolitical risk monitoring dashboard for mid-market exporters and freight forwarders. Operations heads use it to find out within minutes when geopolitical events (port closures, attacks, sanctions, infrastructure strikes) affect their suppliers, shipping routes, or destination markets. The product feels like Linear meets Bloomberg Terminal meets a security operations center — dense, dark, professional, fast. Users are operations professionals who live in dashboards all day and value information density over decoration.

---

## 2. Visual Language

### 2.1 Reference apps (study these before generating)

The product should feel like the intersection of these:

- **Linear** — clean information density, monospace for IDs and data, calm animations, dark surface hierarchy
- **Vercel Dashboard** — minimalist nav, content-forward, refined typography
- **Pylon** — operations-focused workspace feel, dense alert/inbox lists
- **Resend** — clean email-product visual language, good empty states
- **Cursor settings panels** — restrained use of color, monospace where appropriate
- **Bloomberg Terminal** (subset) — information density without being cluttered, color-coded severity
- **Datadog** — dashboards with maps, alerts, and time-series in one view

### 2.2 Anti-references (do NOT make it look like these)

- ❌ Generic AI startup landing pages (gradient hero, glassmorphism, "futuristic" mesh backgrounds)
- ❌ Consumer SaaS (Notion-style soft pastels, rounded everything, friendly illustrations)
- ❌ Crypto dashboards (neon, glowing, animated charts)
- ❌ Stripe Dashboard (too white, too consumer, too rounded)
- ❌ Defense contractor websites (hard military aesthetic, eagles, tactical fonts)
- ❌ News dashboards (too noisy, too colorful, headline-forward)

### 2.3 Mood

Calm under pressure. Information-dense. Confident. Boring in the right way. The visual equivalent of an air traffic control screen — every pixel earns its place.

---

## 3. Color Tokens

**Background hierarchy (dark mode is the default and primary)**

```
--bg-base        #0B0E14   (bg-base)   — page background
--bg-surface     #151921   (bg-surface)   — cards, panels, modals
--bg-surface-2   #1E2530   (bg-surface-2)   — nested surfaces, hover states
--bg-surface-3   #262C36   (bg-surface-3)   — input backgrounds, selected rows
```

**Borders & dividers**

```
--border-subtle  #1E2530   (bg-surface-2)   — default borders
--border-default #262C36   (bg-surface-3)   — emphasized borders
--border-strong  #475569   (text-disabled)   — focus rings, active states
```

**Text hierarchy**

```
--text-primary   #FAFAFA   (text-primary)    — body, headings, primary content
--text-secondary #94A3B8   (text-secondary)   — labels, metadata, secondary info
--text-muted     #64748B   (text-muted)   — timestamps, hints, placeholders
--text-disabled  #475569   (text-disabled)   — disabled states
```

**Accent (single primary accent — do not introduce more)**

```
--accent         #3B82F6   (blue-500)   — primary actions, links, focus
--accent-hover   #60A5FA   (blue-400)
--accent-muted   #1E3A8A   (blue-900)   — accent backgrounds at 10-20% opacity
```

**Severity colors (used everywhere alerts appear)**

```
--severity-critical    #EF4444   (red-500)     — bg with 15% opacity for chips
--severity-high        #F97316   (orange-500)
--severity-medium      #EAB308   (yellow-500)
--severity-low         #60A5FA   (blue-400)
--severity-info        #94A3B8   (text-secondary)
```

**Semantic states**

```
--success        #22C55E   (green-500)   — used SPARINGLY (acks, confirms)
--warning        #F59E0B   (amber-500)
--error          #EF4444   (red-500)     — same as severity-critical
```

**Map-specific**

```
--map-bg              #0A0A0A           — map background tile
--map-water           #151921
--map-land            #1E2530
--map-border          #262C36
--map-event-glow      rgba(239, 68, 68, 0.4)   — pulsing glow for active events
--map-watchlist-pin   #3B82F6
```

**Light mode:** ship dark mode only in v1. Light mode is post-launch. Do not generate light mockups.

---

## 4. Typography

**Fonts**

```
UI / Body:  Geist Sans            (fallback: Inter, system-ui)
Data / IDs: Geist Mono            (fallback: JetBrains Mono, ui-monospace)
```

**Type scale (use ONLY these sizes — no others)**

```
--text-xs    11px / 16px line   — labels, metadata, tiny captions
--text-sm    13px / 20px line   — table cells, secondary UI
--text-base  14px / 22px line   — body, default UI text
--text-md    16px / 24px line   — emphasized body, large buttons
--text-lg    20px / 28px line   — section headings
--text-xl    24px / 32px line   — page titles
--text-2xl   32px / 40px line   — landing page hero only
```

**Weights (use ONLY these)**

```
400  Regular   — body
500  Medium    — labels, button text, table headers
600  Semibold  — section titles, emphasis
```

No 300 Light. No 700 Bold. No 800/900. Use color or size for emphasis instead of weight.

**Letter spacing**

- All caps labels (e.g., section headers, table column headers): `tracking-wider` (0.05em), uppercase, text-xs, weight 500
- Everything else: default tracking
- Numbers and data in tables: `tabular-nums` (Tailwind class)

---

## 5. Spacing & Layout

**Grid:** 4px base. Use Tailwind defaults (1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 6 = 24px, 8 = 32px, 12 = 48px, 16 = 64px).

**Common spacing patterns:**

- Card padding: `p-6` (24px)
- Section spacing: `space-y-8` (32px between sections)
- Form field spacing: `space-y-4` (16px)
- Inline element gap: `gap-2` (8px) for tight, `gap-4` (16px) for relaxed
- Page padding: `px-8 py-6` desktop, `px-4 py-4` mobile

**Border radius:**

```
--radius-sm   4px    — chips, badges, small buttons
--radius-md   6px    — buttons, inputs, cards
--radius-lg   8px    — modals, large panels
--radius-full 9999px — circular icons, avatars
```

No `rounded-2xl` or larger. No "pill" shapes except for status badges.

**Shadows**

In dark mode, use border-emphasis instead of shadows. Shadows look bad on dark backgrounds.

```
--shadow-overlay   0 8px 24px rgba(0,0,0,0.5)   — modal backdrops only
```

For elevation, use border + slightly lighter background, not shadow.

---

## 6. Layout Architecture

### 6.1 Global app shell (every authenticated page)

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP BAR (h-12, bg-surface, border-b)                            │
│ [Logo] [Org switcher ▾]              [Search] [Bell] [User ▾]   │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ SIDEBAR  │  PAGE CONTENT                                        │
│ (w-64)   │  (max-w-7xl, px-8, py-6)                             │
│          │                                                      │
│ Overview │                                                      │
│ Alerts   │                                                      │
│ Watchlist│                                                      │
│ API      │                                                      │
│ Settings │                                                      │
│          │                                                      │
│ ──────   │                                                      │
│ Help     │                                                      │
│ Docs     │                                                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

- Top bar: 48px tall, full width, border-bottom subtle
- Sidebar: 256px wide, full height, no border (uses bg color difference instead)
- Sidebar nav items: 32px tall, icon (16px) + label (text-sm), active state = bg-surface-2 + accent-colored left border (2px)
- Active page in sidebar has accent-colored icon

### 6.2 Page header pattern

Every page starts with:

```
┌─────────────────────────────────────────────────────────┐
│ Page Title (text-xl, weight-600)                        │
│ Optional one-line description (text-sm, text-secondary) │
│                                          [Action button]│
├─────────────────────────────────────────────────────────┤
│ Content                                                 │
└─────────────────────────────────────────────────────────┘
```

48px between page header and first content block.

---

## 7. Core Components

These are the components the design tool should generate consistently.

### 7.1 SeverityBadge

A small pill-shaped badge indicating severity. Used everywhere alerts appear.

```
[● CRITICAL]  bg: severity-critical at 15% opacity, text: severity-critical, dot: severity-critical
[● HIGH]      bg: severity-high at 15% opacity, text: severity-high
[● MEDIUM]    bg: severity-medium at 15% opacity, text: severity-medium
[● LOW]       bg: severity-low at 15% opacity, text: severity-low
```

- Height: 20px
- Padding: 0 8px
- Font: text-xs, weight-500, uppercase, tracking-wider
- Dot: 6px circle, same color as text
- Border-radius: 4px (sm)

### 7.2 EntityChip

Used to display a watchlist entity reference inline.

```
[🏭 Sundaram Pharma — Hyderabad]
```

- Small icon based on type (supplier 🏭, port ⚓, route ➡, country 🏴, region 🌐, asset 📦) — use Lucide icons, NOT emoji in production
- Text: entity name, optional secondary location in text-muted
- Background: bg-surface-2
- Border: border-subtle
- Padding: 4px 8px
- Radius: 4px
- Hover: cursor-pointer, bg-surface-3

### 7.3 Button hierarchy

```
PRIMARY:    bg: accent, text: white, weight-500
            hover: accent-hover
            
SECONDARY:  bg: bg-surface-2, text: text-primary, border: border-default
            hover: bg-surface-3
            
GHOST:      bg: transparent, text: text-secondary
            hover: bg-surface-2, text-primary
            
DESTRUCTIVE: bg: severity-critical at 15% opacity, text: severity-critical, border: severity-critical at 30%
            hover: severity-critical at 25% opacity
```

- Heights: sm (28px), default (32px), lg (40px)
- Padding x: sm (12px), default (16px), lg (20px)
- Font: text-sm, weight-500
- Radius: 6px (md)
- Icon-only buttons: square (h = w)

### 7.4 Input fields

```
[                                          ]
 Label above (text-xs, weight-500, text-secondary, uppercase, tracking-wider)
 Input: bg-surface-2, border-default, h-9, px-3, text-sm
 Focus: border-accent, ring-2 ring-accent at 20% opacity
 Error: border-error, helper text below in error color
```

### 7.5 Card / Panel

```
┌─────────────────────────────────────┐
│ ▏ Section Title    [optional action]│  ← header: p-4, border-b border-subtle
├─────────────────────────────────────┤
│                                     │
│  Content                            │  ← body: p-6
│                                     │
└─────────────────────────────────────┘

bg: bg-surface
border: border-subtle (1px)
radius: 8px (lg)
```

### 7.6 Alert row (used in alert feed)

```
┌────────────────────────────────────────────────────────────────┐
│ [● CRITICAL]  Houthi missile strike near Hodeidah port         │
│               🏴 Yemen · ⚓ Hodeidah · 4 minutes ago            │
│               Affects: [⚓ Hodeidah] [➡ Suez route] [🏴 Yemen]   │
│                                                                │
│                                       [Acknowledge] [View →]   │
└────────────────────────────────────────────────────────────────┘
```

- Height: ~96px expanded, 64px collapsed
- Background: bg-surface, border-b border-subtle
- Hover: bg-surface-2
- Severity-colored left border (3px, full height) matching severity
- Title: text-base, weight-500
- Metadata row: text-sm, text-secondary
- Affected entities: row of EntityChips, gap-2
- Right-side actions: visible on hover, ghost buttons

---

## 8. The 8 Screens to Generate

Generate one mockup per screen. All in dark mode. All at 1440×900 desktop viewport. Hand each prompt below to your design tool separately.

---

### SCREEN 1 — Overview Dashboard

**URL:** `/app/sundaram-pharma/`

**Purpose:** First page after login. Operations head's daily glance.

**Layout:**

```
[Top bar with org switcher: "Sundaram Pharma"]
[Sidebar with active=Overview]

Page content:
┌─────────────────────────────────────────────────────────────────┐
│ Overview                                                        │
│ 3 active alerts in last 24h · 47 watchlist entities monitored   │
│                                            [+ Add to Watchlist] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────┐ ┌─────────────────┐ │
│ │                                         │ │ ACTIVE ALERTS   │ │
│ │                                         │ │                 │ │
│ │           WORLD MAP                     │ │ [● CRIT] Houthi │ │
│ │      (Mapbox dark style)                │ │ strike near     │ │
│ │                                         │ │ Hodeidah        │ │
│ │   • Watchlist pins (blue)               │ │ 4m ago          │ │
│ │   ● Active event glows (red, pulsing)   │ │                 │ │
│ │   ▲ Affected entities (orange)          │ │ [● HIGH] Port   │ │
│ │                                         │ │ closure Mombasa │ │
│ │   [Cluster view at low zoom]            │ │ 2h ago          │ │
│ │                                         │ │                 │ │
│ │                                         │ │ [● MED] Sanc-   │ │
│ │   [zoom controls bottom-right]          │ │ tions update    │ │
│ │                                         │ │ Iran            │ │
│ │                                         │ │ 6h ago          │ │
│ └─────────────────────────────────────────┘ │                 │ │
│                                              │ [View all →]    │ │
│                                              └─────────────────┘ │
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ ENTITIES │ │ ALERTS   │ │ AVG ACK  │ │ TOP REGN │             │
│ │   47     │ │ THIS WK  │ │ TIME     │ │ Red Sea  │             │
│ │          │ │   12     │ │ 14m      │ │ 8 alerts │             │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key visual moments:**
- Map should dominate (60% of width)
- Map has pulsing red glow on active event near Yemen
- Alert sidebar is dense with severity colors prominent
- 4 stat cards at bottom — minimal, big number, small label

**Generate this prompt for the design tool:**

> Generate a dark-mode dashboard for a geopolitical risk monitoring SaaS called "Syntra." Page is "Overview" for an Indian pharma exporter. Layout: top nav bar (logo, org dropdown "Sundaram Pharma", search, notifications, user menu), 256px left sidebar with nav (Overview active, Alerts, Watchlist, API, Settings, Help, Docs), main content area with: page title "Overview" + subtitle showing alert count, then a large 60%-width interactive world map (Mapbox dark style #0B0E14 background) with blue watchlist pins clustered in India/Africa/Gulf and a pulsing red event marker near Yemen, alongside a 35%-width "Active Alerts" panel showing 3 alert rows with severity badges (Critical red, High orange, Medium yellow) — each row has title, location, time-ago, and "Affected: [chip][chip]" entities, then below 4 stat cards showing 47 entities, 12 alerts this week, 14m avg ack time, "Red Sea" as top region. Aesthetic: Linear-meets-Bloomberg-Terminal, dark bg-base background, monospace for numbers, no gradients, no rounded-2xl, dense information, professional. Reference: Linear, Vercel dashboard, Datadog. Avoid: gradients, glassmorphism, friendly consumer feel.

---

### SCREEN 2 — Alert Feed

**URL:** `/app/sundaram-pharma/alerts`

**Purpose:** Triage view. Operations head reviews, acknowledges, and drills in.

**Layout:**

```
Page header: "Alerts" + "47 alerts in last 30 days · 3 unacknowledged"

Filter bar:
[Severity ▾] [Region ▾] [Time: Last 7 days ▾] [Status: All ▾]    [Search alerts]

Alert list (scrollable, virtualized):
┌────────────────────────────────────────────────────────────────┐
│ ▏[● CRITICAL]  Houthi missile strike near Hodeidah port        │
│   🏴 Yemen · ⚓ Hodeidah · 4 minutes ago                        │
│   Affects: [⚓ Hodeidah] [➡ Suez route] [🏴 Yemen]              │
│   [Source: Reuters · Al-Masirah · 2 more]                      │
│                                       [Ack] [View →]           │
├────────────────────────────────────────────────────────────────┤
│ ▏[● HIGH]      Port closure announced — Mombasa Container Term.│
│   🏴 Kenya · ⚓ Mombasa · 2 hours ago                           │
│   Affects: [⚓ Mombasa] [🏭 Kenya Distribution Hub]             │
│                                       [Ack] [View →]           │
├────────────────────────────────────────────────────────────────┤
│ [● MEDIUM]    New US sanctions update — Iran banking sector    │
│   🏴 Iran · 6 hours ago                                         │
│   Affects: [🏴 Iran] [➡ Persian Gulf route]                    │
│   ✓ Acknowledged by Priya Mehta · 5 hours ago                  │
│                                       [View →]                 │
└────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate an alert feed page for a dark-mode geopolitical risk dashboard. Top: page title "Alerts" + subtitle "47 alerts in last 30 days · 3 unacknowledged". Below: horizontal filter bar with 4 dropdowns (Severity, Region, Time, Status) and a search input on the right. Below that: vertical list of alert rows, each row 96px tall with: (1) severity-colored left border 3px, (2) severity badge pill at top-left (Critical=red, High=orange, Medium=yellow with colored dot), (3) alert title in 14px medium-weight, (4) metadata row showing country flag emoji, port icon, time-ago in text-secondary, (5) "Affects:" row with 2-3 entity chips (rounded rectangles with icon+name), (6) optional source citations in text-muted, (7) right-side hover-revealed action buttons "Ack" and "View →". Show 3 alert rows: Critical Houthi strike (4m ago), High Mombasa port closure (2h ago), Medium Iran sanctions (6h ago, already acknowledged with green checkmark). Background bg-base, rows on bg-surface (bg-surface), hover state slightly lighter. Dense, calm, operations-tool feel. Reference Linear inbox, Pylon. No gradients, no rounded-2xl.

---

### SCREEN 3 — Alert Detail

**URL:** `/app/sundaram-pharma/alerts/[id]`

**Purpose:** Deep-dive on a single alert. Reached from email link or feed click.

**Layout:**

```
Breadcrumb: Alerts / Houthi missile strike near Hodeidah port

┌─────────────────────────────────────────────────────────────────┐
│ [● CRITICAL]                                                    │
│ Houthi missile strike near Hodeidah port                        │
│ 🏴 Yemen · ⚓ Hodeidah · Reported 4 minutes ago                  │
│                                  [Acknowledge] [Forward to team]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────┐  ┌──────────────────────────────┐   │
│ │ MAP                     │  │ WHY THIS MATTERS TO YOU      │   │
│ │ (Zoomed to Hodeidah,    │  │                              │   │
│ │  showing event marker   │  │ Affects 3 watchlist entities:│   │
│ │  + nearby watchlist     │  │                              │   │
│ │  pins)                  │  │ ⚓ Hodeidah Port             │   │
│ │                         │  │   Direct hit · Suez route    │   │
│ │                         │  │                              │   │
│ │                         │  │ ➡ Suez route                 │   │
│ │                         │  │   Likely disruption 48-72h   │   │
│ │                         │  │                              │   │
│ │                         │  │ 🏴 Yemen                     │   │
│ │                         │  │   Country watchlist match    │   │
│ └─────────────────────────┘  └──────────────────────────────┘   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ EVENT DETAILS                                               │ │
│ │ Type: Maritime attack                                       │ │
│ │ Time: 14:23 UTC, 15 March 2025                              │ │
│ │ Coordinates: 14.7956°N, 42.9494°E                           │ │
│ │ Reported casualties: Vessel damage, no crew injuries        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ RECOMMENDED ACTIONS (AI-generated)                          │ │
│ │ • Re-route Suez-bound shipments via Cape of Good Hope       │ │
│ │ • Contact insurance broker re: war-risk premium adjustment  │ │
│ │ • Review schedule for vessels arriving Hodeidah next 7 days │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ SOURCES                                                     │ │
│ │ [thumb] Reuters — "Houthi forces strike commercial vessel..."│ │
│ │ [thumb] Al-Masirah — "Operation in Hodeidah confirmed..."   │ │
│ │ [thumb] Maritime Executive — "Shipping advisory issued..."  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate an alert detail page for a dark-mode geopolitical risk dashboard. Top: breadcrumb "Alerts / Houthi missile strike near Hodeidah port", then large alert header with red Critical severity badge, 24px title "Houthi missile strike near Hodeidah port", metadata row with country/port/time, and right-aligned action buttons "Acknowledge" (primary blue) and "Forward to team" (secondary). Below: two-column layout — left column 60% is a zoomed map (Mapbox dark) centered on Yemen showing red pulsing event marker plus nearby blue watchlist pins; right column 40% is a "Why this matters to you" panel listing 3 affected entities, each with icon, name, and one-line impact reason. Below: three stacked cards — "Event Details" (table of type, time, coordinates, casualties), "Recommended Actions" (3 bullet points, marked AI-generated), "Sources" (3 source rows with thumbnail, publication name, headline). All cards on bg-surface with subtle borders, generous padding. Dark bg-base background. Information-dense, professional, operations-grade. No marketing copy. Reference: Linear issue detail, Datadog incident view.

---

### SCREEN 4 — Watchlist Management

**URL:** `/app/sundaram-pharma/watchlist`

**Purpose:** Manage what we monitor.

**Layout:**

```
Page header: "Watchlist" + "47 entities · 12 suppliers · 4 ports · 3 routes · 8 countries · 18 other"
                                                                  [+ Add entity]

Tabs: [All 47] [Suppliers 12] [Ports 4] [Routes 3] [Countries 8] [Regions 4] [Assets 14]

Map at top showing all entities (300px tall):
┌───────────────────────────────────────────────────────────────┐
│  WORLD MAP with all watchlist pins                            │
└───────────────────────────────────────────────────────────────┘

Search/filter bar:
[🔍 Search entities...]                          [Bulk import CSV]

Table:
┌────────────────────────────────────────────────────────────────┐
│ NAME              TYPE       LOCATION         ACTIVE  ACTIONS  │
├────────────────────────────────────────────────────────────────┤
│ 🏭 Aurobindo HQ  Supplier   Hyderabad, IN     ●     [⋮]       │
│ 🏭 Cipla Goa     Supplier   Goa, IN           ●     [⋮]       │
│ ⚓ JNPT          Port       Mumbai, IN        ●     [⋮]       │
│ ⚓ Mundra        Port       Gujarat, IN       ●     [⋮]       │
│ ➡ India→E.Africa Route     Suez via 200km    ●     [⋮]       │
│ 🏴 Kenya         Country    KE                ●     [⋮]       │
│ ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a watchlist management page for a dark-mode geopolitical risk dashboard. Top: page title "Watchlist" + subtitle "47 entities · 12 suppliers · 4 ports · 3 routes · 8 countries · 18 other", right-side primary button "+ Add entity". Below: horizontal tab strip with 7 tabs "All 47" (active), "Suppliers 12", "Ports 4", "Routes 3", "Countries 8", "Regions 4", "Assets 14" — active tab has accent-blue underline. Below tabs: 300px-tall world map showing all watchlist pins clustered geographically. Below map: search input on left, "Bulk import CSV" secondary button on right. Below: data table with columns NAME (with type icon), TYPE, LOCATION, ACTIVE (toggle dot), ACTIONS (kebab menu). Show 6 example rows mixing supplier/port/route/country types, each with appropriate icon (factory/anchor/arrow/flag) in text-secondary. Table rows alternate subtle bg, hover state shows bg-surface-2. Dense, sortable feel. Reference: Linear projects table, Vercel deployments table. Dark bg-base background.

---

### SCREEN 5 — Settings (Alert Preferences)

**URL:** `/app/sundaram-pharma/settings`

**Purpose:** Configure alerts, team, billing.

**Layout:**

```
Page header: "Settings"

Sub-nav (vertical, left): General · Alerts · Team · API · Billing
                                                       [Alerts ← active]

Right content:
┌─────────────────────────────────────────────────────────────────┐
│ Alert Channels                                                  │
│ Choose how you want to receive alerts.                          │
│                                                                 │
│ ☑ Email                                                         │
│   Sent to: priya@sundarampharma.com [Change]                    │
│                                                                 │
│ ☑ WhatsApp                                                      │
│   Sent to: +91 98765 43210 [Verify]                             │
│                                                                 │
│ ☐ Webhook                                                       │
│   POST to: [https://...                          ] [Test]       │
│                                                                 │
│ ────────────────────────────────────────────────────────────    │
│                                                                 │
│ Severity Threshold                                              │
│ Only send alerts at or above this severity.                     │
│                                                                 │
│   [● Critical] [● High ✓] [● Medium] [● Low]                   │
│                                                                 │
│ ────────────────────────────────────────────────────────────    │
│                                                                 │
│ Quiet Hours                                                     │
│ Alerts will be queued and delivered after quiet hours end.      │
│                                                                 │
│ ☑ Enable quiet hours                                            │
│   From [22:00] to [06:00] in [Asia/Kolkata ▾]                  │
│                                                                 │
│                                                  [Save changes] │
└─────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a settings page for a dark-mode SaaS dashboard. Layout: page title "Settings" at top, then two-column layout: left vertical sub-nav 200px wide with items "General, Alerts (active, accent-blue left border), Team, API, Billing"; right main content area with three sections separated by hairline dividers. Section 1 "Alert Channels" with 3 toggleable options (Email checked, showing email + Change link; WhatsApp checked, showing phone + Verify link; Webhook unchecked, showing URL input + Test button). Section 2 "Severity Threshold" with 4 severity-colored toggle pills, "High" selected. Section 3 "Quiet Hours" with checkbox, two time inputs, timezone dropdown. Right-aligned "Save changes" primary button at bottom. Each section has small caps label header (text-xs uppercase tracking-wider text-secondary) and short descriptive subtitle. Forms feel: Vercel settings, Linear settings. Dark bg-base, generous spacing, calm.

---

### SCREEN 6 — API & Developer Page

**URL:** `/app/sundaram-pharma/api`

**Purpose:** Manage API keys and view docs/usage.

**Layout:**

```
Page header: "API" + "Programmatic access to alerts and events"
                                                  [+ Create API key]

Two-column layout:

LEFT (60%): API Keys table
┌──────────────────────────────────────────────────────┐
│ NAME              KEY              CREATED   LAST USED│
├──────────────────────────────────────────────────────┤
│ Production        syn_live_8f3a...  Mar 12    2m ago  │
│ Staging           syn_test_b2c4...  Mar 10    1h ago  │
│ Internal Pipeline syn_live_d4e1...  Feb 28    3d ago  │
└──────────────────────────────────────────────────────┘

Usage chart (last 7 days):
┌──────────────────────────────────────────────────────┐
│ ▁▂▅▇▆▃▂  3,247 requests this week                    │
└──────────────────────────────────────────────────────┘

RIGHT (40%): Quick start
┌──────────────────────────────────────────────────────┐
│ QUICK START                                          │
│                                                      │
│ Fetch your latest alerts:                            │
│                                                      │
│ ┌──────────────────────────────────────────────┐     │
│ │ $ curl https://app.syntra.app/api/v1/   │     │
│ │   alerts \                                   │     │
│ │   -H "Authorization: Bearer syn_live_..."     │     │
│ └──────────────────────────────────────────────┘     │
│                                                      │
│ Response:                                            │
│ ┌──────────────────────────────────────────────┐     │
│ │ {                                            │     │
│ │   "data": [                                  │     │
│ │     {                                        │     │
│ │       "id": "alt_8f3a2b",                    │     │
│ │       "severity": "critical",                │     │
│ │       "title": "Houthi missile strike...",   │     │
│ │       ...                                    │     │
│ │     }                                        │     │
│ │   ]                                          │     │
│ │ }                                            │     │
│ └──────────────────────────────────────────────┘     │
│                                                      │
│ [Full API Documentation →]                           │
└──────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate an API/developer page for a dark-mode SaaS dashboard. Page title "API" + subtitle "Programmatic access to alerts and events", right-aligned primary button "+ Create API key". Two-column layout below: LEFT 60% — table of 3 API keys with columns NAME, KEY (showing prefix only like "syn_live_8f3a..." in monospace), CREATED, LAST USED; below table a small bar chart showing request volume over 7 days with sparkline-style bars and label "3,247 requests this week". RIGHT 40% — "Quick Start" panel with two stacked code blocks (terminal-style, monospace, syntax-highlighted): first block shows curl command with bearer token, second block shows JSON response with id/severity/title fields. Below code blocks: link "Full API Documentation →" in accent blue. Code blocks have darker bg (bg-base) with subtle border, monospace font (Geist Mono). Aesthetic reference: Vercel API tokens page, Stripe dashboard developer view (but dark). Dark bg-base background, tabular-nums for numbers.

---

### SCREEN 7 — Onboarding (Step 2 — Watchlist)

**URL:** `/onboarding/watchlist`

**Purpose:** First-run wizard. Critical for activation.

**Layout:**

```
Top: progress bar showing "Step 2 of 5"

Centered card (max-w-2xl):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Add your first watchlist entities                              │
│  We'll alert you when geopolitical events affect them.          │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   📤            │ │   ✏️             │ │   🚀            │    │
│  │                 │ │                 │ │                 │    │
│  │   Upload CSV    │ │   Add manually  │ │   Use template  │    │
│  │                 │ │                 │ │                 │    │
│  │ Bulk import     │ │ One at a time   │ │ Pre-built sets  │    │
│  │ from spreadsheet│ │                 │ │ for your industry│   │
│  │                 │ │                 │ │                 │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│                                                                 │
│                                                                 │
│  [← Back]                              [Skip for now] [Continue→]│
└─────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate an onboarding wizard step page (dark mode). Top: thin progress bar showing 2 of 5 steps with accent-blue fill. Centered card (max-width 700px) with: large heading "Add your first watchlist entities" (text-2xl, weight-600), subtitle "We'll alert you when geopolitical events affect them." (text-base, text-secondary), then three equal-width clickable option cards arranged horizontally — each card 200px tall with a Lucide icon at top (upload-cloud / pencil / rocket), bold label below (Upload CSV / Add manually / Use template), and a one-line description in text-secondary. Cards have subtle hover state (bg-surface-2, border-accent). Bottom of page: ghost "← Back" button on left, "Skip for now" ghost button + "Continue →" primary button on right. Page background is bg-base, card on bg-surface (bg-surface). Calm, focused, single-decision-per-screen onboarding feel. Reference: Linear onboarding, Cal.com onboarding. Avoid: progress checklists with many items, animations, illustrations.

---

### SCREEN 8 — Public Landing Page (Above Fold)

**URL:** `/` (public)

**Purpose:** Convert visitors to trial signups.

**Layout:**

```
[Top nav: Logo · Product · Pricing · Docs · API     ··· [Sign in] [Start trial]]

HERO:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│       Geopolitical risk monitoring                              │
│       for everyone Stratfor doesn't sell to.                    │
│                                                                 │
│       Watchlist-driven alerts in real time.                     │
│       Email, WhatsApp, API. ₹15,000/month.                      │
│                                                                 │
│       [Start free trial]  [View live demo →]                    │
│                                                                 │
│       ┌─────────────────────────────────────────────────────┐   │
│       │                                                     │   │
│       │   [Screenshot of dashboard with map + alerts]       │   │
│       │                                                     │   │
│       └─────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Below fold:
- Three stats (47K events tracked / 200+ sources / sub-15-min latency)
- "How it works" 3-step
- Pricing
- Etc.
```

**Generate this prompt:**

> Generate a public landing page hero section for a dark-mode SaaS product called "Syntra." Top nav: logo on left ("syntra"), nav items (Product, Pricing, Docs, API) center-left, "Sign in" ghost button + "Start trial" primary blue button on right. Below: large left-aligned hero with two-line headline "Geopolitical risk monitoring / for everyone Stratfor doesn't sell to." (text-5xl, weight-600, white), subtitle in text-secondary "Watchlist-driven alerts in real time. Email, WhatsApp, API. ₹15,000/month.", then two CTA buttons "Start free trial" (primary blue) and "View live demo →" (secondary). Below the text: large angled-perspective screenshot mockup of the product dashboard (showing the overview screen with map and alerts) — slight tilt, subtle border-glow in accent blue. Background: bg-base with very subtle radial gradient from top-center (almost imperceptible). NO bright gradients, NO mesh backgrounds, NO glassmorphism. Aesthetic: Linear landing page, Resend landing page, Vercel landing page. Confident, restrained, professional. Headline should feel sharp and specific.

---

## 9. Iconography

- **Library:** Lucide React (already shadcn-compatible)
- **Sizing:** 14px (inline), 16px (default UI), 20px (emphasized), 24px (page titles)
- **Stroke width:** 1.5 (default Lucide is fine)
- **Color:** inherit text color by default

**Type-specific icons:**

| Entity Type | Lucide icon |
|---|---|
| Supplier | `factory` |
| Port | `anchor` |
| Route | `route` or `move-right` |
| Country | `flag` |
| Region | `globe-2` |
| Asset | `package` |
| Alert | `bell` |
| Event | `zap` |

Do NOT use emoji in production UI. The mockup prompts above use emoji for clarity but generated UIs should use Lucide.

---

## 10. Empty States

Every list view needs a designed empty state. Use this pattern:

```
┌─────────────────────────────────────────┐
│                                         │
│              ┌─────┐                    │
│              │ icon│   (large, muted)   │
│              └─────┘                    │
│                                         │
│         No alerts yet                   │
│   Alerts will appear here once          │
│   events match your watchlist.          │
│                                         │
│         [+ Add to Watchlist]            │
│                                         │
└─────────────────────────────────────────┘
```

- Icon: 48px, text-disabled
- Title: text-md, weight-500, text-primary
- Subtitle: text-sm, text-secondary, max 2 lines
- Optional CTA below

---

## 11. Loading States

- **Tables:** skeleton rows (3-5) with shimmer animation, same heights as real rows
- **Map:** dark gray placeholder with centered loading spinner
- **Cards:** subtle pulse on bg-surface
- **Page navigation:** thin accent-blue bar at top of viewport (Linear-style)

NO full-page spinners except on initial app boot.

---

## 12. Animation & Motion

Restrained motion. Operations users find excessive animation distracting.

- **Page transitions:** instant (no fade)
- **Hover:** 150ms ease-out, only on color/border/bg changes
- **Modals:** 200ms slide-up + fade-in
- **Alerts appearing:** 300ms slide-in from top
- **Map markers pulsing:** 2s ease-in-out infinite, only on active critical events
- **Loading skeletons:** 1.5s shimmer

NO: parallax, scroll-jacking, page transition animations, decorative animations, animated illustrations.

---

## 13. Voice & Microcopy

- **Tone:** confident, terse, factual. Like a Bloomberg headline.
- **Verb tense:** present and past, never future. "Houthi forces struck vessel" not "Houthi forces will strike vessel."
- **Severity language:** factual, not sensational. "Direct hit on port infrastructure" not "Devastating attack."
- **Time:** always relative + absolute on hover. "4 minutes ago" with hover tooltip "14:23 UTC, 15 March 2025"
- **Numbers:** always tabular-nums, always with units. "47 entities", "1,247 requests", "14.2km"
- **Buttons:** verbs only, sentence case. "Acknowledge", "Save changes", "Add entity". Not "Click to save" or "OK".
- **Errors:** specific and actionable. "Geocoding failed for 'Mumbi' — did you mean Mumbai?" not "An error occurred."

---

## 14. Mobile (Post-Launch — Generate Desktop Only for v1)

Do not generate mobile mockups for v1. The product is desktop-first. A barely-functional mobile responsive layout (sidebar collapses, tables become cards) is enough for v1. Mobile-optimized design comes post-launch.

---

## 15. How to Use This Doc

### With Stitch / Claude Design / v0

For each of the 8 screens above, copy the "Generate this prompt" block under each screen and paste it into the design tool. Generate 2–3 variants per screen, pick the strongest, save the screenshot.

### With a human designer

Hand them this entire document plus the 8 screen specs. They can produce mockups in Figma in 1–2 days using the tokens and component specs above.

### As reference for the build

Once mockups exist, save them to `/specs/12-design.md` (per the build plan §23) and reference them in every UI module's spec file. Coding agents will produce dramatically better UI when given concrete visual references vs. text descriptions alone.

### Iteration

After v1 ships, iterate the design based on real user feedback. Don't pre-optimize — most of these specs will be revised based on what real customers actually need.

---

## 15.5 Token Authority

This document is the canonical source of truth for Syntra's visual language. Implementations follow these rules:

1. **All design tokens — colors, spacing, radii, transitions, fonts — are imported from `packages/ui/tokens.ts`.** Do not hardcode hex values, Tailwind color classes, spacing literals, or transition durations in module code.
2. **`packages/ui/tokens.ts` is a contract surface.** It is the programmatic mirror of §3 (color tokens), §4 (typography), §5 (spacing), and §12 (animation). Modifying it requires a CCR per the orchestration playbook §6.
3. **If `tokens.ts` and this design guide ever conflict, this design guide wins** and `tokens.ts` is updated to match.
4. **Legacy v1 zinc tokens are forbidden.** The supervisor agent (orchestration §5.2 step 1f) greps for `zinc-9\d\d`, `#27272A`, `#3F3F46`, `#52525B` and flags any branch that introduces them. This is enforcement, not guidance.

### Canonical token file (`packages/ui/tokens.ts`)

```typescript
// packages/ui/tokens.ts
// SOURCE OF TRUTH for all Syntra design tokens.
// Mirrors syntra_design_guide.md §3-5, §12.
// Changes here require a CCR.

export const colors = {
  bg: {
    base:     '#0B0E14',
    surface:  '#151921',
    surface2: '#1E2530',
    surface3: '#262C36',
  },
  border: {
    subtle:   '#1E2530',
    default:  '#262C36',
    strong:   '#3B82F6',
  },
  text: {
    primary:   '#FAFAFA',
    secondary: '#94A3B8',
    muted:     '#64748B',
    disabled:  '#475569',
  },
  accent: {
    DEFAULT: '#3B82F6',
  },
  severity: {
    critical: '#EF4444',
    high:     '#F97316',
    medium:   '#EAB308',
    low:      '#60A5FA',
  },
} as const;

export const spacing = {
  base: 4, // 4px grid
} as const;

export const radii = {
  sm: '4px',  // chips, status badges
  md: '6px',  // cards, inputs
  // No radii larger than 6px in operational suite.
} as const;

export const transitions = {
  default: '150ms ease-out',
} as const;

export const typography = {
  fonts: {
    body: 'Inter, "Geist Sans", system-ui, sans-serif',
    mono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  },
} as const;

export const interactions = {
  buttonPress: 'active:scale-95',
  focusRing:   'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#3B82F6]',
} as const;
```

### Design system migration log

| Date | Change | CCR |
|---|---|---|
| v1 → v2 | Zinc palette → navy-charcoal palette (8 token replacements). Sidebar 224px → 256px. Borders mandatory, shadows forbidden in operational suite. `150ms ease-out` transitions added. `active:scale-95` mandated for buttons and nav. Geist Mono mandatory for IDs/timestamps/coordinates/API keys. | n/a (foundational) |

Any future v2 → v3 (or beyond) migration must update both this file and `tokens.ts` atomically via a single CCR.

---

## Appendix — Quick Color Reference Card

```
BACKGROUNDS
Page         #0B0E14   bg-base
Surface      #151921   bg-surface
Surface 2    #1E2530   bg-surface-2
Surface 3    #262C36   bg-surface-3

TEXT
Primary      #FAFAFA   text-primary
Secondary    #94A3B8   text-secondary
Muted        #64748B   text-muted
Disabled     #475569   text-disabled

ACCENT
Blue         #3B82F6   bg-blue-500 / text-blue-500

SEVERITY
Critical     #EF4444   red-500
High         #F97316   orange-500
Medium       #EAB308   yellow-500
Low          #60A5FA   blue-400
```

---

*End of design guide. Generate, iterate, ship.*

---

# PART II — COMMAND TIER UI (v1.5+)

> **Scope:** Everything in §1–§15 above is the v1 design system. The sections below extend it for the v1.5 "Command" tier features specced in `syntra_buildplan.md` Part II (§§26–31). The visual language stays the same — same tokens, same components, same restraint. We are *adding* surfaces, not redesigning.
>
> **Anti-goal:** do not make these screens look more "important" or "advanced" than the v1 screens. The v1.5 features are higher-tier in pricing, not in visual chrome. Keep them honest. The information density goes up; the decoration does not.

---

## 16. Visual Language Continuity (Don't Drift)

Reaffirm before generating any of the new screens:

- Same color tokens (§3). No new accent colors.
- Same typography (§4). No new sizes, no new weights.
- Same spacing grid (§5). No "feature panels" with extra padding to feel premium.
- Same icon set (Lucide, §9).
- Same restraint on motion (§12).

The v1.5 screens are *more dense*, not *more decorative*. If a generated mockup has gradients, glow effects, or "premium" treatments, reject it and regenerate.

---

## 17. New Components for Command Tier

These extend §7. Implement in the same shadcn pattern.

### 17.1 StatusPill (incident workflow)

Used to indicate alert lifecycle status in the new triage view (Module 18).

```
[● NEW]            bg: bg-surface-3, text: text-primary, dot: blue-400
[● INVESTIGATING]  bg: amber-500/15, text: amber-400, dot: amber-400
[● MITIGATED]      bg: green-500/15, text: green-500, dot: green-500
[● ACCEPTED RISK]  bg: bg-surface-3, text: text-secondary, dot: text-secondary
[● FALSE POSITIVE] bg: bg-surface-2, text: text-muted, dot: text-muted (text-decoration: line-through on alert title)
```

Same dimensions as SeverityBadge (height 20px, padding 0 8px, text-xs uppercase). StatusPill is rendered to the *right* of SeverityBadge — never replacing it. Both visible together.

### 17.2 ComplianceFlag (sanctions / regulatory)

A small inline badge that appears beside a watchlist entity name when it has hit a sanctions list.

```
[⚠ OFAC SDN]   bg: severity-critical/15, text: severity-critical
[⚠ UN 1267]    bg: severity-critical/15, text: severity-critical
[⚠ EU CONS.]   bg: severity-critical/15, text: severity-critical
```

- Lucide icon: `shield-alert` at 12px
- Text: list short-name in monospace
- Hover: tooltip with full list name + match score + last-screened-at + link to public source
- Click: opens compliance-detail modal

### 17.3 ValueExposureBar (VaR engine)

A horizontal bar showing financial exposure with confidence interval.

```
Estimated stalled value
₹4.2 Cr ± ₹1.1 Cr
[████████░░░░░░░░░░░░░░░] 28% of monthly trade flow
```

- Numerator value: text-xl, weight-600, monospace, tabular-nums
- Confidence range: text-sm, text-secondary, monospace
- Bar: 8px tall, bg-surface-2 background, severity-colored fill (red ≥ 25%, orange 10–25%, yellow 3–10%, blue < 3%)
- Right caption: text-xs, text-muted, "% of monthly trade flow"

### 17.4 ImpactChain (multi-tier supplier graph alert presentation)

Inline visualization of how an event propagates through the supply graph.

```
🌐 Yemen event
    ↓ proximity
🏭 Tier-3 raw material supplier (Djibouti)
    ↓ supplies
🏭 Tier-2 component supplier (Mumbai)
    ↓ supplies
🏭 Tier-1 finished-goods plant (Hyderabad)
    ↓ ships to
🏴 Customer destination (Kenya)
```

- Vertical layout, 32px between nodes
- Each node = EntityChip with type icon
- Connector line = 2px dashed border, severity-tinted
- Connector label = text-xs, text-muted, italic
- Each tier is also given a one-line "impact reason" in text-secondary below the node name
- Topmost node (the event itself) has a severity-colored glow ring
- Bottommost node (the customer's exposure) has a value annotation: "₹X stalled"

### 17.5 RiskScoreDial (homepage / heatmap)

A horizontal arc gauge showing 0–100 risk score for the org, region, or route.

```
        ┌──────── 100
       /
      /
    67────────────────  (current value — needle/marker)
      \
       \
        └──────── 0

  CURRENT RISK    67 / 100
  vs peers       median 42, 90th-pct 78
  trend (90d)    ▁▂▃▄▅▆▆▇   ↑ +18
```

- Arc: 200°, severity-colored gradient (green → yellow → orange → red)
- Marker: 4px circle in text-primary
- Numbers: monospace, tabular-nums
- Trend sparkline: 24px tall, severity-colored
- Peer comparison: optional, gray text below

### 17.6 ScenarioCard

Used in the scenario library + saved-scenarios list.

```
┌─────────────────────────────────────────────────────┐
│ 🌊  Suez closure — 14 days                          │
│ [● HIGH]                                            │
│                                                     │
│ Affects: 12 entities · 3 routes · 2 ports           │
│ Est. exposure: ₹8.4 Cr ± ₹2.1 Cr                    │
│ Last run: 3 days ago                                │
│                                                     │
│                          [Run] [Duplicate] [Edit]   │
└─────────────────────────────────────────────────────┘
```

- bg-surface, border-subtle, radius-lg, p-4
- Icon top-left (32px, severity-tinted)
- Title text-base weight-500
- Severity badge below title
- Stats: text-sm text-secondary, vertically stacked or comma-separated
- Actions: ghost buttons, visible on hover

### 17.7 AssigneeAvatar

For the incident workflow — shows who owns an alert.

- 24px circle, initials in monospace (uppercase, tracking-tight, weight-500)
- Color: deterministic from user id hash → muted palette (no rainbow colors; mute everything to match the dashboard)
- Hover: tooltip with name, role, last-active
- Unassigned state: dashed-border circle with `+` icon

### 17.8 HeatmapLegend

Companion for the Mapbox heatmap layer (Module 20).

```
RISK INTENSITY
░ Low     0–20
▒ Medium  20–50
▓ High    50–80
█ Critical 80+
```

- Anchored bottom-right of the map
- bg-surface with backdrop blur
- text-xs, text-secondary
- Each row: 12px swatch (severity color at varying opacity) + range label

---

## 18. Eight New Screens (v1.5 Command Tier)

Generate one mockup per screen. All in dark mode. All at 1440×900 desktop viewport.

The numbering continues from §8 (which had 8 v1 screens). These are screens 9–16.

---

### SCREEN 9 — Multi-Tier Supplier Graph (Module 16)

**URL:** `/app/sundaram-pharma/watchlist/graph`

**Purpose:** Visualize the supply chain dependencies registered for this org. The graph view that turns "watchlist" into "ontology."

**Layout:**

```
Page header: "Supply Graph" + "Tier-1: 12 · Tier-2: 38 · Tier-3: 64"
                                                    [Import] [Export]

Toolbar:
[Filter by product ▾] [Filter by region ▾] [Tier: All ▾]   [🔍 Search]

Canvas (full-width, ~700px tall):
  Force-directed graph (or layered DAG layout)
  - Nodes: entity chips with type icon + tier number badge
  - Edges: relationship type ("supplies", "ships via", "depends on")
  - Color: severity (red = on-fire / has open critical alert; zinc = nominal)
  - Selected node: highlighted, shows side-panel detail
  - Edge labels appear on zoom

Right panel (when node selected, 320px wide):
  - Entity name + type + tier
  - Active alerts on this entity (count + most recent)
  - Upstream parents (list)
  - Downstream dependents (list)
  - Estimated monthly throughput (₹)
  - "Open in watchlist →"
```

**Generate this prompt:**

> Generate a multi-tier supply chain graph visualization page for a dark-mode geopolitical risk dashboard. Page title "Supply Graph" with subtitle showing tier counts. Below: filter toolbar with product/region/tier dropdowns and search. Main canvas (full width, 700px tall) shows a layered DAG: top layer is 4 customer destinations (flag icons), middle layers are tier-1 plants (12 factory icons), tier-2 component suppliers (38 nodes, smaller), tier-3 raw material sources (64 nodes, smallest). Edges are 1px dashed lines in bg-surface-3, severity-colored where active alerts exist on a path. One path is highlighted in red showing event propagation: tier-3 Djibouti node (red glow) → tier-2 Mumbai node (orange) → tier-1 Hyderabad plant (orange) → Kenya destination (orange). Right panel 320px wide shows selected node detail: entity name, tier badge, 2 active alerts, upstream/downstream lists. Background bg-base, nodes on bg-surface (bg-surface), edges subtle. Reference: Linear roadmap dependency view, Datadog service map. Calm, dense, technical. No animations on first render.

---

### SCREEN 10 — Compliance & Sanctions Center (Module 17)

**URL:** `/app/sundaram-pharma/compliance`

**Purpose:** The trade finance / compliance officer's home base.

**Layout:**

```
Page header: "Compliance" + "47 entities screened daily · Last sync 14m ago"

Top row — three stat cards:
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ HITS        │ │ LISTS SYNCED│ │ LAST SCREENING│
│   3         │ │   6         │ │   14m ago     │
│ on watchlist│ │ OFAC,UN,EU..│ │   automated   │
└─────────────┘ └─────────────┘ └─────────────┘

Hits table:
┌────────────────────────────────────────────────────────────────┐
│ ENTITY              LIST       ENTRY MATCHED   SCORE   STATUS  │
├────────────────────────────────────────────────────────────────┤
│ 🏭 Acme Trading FZE OFAC SDN  ACME TRADING…   97%    OPEN    │
│ 🏴 Country X       UN 1267    Sanctions A.P.   100%   OPEN    │
│ 🏭 Logistics Co.   EU CONS.   Logistics Co.    91%    REVIEW  │
└────────────────────────────────────────────────────────────────┘

Lists table (lower):
┌────────────────────────────────────────────────────────────────┐
│ LIST            VERSION    LAST SYNC     ENTITIES    NEXT SYNC │
├────────────────────────────────────────────────────────────────┤
│ OFAC SDN        2024.05.12 14m ago      14,832      6h        │
│ UN 1267         2024.05.10 2d ago       1,144       weekly    │
│ EU Consolidated 2024.05.11 1d ago       2,406       daily     │
│ UK HM Treasury  2024.05.12 14m ago      3,218       daily     │
│ India MEA       2024.05.09 3d ago       412         weekly    │
│ Custom org list 2024.05.12 manual       8           manual    │
└────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a compliance and sanctions screening dashboard for a dark-mode B2B SaaS. Top: page title "Compliance" + subtitle "47 entities screened daily · Last sync 14m ago". Three stat cards in a row: "Hits 3 (on watchlist)", "Lists Synced 6", "Last Screening 14m ago". Below: hits table with columns ENTITY (with type icon), LIST (in monospace, like "OFAC SDN", "UN 1267"), ENTRY MATCHED (italics, the matched name), SCORE (percentage), STATUS (StatusPill: OPEN red, REVIEW amber). Three example rows showing different list types, scores 97%, 100%, 91%. Below: lists table with columns LIST, VERSION (monospace date), LAST SYNC (relative time), ENTITIES (number, tabular-nums), NEXT SYNC (cadence). Six rows representing OFAC SDN, UN 1267, EU Consolidated, UK HM Treasury, India MEA, Custom. All numbers tabular-nums monospace. Background bg-base, tables on bg-surface, severity-colored hits. No charts, no decoration — table-dense, audit-trail aesthetic. Reference: Stripe Atlas compliance, Mercury treasury page. Bureaucratic in the right way.

---

### SCREEN 11 — Incident Triage Board (Module 18)

**URL:** `/app/sundaram-pharma/alerts?view=triage`

**Purpose:** Linear-style kanban for active geopolitical incidents. The shift from "alert feed" to "operational system of record."

**Layout:**

```
Page header: "Triage" + "12 open incidents · 3 critical · avg time-to-mitigation 4h 12m"
                                                  [Filter ▾] [Assign me] [+ New]

Kanban swimlanes (4 columns, equal width):

┌─────────────┬─────────────┬─────────────┬─────────────┐
│ NEW (4)     │ INVESTIGAT- │ MITIGATED   │ ACCEPTED    │
│             │ ING (5)     │ (LAST 7D)   │ (LAST 7D)   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [● CRIT]    │ [● HIGH]    │ [● MED]     │ [● LOW]     │
│ Houthi      │ Mombasa     │ Sudan       │ Iran banking│
│ strike      │ port closur │ unrest      │ sanctions   │
│ Hodeidah    │             │             │ update      │
│ ⏱ 4m       │ ⏱ 2h 10m   │ resolved 2d │ accepted 3d │
│ unassigned  │ Priya M.    │ Rohan K.    │ Priya M.    │
│             │             │             │             │
│ [● HIGH]    │ [● MED]     │ ...         │ ...         │
│ Suez        │ Nairobi     │             │             │
│ vessel      │ port delay  │             │             │
│ ...         │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Generate this prompt:**

> Generate an incident triage kanban board for a dark-mode operations dashboard. Top: page title "Triage" + subtitle "12 open incidents · 3 critical · avg time-to-mitigation 4h 12m" plus filter and "+ New" buttons. Below: 4-column kanban with column headers "NEW (4)", "INVESTIGATING (5)", "MITIGATED (LAST 7D)", "ACCEPTED (LAST 7D)". Each column is a vertical list of incident cards on bg-surface. Each card shows: severity badge top-left (Critical=red, High=orange, Medium=yellow, Low=blue), short title, location row with country flag/port icon, time-elapsed ⏱ in monospace, assignee avatar (24px circle with initials) bottom-right. Column 1 has 4 cards (top one unassigned, dashed-border avatar). Column 2 has 5 cards with assignees. Cards in mitigated column have green checkmark. Cards have subtle severity-colored left border 3px. Drag handles implied (small grip dots top-left on hover). Background bg-base, columns are slightly lighter bg-surface, cards are bg-surface with border-subtle. Aesthetic reference: Linear cycles board, Pylon inbox. Dense, calm, professional.

---

### SCREEN 12 — Scenario Simulator (Module 19)

**URL:** `/app/sundaram-pharma/scenarios/[id]`

**Purpose:** War-gaming. The signature "Palantir-class" feature for the mid-market.

**Layout:**

```
Breadcrumb: Scenarios / Suez Closure — 14 Days

┌─────────────────────────────────────────────────────────────────┐
│ 🌊 Suez Closure — 14 Days                  [● HIGH]              │
│ Hypothetical · Last run 3 days ago                               │
│                                          [Run scenario] [Edit]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ LEFT (40%): Inputs                                              │
│ ┌─────────────────────────────────────────────┐                 │
│ │ Event type:  Maritime closure ▾             │                 │
│ │ Region:      Red Sea / Suez                 │                 │
│ │ Duration:    14 days                        │                 │
│ │ Severity:    High ▾                         │                 │
│ │ Start:       Today                          │                 │
│ │                                             │                 │
│ │ Affected lanes:                             │                 │
│ │   ☑ India → East Africa                     │                 │
│ │   ☑ India → Mediterranean                   │                 │
│ │   ☐ India → Persian Gulf                    │                 │
│ └─────────────────────────────────────────────┘                 │
│                                                                 │
│ RIGHT (60%): Projected impact                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ AFFECTED                                                    │ │
│ │   12 entities · 3 routes · 2 ports                          │ │
│ │                                                             │ │
│ │ ESTIMATED EXPOSURE                                          │ │
│ │   ₹8.4 Cr ± ₹2.1 Cr                                         │ │
│ │   [████████████░░░░░░░] 28% of monthly trade flow           │ │
│ │                                                             │ │
│ │ TIMELINE                                                    │ │
│ │   Days 1–3:    Re-routing window closes                     │ │
│ │   Days 4–10:   ₹6.2 Cr cargo in transit affected            │ │
│ │   Days 11–14:  Customer SLA breaches likely                 │ │
│ │                                                             │ │
│ │ RECOMMENDED MITIGATIONS (AI)                                │ │
│ │ • Re-route 8 shipments via Cape of Good Hope (+12d, +18% cost)│
│ │ • Hold 4 shipments for 7 days, reassess                     │ │
│ │ • Negotiate force-majeure with 2 customers                  │ │
│ │ • Activate insurance war-risk endorsement                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Affected entities (table, expanded below)                       │
└─────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a scenario simulator detail page for a dark-mode geopolitical risk dashboard. Breadcrumb at top "Scenarios / Suez Closure — 14 Days". Below: large header card with wave emoji icon, scenario title "Suez Closure — 14 Days", High severity badge, subtitle "Hypothetical · Last run 3 days ago", right-aligned buttons "Run scenario" (primary) and "Edit" (secondary). Below: two-column layout. LEFT 40% — inputs panel showing form fields: Event type dropdown, Region (text), Duration (14 days), Severity (High), Start date (Today), then "Affected lanes" with three checkboxes (two checked). RIGHT 60% — projected impact panel with 4 sections separated by dividers: "AFFECTED" (large numbers: 12 entities, 3 routes, 2 ports), "ESTIMATED EXPOSURE" (large value ₹8.4 Cr ± ₹2.1 Cr in monospace, then a horizontal bar showing 28% fill in orange), "TIMELINE" (3 phased bullet points with date ranges in monospace), "RECOMMENDED MITIGATIONS" (4 bullets, marked AI-generated). All sections separated by hairline border-subtle dividers. All numbers in tabular-nums monospace. Background bg-base, cards on bg-surface. Calm, technical, decision-support feel. Reference: a quant trading "what-if" panel, Bloomberg risk analytics. Avoid: charts, gradients, dramatic emphasis.

---

### SCREEN 13 — Risk Heatmap & Portfolio Exposure (Module 20)

**URL:** `/app/sundaram-pharma/exposure`

**Purpose:** The executive view. The COO's bookmarked page.

**Layout:**

```
Page header: "Exposure" + "Live · updated every 5 minutes"

Top row — overall risk dial:
┌─────────────────────────────────────────────────────────────┐
│  CURRENT RISK SCORE                                         │
│                                                             │
│      67 / 100   [HIGH]                                      │
│      ▁▂▃▄▅▆▆▇  90-day trend  ↑ +18                          │
│                                                             │
│      vs peer median 42 · vs 90th percentile 78              │
└─────────────────────────────────────────────────────────────┘

Map heatmap (full-width, 500px tall):
  Mapbox dark style with heatmap layer overlay (red intensity = current
  risk concentration). Watchlist pins overlaid. Active event markers
  pulsing.

Below map — 3-column breakdown:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ BY ROUTE     │ │ BY REGION    │ │ BY SECTOR    │
│              │ │              │ │              │
│ Red Sea  ●89 │ │ MENA     ●78 │ │ Pharma   ●67 │
│ Suez     ●76 │ │ Africa   ●54 │ │ Logistics ●43│
│ S. China ●41 │ │ Asia     ●38 │ │ Banking  ●12 │
│ Persian  ●38 │ │ Europe   ●22 │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

Detailed list:
Top 10 entities at risk (table)
```

**Generate this prompt:**

> Generate a risk exposure dashboard for a dark-mode B2B SaaS. Page title "Exposure" + subtitle "Live · updated every 5 minutes". Top hero panel: a 200° arc gauge showing risk score 67/100 in large monospace numbers, color gradient on the arc (green at 0, yellow at 40, orange at 60, red at 100), needle marker at 67 in the orange zone, "[HIGH]" label badge, below it a 90-day sparkline trend with "↑ +18" in red, and a peer-comparison line "vs peer median 42 · vs 90th percentile 78" in text-secondary. Below: full-width Mapbox dark map (500px tall) with a red-orange-yellow heatmap layer overlaid showing risk concentration (heaviest in Red Sea / Yemen / Sudan area), watchlist pins as small blue dots, and 3 pulsing red event markers. Bottom-right of map: HeatmapLegend small panel. Below map: three side-by-side breakdown panels — "BY ROUTE", "BY REGION", "BY SECTOR" — each with 4 rows showing entity name + numeric score on a color-coded dot scale (red 80+, orange 50-80, yellow 20-50, blue 0-20). All in monospace tabular-nums. Background bg-base, panels on bg-surface. Aesthetic: Bloomberg risk analytics meets Datadog dashboards. Executive-ready, dense, no decoration.

---

### SCREEN 14 — Value-at-Risk / Financial Exposure View (Module 21)

**URL:** `/app/sundaram-pharma/exposure/financial`

**Purpose:** Translate alerts into rupees. The view the COO actually opens during a crisis.

**Layout:**

```
Page header: "Financial Exposure" + "₹4.2 Cr currently at risk · 28% of monthly trade flow"

Top — exposure summary card:
┌─────────────────────────────────────────────────────────────┐
│ AT RISK NOW                                                 │
│                                                             │
│   ₹4.2 Cr   ± ₹1.1 Cr                                       │
│   [████████░░░░░░░░░░] 28% of monthly trade flow            │
│                                                             │
│   Stalled              ₹2.8 Cr  (8 shipments, in transit)   │
│   Re-routing required  ₹1.1 Cr  (3 shipments, pre-departure)│
│   At supplier delay    ₹0.3 Cr  (2 POs, raw material)       │
└─────────────────────────────────────────────────────────────┘

Time-series chart (90 days):
  Daily exposure value, severity-banded background

Active exposures table:
┌──────────────────────────────────────────────────────────────┐
│ EVENT          ENTITY         VALUE     CONFIDENCE  STATUS    │
├──────────────────────────────────────────────────────────────┤
│ Houthi strike  Suez route     ₹2.1 Cr   ±0.6 Cr    Stalled    │
│ Mombasa closure Mombasa port  ₹0.8 Cr   ±0.2 Cr    Re-routing │
│ Sudan unrest   Khartoum supp. ₹0.3 Cr   ±0.1 Cr    Delayed    │
│ ...                                                           │
└──────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a Value-at-Risk financial exposure dashboard for a dark-mode B2B trade SaaS. Page title "Financial Exposure" + subtitle "₹4.2 Cr currently at risk · 28% of monthly trade flow". Top hero card: large monospace value "₹4.2 Cr" in 32px weight-600, beside it "± ₹1.1 Cr" in text-secondary, below a horizontal bar 8px tall showing 28% orange fill labeled "% of monthly trade flow", then a small breakdown table with three rows: Stalled ₹2.8 Cr (8 shipments), Re-routing required ₹1.1 Cr (3 shipments), At supplier delay ₹0.3 Cr (2 POs). Below: 90-day time-series area chart in Recharts style, x-axis dates, y-axis ₹ in Cr, area fill in severity-orange at 30% opacity, line on top in severity-orange, severity-banded background (red horizontal band above ₹3Cr threshold). Below: active exposures table with columns EVENT, ENTITY (with icon), VALUE (monospace ₹), CONFIDENCE (±), STATUS (StatusPill). All amounts in tabular-nums monospace. Background bg-base, cards on bg-surface. Aesthetic: Bloomberg P&L view, Stripe revenue analytics. CFO-ready. No decoration.

---

### SCREEN 15 — Risk Brief Generator Preview (Module 26)

**URL:** `/app/sundaram-pharma/alerts/[id]/brief`

**Purpose:** The 1-page PDF that gets shared with the customer's bank, customer, or board. Preview before generating.

**Layout:**

```
Top toolbar:
[Format: 1-pager ▾] [Audience: Customer ▾]   [Regenerate] [Download PDF] [Share link]

Preview pane (centered, white-on-bg-base — represents the PDF):
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [SUNDARAM PHARMA logo]                                    │
│   Risk Brief — 15 March 2025                                │
│                                                             │
│   ─────────────────────────────────────────                 │
│                                                             │
│   ⚠ HIGH SEVERITY                                           │
│   Maritime incident — Hodeidah, Yemen                       │
│                                                             │
│   What happened                                             │
│   At 14:23 UTC on 15 March 2025, a maritime incident       │
│   was reported off the port of Hodeidah, Yemen, affecting   │
│   commercial shipping in the Bab-el-Mandeb strait.          │
│                                                             │
│   How this affects you                                      │
│   - Suez-routed shipments may be delayed 48–72 hours        │
│   - Three of your shipments are currently in this corridor  │
│   - Estimated stalled value: ₹2.1 Cr                        │
│                                                             │
│   Actions taken                                             │
│   - Re-routing protocol activated                           │
│   - Insurance broker notified at 14:35 UTC                  │
│                                                             │
│   What's still at risk                                      │
│   - Two POs scheduled for departure 16–18 March             │
│   - Customer SLAs in Mombasa and Dar es Salaam              │
│                                                             │
│   Sources: Reuters, Maritime Executive, Al-Masirah          │
│                                                             │
│   Generated by Syntra · sundaram-pharma             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Right panel: Share link controls
  - Public link toggle
  - Expiry: 7 days ▾
  - Password protect ☐
  - Copy link button
```

**Generate this prompt:**

> Generate a risk brief PDF preview screen for a dark-mode B2B dashboard. Top toolbar: "Format: 1-pager" dropdown, "Audience: Customer" dropdown, right-side buttons "Regenerate", "Download PDF" (primary), "Share link". Below: centered preview pane that mimics a printed PDF — bg-zinc-100 card 800px wide, 1100px tall, with serif typography (Charter / Source Serif), showing: company logo top-left, "Risk Brief — 15 March 2025" headline, hairline divider, "⚠ HIGH SEVERITY" with severity-colored ribbon, section "Maritime incident — Hodeidah, Yemen" as title, then 4 prose sections: "What happened" (3 lines), "How this affects you" (3 bullets including ₹ exposure), "Actions taken" (2 bullets with timestamps), "What's still at risk" (2 bullets). Footer: small text "Sources: Reuters, Maritime Executive, Al-Masirah" and "Generated by Syntra". The PDF preview itself is on a light cream background (zinc-100) so it looks like a real printed document inside the dark dashboard frame. Right side panel 240px wide: "Share link" controls — toggle for public link, expiry dropdown (7 days), password-protect checkbox, "Copy link" button with monospace URL field. Background of the dashboard around the preview is bg-base. Reference: Notion page export preview, Stripe invoice preview. Honest document feel — not a marketing piece.

---

### SCREEN 16 — Slack Native Integration Setup (Module 23)

**URL:** `/app/sundaram-pharma/settings/integrations/slack`

**Purpose:** Connect Slack workspace and configure routing. The buyer lives here, not in our dashboard.

**Layout:**

```
Page header: "Slack" + "Receive interactive alerts in your team's Slack."

Connection card:
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Connected to Sundaram Pharma workspace                    │
│ Connected by Priya Mehta · 2 days ago                       │
│                                  [Reconnect] [Disconnect]   │
└─────────────────────────────────────────────────────────────┘

Channel routing rules:
┌─────────────────────────────────────────────────────────────┐
│ ROUTING RULES                                               │
│                                                             │
│ When alert severity:  [Critical ▾]                          │
│ Send to channel:      [#supply-chain-alerts ▾]              │
│ With buttons:         [Acknowledge] [Assign to me] [Forward]│
│                                                             │
│ When alert severity:  [High ▾]                              │
│ Send to channel:      [#supply-chain-alerts ▾]              │
│ With buttons:         [Acknowledge] [Assign to me]          │
│                                                             │
│ When alert severity:  [Medium ▾]                            │
│ Send to channel:      [#ops-watch ▾]                        │
│                                                             │
│                                  [+ Add rule] [Save changes]│
└─────────────────────────────────────────────────────────────┘

Preview:
┌─────────────────────────────────────────────────────────────┐
│ PREVIEW                                                     │
│                                                             │
│ This is what your team will see in #supply-chain-alerts:    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  ⚡ Syntra  APP                                 │ │
│ │                                                         │ │
│ │  🔴 CRITICAL — Houthi missile strike near Hodeidah port │ │
│ │  📍 Yemen · 4 minutes ago                               │ │
│ │                                                         │ │
│ │  Affects: Suez route, Hodeidah Port, Yemen              │ │
│ │  Estimated exposure: ₹2.1 Cr                            │ │
│ │                                                         │ │
│ │  [✓ Acknowledge] [Assign to me] [Forward to channel]    │ │
│ │                                                         │ │
│ │  📎 View in Syntra →                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a Slack integration setup page for a dark-mode B2B dashboard. Page title "Slack" + subtitle "Receive interactive alerts in your team's Slack." Below: green-tinted connection success card showing workspace name "Sundaram Pharma", "Connected by Priya Mehta · 2 days ago", reconnect/disconnect buttons. Below: routing rules card with three rule rows, each row showing severity dropdown (Critical/High/Medium), channel dropdown (#supply-chain-alerts, #ops-watch), and toggleable interactive buttons (Acknowledge, Assign to me, Forward). "+ Add rule" ghost button at bottom. Below: preview card showing what an actual Slack message will look like — a faithful Slack message mockup inside a card, with Syntra app badge, red Critical heading, location + time, "Affects:" entity chips, "Estimated exposure: ₹2.1 Cr" line, three Slack-style action buttons in primary green, footer link "View in Syntra →". The Slack preview should look like Slack — not Syntra — so render it on a light gray background (#F8F8F8) inside the dashboard frame to make the contrast clear. Background bg-base elsewhere, cards on bg-surface. Reference: Linear's Slack integration setup, Resend's webhook setup. Functional, clear, no marketing.

---

## 19. Updated Voice & Microcopy For Command Tier

The v1 voice guide (§13) still applies. Add for v1.5:

- **Compliance language:** factual + traceable. "Match score 97% to OFAC SDN entry ACME TRADING (last sync 14m ago)." Not "we found a possible sanctions match."
- **Financial exposure:** always confidence-bounded. "₹4.2 Cr ± ₹1.1 Cr" not "₹4.2 Cr." Single-point estimates feel falsely precise.
- **Scenarios:** always marked as hypothetical. The word "Hypothetical" or "What-if" appears prominently. We do not let users mistake a scenario projection for a current alert.
- **AI-generated content:** always labeled. The recommended-actions and risk briefs include a small "AI-generated" tag at the section level. No silent LLM output.
- **Multi-tier propagation:** explicit. "Event affects your tier-2 supplier in Djibouti, which feeds your tier-1 plant in Hyderabad." We name the chain; we do not hide it.

---

## 20. Mockup Generation Workflow (Updated For v1.5)

For each new screen (9–16):

1. Copy the "Generate this prompt" block under the screen
2. Generate 2–3 variants in Stitch / Claude Design / v0
3. Pick the strongest, save the screenshot
4. Save into `/specs/12-design.md` under "v1.5 mockups"
5. Reference in the corresponding module spec (e.g., M16 spec links to Screen 9 mockup)

If a mockup includes any of the following, **regenerate**:

- Gradients in the dashboard chrome
- Glassmorphism or blur effects on cards
- Decorative illustrations
- Light-mode versions
- Shadows instead of border-emphasis
- Accent colors other than blue-500
- Type weights other than 400/500/600
- Rounded-2xl or larger
- Animations other than the ones in §12

These are not stylistic preferences. They are the rules. The visual continuity between v1 and v1.5 is what makes the product feel like one coherent thing rather than a Frankenstein of features bolted on as the company grew.

---

## 21. Summary of Component Inventory After v1.5

| Component | Source | Used in screens |
|---|---|---|
| SeverityBadge | v1 | All alert surfaces |
| EntityChip | v1 | Alerts, watchlist, graph |
| Button (4 hierarchies) | v1 | Everywhere |
| Input field | v1 | Forms |
| Card / Panel | v1 | Everywhere |
| Alert row | v1 | Feed |
| StatusPill | v1.5 (§17.1) | Triage board, alert detail |
| ComplianceFlag | v1.5 (§17.2) | Compliance center, watchlist, alerts |
| ValueExposureBar | v1.5 (§17.3) | Financial exposure, scenario, alerts |
| ImpactChain | v1.5 (§17.4) | Multi-tier alerts, supply graph alerts |
| RiskScoreDial | v1.5 (§17.5) | Exposure dashboard |
| ScenarioCard | v1.5 (§17.6) | Scenario library |
| AssigneeAvatar | v1.5 (§17.7) | Triage, alert detail |
| HeatmapLegend | v1.5 (§17.8) | Maps with heatmap layer |

Total: 6 v1 components + 8 v1.5 components = 14. Resist the urge to add more. Every additional primitive is a tax on consistency.

---

*End of Part II. Same restraint, more surface area. Generate, iterate, ship.*

---

# PART III — OPERATIONAL FOUNDRY UI (post-YC scope)

> **Scope:** UI specifications for the 11 modules (M28–M38) defined in `syntra_buildplan.md` Part III. Continues the v2 visual language unchanged — same navy-charcoal palette, same `w-64` sidebar, same borders-not-shadows, same `150ms ease-out`, same Geist Mono mandate. We are *adding surfaces*, not redesigning.
>
> **Anti-goal (still):** do not let the operational suite drift into "premium" visual chrome as features pile on. The v3 features are higher-tier in pricing, not in visual decoration. Information density rises; gradient/shadow/animation budget stays at zero.

---

## 22. New Components for Operational Foundry

### 22.1 ReliabilityBadge

A tier letter (A–F) inside a small chip indicating source trustworthiness per Admiralty Code.

```
[A]  bg: green-500/15,  text: green-500,   border: green-500/30
[B]  bg: blue-500/15,   text: blue-500,    border: blue-500/30
[C]  bg: yellow-500/15, text: yellow-500,  border: yellow-500/30
[D]  bg: orange-500/15, text: orange-500,  border: orange-500/30
[E]  bg: red-500/15,    text: red-500,     border: red-500/30
[F]  bg: bg-surface-3,  text: text-muted,  border: bg-surface-3
```

- 20×20px square, radius `sm` (4px), letter centered, weight 600, monospace
- Hover: tooltip showing tier definition + bias disclosure if any
- Always rendered next to source publication name in alert/event detail

### 22.2 ConfidenceInterval

Range visualization for severity, location radius, or any uncertain claim.

```
Severity:  [low ──── medium ─■■■── high ──── critical]
                              ↑
                           p50 (point estimate)
                       ↑──────↑
                       p10–p90 confidence band

Location radius:  18 km ± 7 km
                  [████████░░░░░░░░░░] p10  [███████████████░░░░] p90
```

Implementation: 4-stop horizontal bar (severity tiers as colored zones), point estimate marker, p10–p90 shaded band overlaid in `text-secondary` at 30% opacity.

For numeric ranges (km, currency): two-bar variant with monospace numbers and ± annotation.

### 22.3 HowWeKnowPanel

Expandable panel on alert detail showing methodology, sources, and time-of-knowledge.

```
┌─────────────────────────────────────────────────────────┐
│ ▸ How we know this                            [Verify]   │
├─────────────────────────────────────────────────────────┤
│ Corroborated by 3 distinct publications.                 │
│ First seen:  14:23 UTC, 15 March 2026                    │
│ You notified: 14:25 UTC (2m 0s after we knew)            │
│ Public confirmation: 16:40 UTC (you led by 2h 15m)       │
│                                                          │
│ Sources:                                                 │
│   [A] Reuters     "Houthi rebels strike..." 14:23 UTC    │
│   [B] Al Jazeera  "Maritime incident..."     14:31 UTC   │
│   [B] Lloyd's List "Risk advisory: Bab el..." 14:48 UTC  │
│                                                          │
│ Methodology:                                             │
│   Geocoded via OSM + manual port lookup. Severity        │
│   classified by impact-keywords (strike, missile, vessel) │
│   confirmed by 2+ independent sources within 25 minutes. │
│   Confidence: 92%.                                       │
│                                                          │
│ [View full provenance →]                                 │
└─────────────────────────────────────────────────────────┘
```

- Default collapsed; click chevron to expand
- "Verify" button generates a signed verification URL (cryptographic alert signing)
- "View full provenance" navigates to Screen 17 (Provenance Graph)

### 22.4 ExposureDelta sparkline

Compact daily change indicator for portfolio exposure.

```
₹6.8 Cr   ▲ +₹2.6 Cr (+62%)   ▁▁▂▃▄▆▇   today vs 7d avg
```

- Value in monospace, large (text-lg)
- Delta in severity color (red if up, green if down — opposite of stock-market convention because UP means MORE exposure = WORSE)
- Sparkline 24px tall, severity-tinted

### 22.5 HHI heatmap row

Concentration risk by dimension.

```
SUPPLIERS BY REGION
  Maharashtra  ████████████░░░░░░░░  62%   HHI: 3,840  ⚠
  Tamil Nadu   ████░░░░░░░░░░░░░░░░  21%
  Gujarat      ███░░░░░░░░░░░░░░░░░  12%
  Other        ██░░░░░░░░░░░░░░░░░░   5%

  Concentration: HIGH (HHI > 2,500 industry threshold)
```

### 22.6 ContractClauseCard

Renders a single extracted clause from M31.

```
┌──────────────────────────────────────────────────────────┐
│ Force Majeure                          confidence: 94%   │
│                                                          │
│ Scope: war, civil unrest, port closure, cyclone, sanc-   │
│ tions, plague, government action                         │
│ Notice period: 5 business days                           │
│ Cure period: 30 days                                     │
│                                                          │
│ Source excerpt:                                          │
│ "Neither party shall be liable for delay or failure to   │
│  perform... due to events beyond reasonable control..."  │
│                                                          │
│ [Edit clause]                              [Verified ✓]  │
└──────────────────────────────────────────────────────────┘
```

### 22.7 WarRoomChatBubble

For the war-room collaborative space.

```
[avatar] Priya Mehta · Ops Lead · 14:42 UTC
         ─────────────────────────────────
         I've notified MarineTraffic for live AIS on MV
         Hyderabad. ETA confirmation in 15m.

         [📎 ais-screenshot.png]      [✓ Acknowledged by 3]
```

- Avatar 24px, name + role + timestamp in single line
- Body in `text-primary`, 14px
- Attachments as inline EntityChip-style pills
- Acknowledgment count if multi-party

### 22.8 ForecastBadge

**Critical: visually distinct from real-time alert severity badges to prevent confusion.**

```
[FORECAST · 67% in 14d]   bg: orange-500/10, border: orange-500/40,
                          text: orange-500, prefix icon: 🔮
```

- Always includes the word "FORECAST" in caps
- Always includes confidence % and time horizon
- Border has stipple/dashed pattern (1.5px dashed) — distinct from solid SeverityBadge
- Never red (red = real). Always orange or blue spectrum.

### 22.9 CountdownTimer

For SLAs, contract expiries, sanction effective dates.

```
[⏱ 14h 22m]  bg: yellow-500/10, text: yellow-500   — running, < 24h
[⏱ 3d 4h]   bg: blue-500/10,   text: blue-500     — running, < 7d
[⏱ EXPIRED] bg: red-500/15,    text: red-500      — past
```

### 22.10 ProvenanceNode (graph primitive)

A single node in the provenance DAG (alert/event/article/extraction-step).

```
┌─────────────────────┐
│ [icon] Title         │
│ subtitle in mono     │
│ [chips/badges]       │
└─────────────────────┘
```

- bg: `bg-surface`, border: `bg-surface-2`, radius `md` (6px)
- Icon size: 16px, color by node type
- Hover: border becomes `accent`
- Selected: 2px `accent` border, no fill change
- Min width 180px, max width 280px

### 22.11 IndicatorGauge

Leading indicator level visualization.

```
  Iran-Israel rhetoric escalation
  ▁▂▃▄▆▇▇  rising  · level 0.78  · breach threshold 0.75 ⚠
```

- Sparkline 24px, severity-tinted at current level
- Level value in monospace (0.00–1.00)
- Threshold marker as a vertical hairline at threshold value

---

## 23. New Screens for Operational Foundry

Screens 17–49. Generate one mockup per screen using the prompt blocks below. All in dark navy-charcoal mode at 1440×900 desktop viewport.

### SCREEN 17 — Provenance Graph View

**URL:** `/app/[orgSlug]/alerts/[id]/provenance`

**Purpose:** The trust moat made visible. Every claim traceable to source.

**Layout:**

```
Breadcrumb: Alerts / Houthi strike — Hodeidah / Provenance

Top header:
  Provenance Graph
  3 sources · confidence 92% · we knew at 14:23 UTC, you led by 2h 15m

Canvas (full width, ~700px tall):
  Layered DAG, top to bottom:
   Layer 1 — Alert        (1 node, severity-colored)
                ▼
   Layer 2 — Events       (N event nodes)
                ▼
   Layer 3 — Articles     (M article nodes, each with reliability badge)
                ▼
   Layer 4 — Extraction   (extraction step subgraph per article)

  Edges labelled: "matched", "extracted from", "geocoded by", "classified by"
  Click any node → side panel detail

Right panel (when node selected):
  Node title + type
  Metadata table
  For articles: full excerpt, hash, ingestion timestamp
  For extraction: model used, prompt hash, output JSON
  "Verify integrity" button (re-runs hash check)
```

**Generate this prompt:**

> Generate a provenance graph visualization for a dark-mode geopolitical risk dashboard called "Syntra." Page title "Provenance Graph" with subtitle "3 sources · confidence 92% · we knew at 14:23 UTC, you led by 2h 15m". Main canvas (full width, 700px tall, bg-base #0B0E14) shows a 4-layer top-to-bottom DAG: Layer 1 has 1 alert node at top (severity-colored red ring around it, "Houthi strike — Hodeidah" inside), Layer 2 has 1 event node in middle ("Maritime incident, Bab el-Mandeb"), Layer 3 has 3 article nodes (Reuters with [A] badge in green, Al Jazeera with [B] badge in blue, Lloyd's List with [B] badge in blue), Layer 4 has 6 small extraction-step nodes per article showing "lang_detect → NER → geocode → classify → severity_score → corroborate". Edges are 1px dashed lines in #262C36, edge labels in monospace text-muted "extracted from" / "geocoded by" / "matched". Right panel 320px wide (bg-surface #151921) shows selected node detail: title, type, metadata table with monospace key-value pairs, full excerpt for articles, "Verify integrity" button (primary blue #3B82F6). All node titles in Geist Mono. Background bg-base, nodes on bg-surface, borders bg-surface-2 #1E2530. Reference: Linear roadmap dependency graph, Datadog service map, Apache Airflow DAG view. No shadows, no glow, calm and dense.

---

### SCREEN 18 — Source Reliability Center

**URL:** `/app/[orgSlug]/sources`

**Purpose:** Browse all sources, see tier assignments, dispute incorrect tiers.

**Layout:**

```
Page: Source Reliability
       2,847 sources · 6 tiers · last review 2 days ago
                                                    [Dispute a tier]

Filter bar: [Tier ▾] [Region ▾] [Language ▾]  [🔍 search]

Distribution row:
  [A] 412   [B] 1,089   [C] 743   [D] 318   [E] 89   [F] 196

Table:
┌──────────────────────────────────────────────────────────────────┐
│ SOURCE              TIER  BIAS DISCLOSURE      LAST REVIEW        │
├──────────────────────────────────────────────────────────────────┤
│ reuters.com         [A]   center · independent  2 weeks ago       │
│ aljazeera.com       [B]   Qatari state-funded   2 weeks ago       │
│ presstv.ir          [D]   Iranian state media   1 week ago   ⚠   │
│ ...                                                                │
└──────────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a source reliability center for a dark-mode B2B intelligence dashboard. Page title "Source Reliability" + subtitle "2,847 sources · 6 tiers · last review 2 days ago" with right-aligned "Dispute a tier" button. Filter bar with three dropdowns (Tier, Region, Language) and search. Below: tier distribution row showing 6 colored boxes side by side: A=412 (green), B=1089 (blue), C=743 (yellow), D=318 (orange), E=89 (red), F=196 (gray). Each box monospace count below colored letter. Below: dense table with columns SOURCE (publication name + domain in monospace beneath), TIER (ReliabilityBadge A-F), BIAS DISCLOSURE (italic text-secondary, e.g. "Qatari state-funded", "Iranian state media", "center · independent"), LAST REVIEW (relative time). Show 8 rows mixing tiers including reuters.com (A), aljazeera.com (B), presstv.ir (D, with warning icon), bbc.co.uk (A), maritimeexecutive.com (C), etc. Background bg-base #0B0E14, table on bg-surface #151921, borders bg-surface-2 #1E2530. All text in Inter, all metrics/dates in Geist Mono. Aesthetic: Stripe risk dashboard, Bloomberg terminal feeds page. Bureaucratic transparency, not marketing.

---

### SCREEN 19 — Decision Log

**URL:** `/app/[orgSlug]/decisions`

**Brief prompt:** Linear-style log of operational decisions. Filter by type, user, alert, date. Each row: timestamp (mono), decision type pill, summary (one line), affected entities (chips), value impact (monospace ₹), outcome status pill (or "pending"). Filter sidebar (240px, bg-surface) with type chips (Re-routing, Force majeure, Hold shipment, etc.), user filter, date range. Empty state: "No decisions logged yet. Decisions appear here when your team logs actions on alerts." Reference: Linear inbox, Vercel deployments. v2 tokens throughout.

---

### SCREEN 20 — Portfolio Exposure Dashboard (extended from v1.5)

Already specced as Screen 13. Extend the v3 version with: (a) HHI concentration row added below the breakdown panels, (b) Lead-Time-at-Risk panel added bottom-right, (c) ExposureDelta sparkline added next to the main risk score, (d) "What if?" button in the top-right opens the Calculator modal (Screen 23). All other elements per Screen 13.

---

### SCREEN 21 — Concentration Risk View

**URL:** `/app/[orgSlug]/exposure/concentration`

**Brief prompt:** Three HHI heatmap rows stacked: "Suppliers by Region", "Suppliers by Country", "Customers by Region". Each row a horizontal stacked bar with monospace percentages and HHI score on the right (e.g. "HHI: 3,840 ⚠"). Color: red if HHI > 2500 (concentrated), yellow 1500-2500, green < 1500. Below: detailed table — top 10 entities by exposure share, with their share %, alternative suppliers count (M31 link), criticality. Reference: Bloomberg portfolio analytics, Wealthfront allocation view. v2 tokens. No shadows.

---

### SCREEN 22 — Lead-Time-at-Risk panel

**Embedded in dashboard, not standalone.**

**Brief prompt:** A horizontal panel ~400px tall showing: large monospace number "30%" with subtitle "of H2 orders depend on this single port", below a small horizontal bar chart of POs grouped by criticality (single-source, alternative-available, multi-sourced) in severity colors. Right side: sparkline showing LTaR over last 90 days. Subtitle row: "p50 lead time at risk: 14 days · p90: 31 days". Click panel → drilldown to PO-level table.

---

### SCREEN 23 — What-If Calculator (modal)

**URL:** opens as modal from any alert / scenario / dashboard

**Brief prompt:** Centered modal 720×600px on dim overlay. Title "What if?" + subtitle "Adjust parameters to see exposure change in real time." Two-column layout: LEFT 50% form with dropdowns (event type, region, duration in days slider), checkboxes (which routes affected), RIGHT 50% live-updating result panel — "Estimated exposure: ₹X.X Cr ± ₹Y.Y Cr" in large monospace, ExposureDelta showing change vs baseline, three rows: stalled value, re-routing cost, opportunity cost. Footer: "Save scenario" + "Apply to playbook" buttons. v2 tokens, no shadows on modal — use 2px border in `accent` color to distinguish.

---

### SCREEN 24 — Insurance Model card

**Embedded in /settings/billing**

**Brief prompt:** Single card 720px wide with title "Insurance modeling" + subtitle "Based on your current portfolio exposure". Three monospace rows: "Current coverage: ₹50 Cr", "Recommended coverage: ₹78 Cr (gap: ₹28 Cr)", "Estimated premium delta: ₹1.2L–₹2.4L per year". Below: rationale paragraph in text-secondary explaining the math. Bottom: small disclaimer "Premium estimates are heuristic. Confirm with your broker." plus a "Forward to broker" button (secondary, opens prefilled email). v2 tokens.

---

### SCREEN 25 — Multi-Tier Supplier Graph (extended from v1.5)

Already specced as Screen 9 in v1.5. **Major v3 extension:** add risk-score color overlay (counterparty risk score from M31 colors each node from green→red), add toggleable layers (Suppliers / Customers / Assets / Routes), add timeline scrubber to replay graph state at past dates. All other elements per Screen 9.

---

### SCREEN 26 — Customer Concentration Graph

**URL:** `/app/[orgSlug]/customers/graph`

**Brief prompt:** Sister to Screen 25. Layered DAG with customer destinations at top, then their dependent shipments, then the suppliers/POs feeding those shipments. Same component reuse. Right panel shows per-customer monthly value, concentration share, recent alerts affecting that customer.

---

### SCREEN 27 — Asset Registry

**URL:** `/app/[orgSlug]/assets`

**Brief prompt:** Split-screen 60/40: left is Mapbox dark map with all owned assets pinned (warehouse, hub, plant, vessel icons), right is dense table — name, type, location, value (₹ mono), capacity, current status (active/maintenance/disrupted). Filters above table: type, country, status. Click row → drill into asset detail. Reference: Datadog infrastructure list view.

---

### SCREEN 28 — Shipment Tracker

**URL:** `/app/[orgSlug]/shipments`

**Brief prompt:** Top: status pipeline visualization (Planned → Loaded → In transit → Delivered) with shipment counts per stage. Below: dense table with columns — Ref (mono), Origin → Destination, Status (StatusPill), Vessel/Flight (mono), Value (₹ mono), ETA (countdown timer if approaching), AIS toggle (live indicator if tracked). Click row → shipment detail with map showing current AIS position + route + risk overlay if any active alerts on the path.

---

### SCREEN 29 — PO Tracker

**Brief prompt:** Same pattern as Shipment Tracker but for purchase orders. Columns: PO# (mono), Customer, Supplier, Value, Currency-locked rate, Status, Force-majeure trigger flag (red icon if FM declared). Filter bar with status chips and date range.

---

### SCREEN 30 — Counterparty Risk Center

**URL:** `/app/[orgSlug]/counterparties/risk`

**Brief prompt:** Top: 4 stat cards (avg risk score, # high-risk, # newly elevated this week, # sanctions-flagged). Below: scatter plot — x-axis is monthly value with this counterparty (₹), y-axis is risk score 0-100, points colored by tier (1/2/3), size proportional to PO count. Bottom-right quadrant (high value, high risk) is the danger zone, subtly tinted red. Click point → counterparty detail with risk-score history chart (Recharts area chart, 90-day window) + breakdown of factors (financial, sanctions, geopolitical, performance, cyber).

---

### SCREEN 31 — Contract Library

**URL:** `/app/[orgSlug]/contracts`

**Brief prompt:** Two-column layout. LEFT 30%: contract list — counterparty, type, expiry (countdown timer), force-majeure-triggered indicator. Click a contract → RIGHT 70% shows: contract metadata header, then a stack of ContractClauseCards for each extracted clause (force majeure, lead time, termination, payment, quality, governing law). Each card has Edit + "Verified ✓" or "Pending review" status. Above the cards: prominent "Upload new contract" zone (drag-drop area, dashed border, icon, instructions). After upload: live progress indicator showing extraction steps ("Parsing PDF... Extracting clauses... Verifying...").

---

### SCREEN 32 — Bulk NL Import

**URL:** `/app/[orgSlug]/import/natural-language`

**Brief prompt:** Single centered card 800×600px. Title "Describe your operations" + subtitle "Paste a paragraph or email — we'll extract entities for you." Large textarea (12 rows) with placeholder example: "Our pharma exports to East Africa go via JNPT and Mundra ports. Key suppliers include..." Below: "Extract entities" primary button. After click: live extraction visualization — extracted entities highlighted in the input text (different highlight colors per type: supplier=blue, port=green, route=orange, customer=yellow). Below the input: list of extracted entities as cards, each with checkbox (default checked), type badge, location, confidence %. Bottom: "Add 8 entities to watchlist" primary button counts checked entities.

---

### SCREEN 33 — War Room

**URL:** `/app/[orgSlug]/war-rooms/[id]`

**Layout:**

```
Top header: War Room: Suez closure — March 2026
            Opened by Priya Mehta · 4 participants · 2h 14m active
                                              [Invite] [Close room]

Three-column layout below header:

LEFT 25% — Participants & action items
  PARTICIPANTS
    [avatar] Priya Mehta · Ops Lead
    [avatar] Rohan K · CFO
    [avatar] external@broker.com · Broker
    [avatar] external@insurer.co · Insurer
  
  ACTION ITEMS
    ☐ Notify customer XYZ — Priya, due 16:00 UTC
    ☐ Get AIS on MV Hyderabad — Priya, due 15:30 UTC
    ☑ File preliminary FM notice — Rohan ✓ done
    [+ New action item]

CENTER 50% — Chat / Activity feed
  WarRoomChatBubble messages stream
  Decision-log entries inline (distinguished styling)
  System events ("Priya marked alert critical") in text-muted
  [Type a message... 📎 attach] input at bottom

RIGHT 25% — Associated alerts + quick actions
  ASSOCIATED ALERTS (3)
    [● CRIT] Houthi strike — Hodeidah
    [● HIGH] Suez southbound delays
    [● HIGH] Mombasa rerouting needed
  
  QUICK ACTIONS
    [Generate brief]
    [Notify customers]
    [Trigger force majeure clauses]
```

**Generate this prompt:**

> Generate a war room collaborative workspace for a dark-mode B2B operations dashboard. Top header: "War Room: Suez closure — March 2026" + subtitle "Opened by Priya Mehta · 4 participants · 2h 14m active" with right-aligned "Invite" and "Close room" buttons. Below: three-column layout. LEFT 25% column on bg-surface — "PARTICIPANTS" section with 4 avatar+name+role rows (one external broker email styled distinctly), then "ACTION ITEMS" section with 3 checkboxes (1 checked, 2 unchecked, each with assignee and due time in monospace), "+ New action item" button at bottom. CENTER 50% — chat feed with 6 messages mixing WarRoomChatBubbles (avatar + name + role + timestamp + body), inline decision-log entries (distinguished by orange left border 3px), and system events in text-muted (e.g. "Priya marked alert critical"). Bottom of center: text input "Type a message..." with paperclip attach icon. RIGHT 25% on bg-surface — "ASSOCIATED ALERTS" with 3 alert rows (severity badges + titles), then "QUICK ACTIONS" with 3 buttons (Generate brief, Notify customers, Trigger FM clauses). Background bg-base, columns separated by 1px borders bg-surface-2. All timestamps and IDs in Geist Mono. Reference: Slack channel + Linear inbox + Notion meeting page hybrid. Calm, focused, operational. No shadows.

---

### SCREEN 34 — Post-Incident Retrospective

**Brief prompt:** Single-column form 800px wide. Title "Retrospective: Suez closure — March 2026". Sections: Timeline summary (auto-generated from war room activity), What worked, What didn't, Action items for next time, Playbook updates (suggest changes to existing playbooks). Each section is a textarea + AI suggestion button ("Draft from war room activity"). Save → archives war room with retrospective attached.

---

### SCREEN 35 — Live Vessel Tracker

**Brief prompt:** Full-screen Mapbox dark map with live AIS pins. Each vessel pin shows: name + IMO in tooltip, current speed/heading, last-update timestamp. Filter sidebar 280px right: list of customer's tracked vessels with current status (sailing/anchored/in-port/dark). Click vessel → flyaway side panel with route history (last 30 days), full vessel detail, any active alerts on its path. Top-right: "Track new vessel" button (gated by AIS plan cap). Bottom-left: feed cost indicator "₹312 / ₹500 daily cap" with progress bar.

---

### SCREEN 36 — Flight Tracker

**Brief prompt:** Same pattern as Screen 35 but for tracked flights (smaller scope). Show altitude in addition to position. Air-cargo customer subset only.

---

### SCREEN 37 — Satellite Observation View

**Brief prompt:** Two-pane: LEFT 60% shows current Sentinel/Planet satellite image of the AOI with detected-change overlays (bounding boxes around vessels, infrastructure, smoke/fire indicators). Cloud-cover percentage in top-right. RIGHT 40%: metadata, observation date, source (Sentinel-2 / SkySat), detected changes list with confidence scores. Bottom: timeline scrubber to swipe through historical observations of the same AOI.

---

### SCREEN 38 — Feed Usage Dashboard (admin-only)

**URL:** `/admin/feed-costs`

**Brief prompt:** Stripe-style billing dashboard. Header: this month's total spend across all paid feeds, with bar showing % of cap consumed. Below: per-feed breakdown table — feed name, this-month cost (₹), trend sparkline, # orgs using, top org by usage. Filter by org. Click feed row → per-org breakdown. Alerts visible if any org is approaching cap.

---

### SCREEN 39 — Custom Feed Submission

**Brief prompt:** Single card form. Fields: feed name, feed type dropdown (RSS / JSON API / scraper template), URL, auth (none/bearer/basic with token field), schedule cron (with friendly "every 15 min / hourly / daily" presets), reliability self-assessment (dropdown A-F with explanation), ToS check ("I confirm I have permission to ingest from this source"), private-to-org or shareable toggle. Submit → goes to admin review queue, customer sees "Pending review" status.

---

### SCREEN 40 — Custom Feed Library

**Brief prompt:** Table view. Org's custom feeds with health status (last sync, items ingested last 24h, last error if any), reliability tier, schedule, edit/pause/delete actions. Reference: Vercel deployments list.

---

### SCREEN 41 — Predictive Alerts Inbox

**URL:** `/app/[orgSlug]/forecasts`

**CRITICAL:** must be visually distinct from real-time alert inbox (Screen 2).

**Layout:**

```
Page: Forecasts
       12 active forecasts · accuracy last 90d: Brier 0.18

Tab: [Active] [Materialized] [Deprecated] [Accuracy report]

Active forecasts:
┌─────────────────────────────────────────────────────────────┐
│ [FORECAST · 67% · 14d]  Suez disruption likely              │
│                                                              │
│ Iran-Israel rhetoric escalation ▲ + JTWC tropical activity   │
│ + OPEC+ production statement                                 │
│                                                              │
│ Could affect: 12 entities, ₹4.2 Cr exposure                  │
│ Recommended: pre-position Cape of Good Hope re-route plans   │
│                                                              │
│                                       [Why this?] [Dismiss]  │
└─────────────────────────────────────────────────────────────┘
```

**Generate this prompt:**

> Generate a predictive alerts inbox for a dark-mode B2B intelligence dashboard. CRITICAL: visually distinct from real-time alerts. Use orange accents, dashed borders, "FORECAST" badges — never red. Page title "Forecasts" + subtitle "12 active forecasts · accuracy last 90d: Brier 0.18". Tab bar with [Active] [Materialized] [Deprecated] [Accuracy report]. Below: list of forecast cards. Each card has: top-left ForecastBadge "[🔮 FORECAST · 67% · 14d]" with dashed orange 1.5px border, then headline "Suez disruption likely", then 2-line rationale showing 3 contributing indicators (Iran-Israel rhetoric ▲, JTWC tropical activity, OPEC+ statement) joined by + symbols. Below: impact line "Could affect: 12 entities, ₹4.2 Cr exposure" in monospace ₹. Below: recommended action one-liner. Bottom-right: "Why this?" and "Dismiss" buttons. Show 4 forecast cards with varying confidence (67%, 41%, 78%, 23%) and time horizons (7d, 14d, 30d, 90d). Background bg-base, cards on bg-surface with dashed orange-500/40 borders to differentiate from solid alert borders. All numbers in Geist Mono. Aesthetic: weather forecast + financial signals dashboard hybrid. Reference: Tropical cyclone advisory pages, Bloomberg leading-indicators view. No glow, no animation, calm.

---

### SCREEN 42 — Leading Indicator Dashboard

**Brief prompt:** Grid of 30 IndicatorGauge components — each shows indicator name, current level (0-1), trend sparkline, threshold marker. Group by category (Diplomatic / Military / Economic / Weather / Political / Cyber). Filter bar above.

---

### SCREEN 43 — Forecast Accuracy Report

**Brief prompt:** Recharts time-series of Brier score over last 365 days (lower = better). Below: confusion-matrix-style table showing forecast outcomes — Predicted / Materialized vs Predicted / Did-not / Not-predicted-but-occurred. "Things we got wrong" prominent section listing 5 most-recent forecast misses with rationale and learnings. Transparency over polish.

---

### SCREEN 44 — Digest Preferences (extends settings)

**Brief prompt:** Embedded in /settings/notifications. Three toggle-groups for daily/weekly/monthly digests, each with time/day/timezone selectors. Below: per-entity cadence override list — table of watchlist entities with cadence dropdown (Instant/Daily/Weekly/Off) per row. Reference: Linear notification preferences.

---

### SCREEN 45 — Digest Preview modal

**Brief prompt:** Centered modal showing rendered HTML of an upcoming digest, on a light cream background (zinc-100) so it looks like an actual email inside the dark dashboard. Daily/weekly/monthly toggles at top. "Send to me now" + "Schedule" buttons at bottom.

---

### SCREEN 46 — Onboard from URL

**URL:** `/onboarding/from-url`

**Layout:**

```
Step 1: Enter your company URL
┌─────────────────────────────────────────────┐
│  https://yourcompany.com                     │
│                              [Extract →]    │
└─────────────────────────────────────────────┘

Step 2: We found these (auto)
┌─────────────────────────────────────────────┐
│  Reading your homepage...               ✓    │
│  Reading your about page...             ✓    │
│  Reading your suppliers page...         ✓    │
│  Reading your customers page...         ✓    │
│  Extracting entities with AI...         ⏳    │
└─────────────────────────────────────────────┘

Step 3: Confirm extracted entities
[grid of EntityChip-style confirmable entities, each with checkbox]

12 entities extracted ·  [Add 12 to watchlist →]
```

**Generate this prompt:**

> Generate an "onboard from URL" flow for a dark-mode B2B SaaS onboarding. Three vertical sections stacked. Step 1: header "Enter your company URL", large input field with placeholder "https://yourcompany.com" + "Extract →" primary blue button. Step 2 (live progress): header "We found these", 5 progress lines with checkmarks (4 done with green ✓, 1 in-progress with spinner): "Reading your homepage", "Reading your about page", "Reading your suppliers page", "Reading your customers page", "Extracting entities with AI". Step 3: header "Confirm extracted entities", 4×3 grid of EntityChip cards, each with a checkbox (most checked), entity type icon (factory/port/country/supplier), name, location, confidence percentage in monospace. Bottom: status line "12 entities extracted" + primary button "Add 12 to watchlist →" with monospace count. Background bg-base, cards on bg-surface, borders bg-surface-2. Aesthetic: Linear sign-up flow, Vercel project import. Calm, automated, trustworthy. No marketing fluff.

---

### SCREEN 47 — Onboard from Annual Report

**Brief prompt:** Same pattern as Screen 46 but for PDF upload. Drag-drop zone for PDF, then live progress (parsing pages, extracting risk factors section, extracting operations section, extracting suppliers/customers, AI synthesis), then confirmation grid. Note "We've read 87 pages and identified 24 entities" subtitle.

---

### SCREEN 48 — CSV Onboarding with Column Mapping

**Brief prompt:** Two-column layout. LEFT: uploaded CSV preview (first 10 rows). RIGHT: column-mapping wizard — for each detected column, dropdown to map to Syntra field (Name, Type, Country, Lat, Lng, Value, Tier, etc.). Auto-detect on load. "Import" button at bottom shows preview count.

---

### SCREEN 49 — Sector Template Picker

**Brief prompt:** 10-card grid (5×2). Each card: sector icon, title (e.g. "Indian pharma exporter to Africa"), 3-bullet preview ("12 suppliers • 4 ports • 8 destination countries"), "Use this template" button. Hover: card border becomes accent. Click → instantiates template, redirects to dashboard.

---

## 24. Updated Voice & Microcopy For Operational Foundry

In addition to v1 (§13) and v1.5 (§19) voice rules:

- **Forecast language:** never imply certainty. "Suez disruption likely (67% in 14d)" not "Suez will be disrupted." Confidence percentages always present. Time horizons always present.
- **Provenance language:** factual + traceable. "Confirmed by 3 sources within 25 minutes" not "we found multiple confirmations."
- **War room language:** operational + sober. "Action item assigned to Priya, due 16:00 UTC" not "Priya please handle this!"
- **Decision log language:** past tense + outcome-bearing. "Re-routed via Cape of Good Hope, +12 days, +18% cost. Outcome pending." Single-incident decisions read like a flight log, not a Slack conversation.
- **Insurance modeling language:** estimates only. "Estimated premium delta ₹1.2L–₹2.4L per year. Confirm with your broker." Never present a single-point estimate.
- **AI-extracted content:** always labeled. Contract clauses show extraction confidence; bulk NL imports show confidence per entity; forecast rationales show contributing indicators. No silent LLM output anywhere in the operational suite.
- **Cost visibility:** when paid feeds (AIS, satellite, flight) are in use, cost is always visible. Never hide it. "₹312 / ₹500 daily cap" in a corner of the relevant view.

---

## 25. Updated Component Inventory After Operational Foundry

| Component | Source | Used in screens |
|---|---|---|
| SeverityBadge | v1 | Real-time alerts |
| EntityChip | v1 | Everywhere |
| Button hierarchy | v1 | Everywhere |
| Card / Panel | v1 | Everywhere |
| StatusPill | v1.5 (§17.1) | Triage, alert detail, shipments, POs |
| ComplianceFlag | v1.5 (§17.2) | Alerts, watchlist, contracts |
| ValueExposureBar | v1.5 (§17.3) | Exposure, scenarios, alerts |
| ImpactChain | v1.5 (§17.4) | Multi-tier alerts |
| RiskScoreDial | v1.5 (§17.5) | Exposure dashboard |
| ScenarioCard | v1.5 (§17.6) | Scenarios |
| AssigneeAvatar | v1.5 (§17.7) | Triage, war room |
| HeatmapLegend | v1.5 (§17.8) | Maps |
| **ReliabilityBadge** | **v3 (§22.1)** | **Sources, alerts, provenance** |
| **ConfidenceInterval** | **v3 (§22.2)** | **Alerts, forecasts, estimates** |
| **HowWeKnowPanel** | **v3 (§22.3)** | **Alert detail** |
| **ExposureDelta** | **v3 (§22.4)** | **Dashboard, digests** |
| **HHI heatmap row** | **v3 (§22.5)** | **Concentration view** |
| **ContractClauseCard** | **v3 (§22.6)** | **Contract library** |
| **WarRoomChatBubble** | **v3 (§22.7)** | **War room** |
| **ForecastBadge** | **v3 (§22.8)** | **Forecasts, predictive alerts** |
| **CountdownTimer** | **v3 (§22.9)** | **SLAs, expiries, contracts** |
| **ProvenanceNode** | **v3 (§22.10)** | **Provenance graph** |
| **IndicatorGauge** | **v3 (§22.11)** | **Indicator dashboard** |

Total after v3: **23 components**. Resist further additions. Every primitive is a tax on consistency.

---

## 26. Mockup Generation Workflow (v3 priorities)

For the v3 build, generate mockups for these screens *first* — they unlock customer demos:

1. Screen 17 — Provenance Graph (the trust-moat hero)
2. Screen 33 — War Room (the operational-moat hero)
3. Screen 41 — Predictive Alerts Inbox (must look distinct, validate with users)
4. Screen 31 — Contract Library (customer-asked feature)
5. Screen 25 — Multi-Tier Supplier Graph extended (Palantir-equivalent)

Generate the rest as customer pull dictates in the build sequence.

---

*End of Part III. Same restraint, more surface area. Generate, iterate, ship — but only in waves customers asked for.*
