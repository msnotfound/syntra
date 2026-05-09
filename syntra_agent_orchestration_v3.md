# Syntra — Agent Orchestration Playbook

> **Purpose:** Standalone reference for operating Claude Code, OpenCode, Cursor agents, or any other coding agent harness against the Syntra codebase. Distilled from §29 of the build plan into a single short doc you can paste at the top of any agent session.
>
> **Scope:** Command-tier modules (v1.5+, M16–M27). Do not use this playbook for v1 Trade-tier — v1 is single-developer, single-thread work. Parallel orchestration starts at v1.5 when you have ≥4 modules with parallel-safe partitions.
>
> **Visual implementation:** governed by `syntra_design_guide.md`. Implementer agents that touch UI must read tokens from `packages/ui/tokens.ts` — never hardcode color values, spacing literals, radii, or transition durations.
>
> **Naming:** "Syntra" is the product name. "Command" is a tier label inside Syntra (alongside Trade and Foundry-class). When this doc says "Command-tier modules" it means the v1.5+ feature set, not a separate product.

---

## 0. Single Most Important Rule

**Modules are parallel-safe if and only if they do not share a write surface.** A write surface is the same file, the same Mongoose schema field, the same API route file, or the same shared package's exported type.

If two modules need the same write surface, they go serial — or you re-decompose them until they don't share one.

Everything below is bookkeeping. This is the rule.

---

## 1. The Five Roles

Any v1.5 build session has these five roles. They can be played by humans, Claude subagents, or external agents (one per terminal / git worktree). Do not collapse roles — each one is a different mode of thinking.

| Role | What it does | Where it writes |
|---|---|---|
| **Lead human** (you) | Approves contract changes; resolves ambiguity; signs off on `done-{module}.md`; runs integration day | Anywhere (full repo) |
| **Supervisor agent** | Watches all branches; runs typecheck + tests; flags collisions; never writes app code | `/reports/*` only |
| **Implementer agent** (×N, one per module in flight) | Builds one module against its spec | Module-scoped paths only (per spec) |
| **Reviewer agent** (optional, on integration day) | Reads PRs, runs full test suite, suggests fixes; does not commit | `/reports/review-{module}.md` |
| **Specifier agent** (one-shot, before each wave) | Expands the build plan's module description into a detailed `/specs/{N}-*.md` and stub contract entries | `/specs/` (with lead approval gate) |

Do not let an implementer agent play multiple roles. The supervisor must not write code. The implementer must not modify shared contracts. Role-mixing is how 4 weeks of work becomes 8 weeks of merge hell.

---

## 2. Repository Layout (What The Agents See)

```
syntra/                    (main repo, multiple worktrees attached)
├── apps/
│   ├── web/                       (Next.js)
│   └── worker/                    (cron + dispatch)
├── packages/
│   ├── db/                        (Mongoose models)
│   ├── shared/                    (utilities)
│   ├── ui/                        (shadcn primitives + Syntra-specific components)
│   │   ├── tokens.ts              ← CANONICAL design token source. Mirrors syntra_design_guide.md.
│   │   │                            All UI module agents read tokens from this file.
│   │   │                            Modifying it requires a CCR (it is a contract surface).
│   │   └── components/            (shadcn primitives + Syntra components: SeverityBadge,
│   │                               EntityChip, StatusPill, ComplianceFlag, ImpactChain, etc.)
│   └── llm/                       (LLM helpers)
├── specs/
│   ├── 00-OVERVIEW.md
│   ├── 01-stack.md … 16-demo.md   (v1 specs)
│   ├── 17-multi-tier-suppliers.md (M16 spec)
│   ├── 18-sanctions-engine.md     (M17 spec)
│   ├── 19-incident-workflow.md    (M18 spec)
│   ├── 20-scenario-planner.md     (M19 spec)
│   ├── 21-risk-heatmap.md         (M20 spec)
│   ├── 22-var-engine.md           (M21 spec)
│   ├── … (M22–M27 specs)
│   ├── contracts/
│   │   ├── 00-data-model.contract.ts
│   │   ├── 01-api-routes.contract.ts
│   │   ├── 02-events.contract.ts
│   │   ├── 03-feature-flags.contract.ts
│   │   ├── 04-shared-utils.contract.ts
│   │   └── README.md
│   ├── contract-changes/          (CCRs, one file per change request)
│   └── 99-DO-NOT-BUILD.md         (paste at top of every agent session)
└── reports/
    ├── supervisor-log.md
    ├── plan-{module}.md           (one per module)
    ├── done-{module}.md           (one per module, written when complete)
    ├── questions/{module}-{n}.md  (questions blocking the agent)
    ├── blockers/{branch}.md       (supervisor-flagged failures)
    ├── dep-request/{n}.md         (new-dependency proposals)
    ├── cross-module-request/      (when one module needs another's surface)
    └── review-{module}.md         (reviewer agent output)
```

---

## 3. Wave Plan (v1.5 Tier A)

```
WAVE 1 (4 implementer agents in parallel + 1 supervisor)
  M17 Sanctions Engine        — touches sanctions_lists collection, alerts.subtype field
  M18 Incident Workflow       — touches alerts.{status, assignee_user_id, comments}
  M20 Risk Heatmap            — touches new risk_scores collection, dashboard panel
  M21 VaR Engine              — touches watchlist_entities.{value fields}, new exposures view

  All four modify alerts or watchlist_entities ADDITIVELY ONLY.
  Schema additions go through a single CCR per module before any code starts.
  Wall-clock: ~10 days

WAVE 2 (2 implementer agents in parallel)
  M16 Multi-Tier Supplier Graph  — depends on M21 value fields for propagation
  M19 Scenario Planner           — depends on M16 + M21
  Wall-clock: ~14 days

Total v1.5 wall-clock: 3.5–4 weeks if execution is clean. Plan for 6–8 weeks.
```

Tier B modules (M22–M27) follow Wave 2 in three more waves, two modules per wave.

> **Visual implementation discipline (applies across all waves).** Every module that ships a UI surface must reference `syntra_design_guide.md` and import design tokens from `packages/ui/tokens.ts`. The supervisor's typecheck cycle (§5.2 step 1f) verifies that no implementer has hardcoded color values matching the legacy v1 zinc palette. Any branch that introduces `zinc-9\d\d`, `#27272A`, `#3F3F46`, or `#52525B` is flagged for lead-human review. Token drift across modules is the failure mode that turns four parallel agents into one inconsistent product — the supervisor exists to catch it within a 30-minute cycle, not at integration day.

---

## 4. Spawning A Wave (Concrete Commands)

### 4.1 Setup (once per wave)

```bash
# From your main checkout:
cd ~/code/syntra

# Make sure main is clean and up to date
git checkout main && git pull --ff-only

# Create one worktree per implementer + one for supervisor
git worktree add ../syn-m17 -b feature/m17-sanctions origin/main
git worktree add ../syn-m18 -b feature/m18-incident-workflow origin/main
git worktree add ../syn-m20 -b feature/m20-risk-heatmap origin/main
git worktree add ../syn-m21 -b feature/m21-var-engine origin/main
git worktree add ../syn-supervisor -b ops/supervisor origin/main

# Verify
git worktree list
```

You now have 5 separate working directories. Open 5 terminal panes (tmux, iTerm split, Warp blocks, whatever). One pane per worktree.

### 4.2 Per-implementer agent spawn (Claude Code)

In the M17 pane:

```bash
cd ../syn-m17
claude
```

Then paste the prompt from §5.1 with `{N}=17` and the module name filled in. Repeat for M18 (`{N}=18`), M20 (`{N}=20`), M21 (`{N}=21`). Each Claude Code session has its own context — they cannot pollute each other.

### 4.3 Supervisor spawn

In the supervisor pane:

```bash
cd ../syn-supervisor
claude
```

Paste the supervisor prompt from §5.2.

### 4.4 Same pattern, OpenCode

```bash
cd ../syn-m17
opencode
```

Same prompt. OpenCode's behavior is similar but its tool set differs slightly; the prompts in §5 are intentionally tool-agnostic.

### 4.5 Same pattern, Cursor

Open four separate Cursor windows, each pointed at a different worktree directory. Use Cursor's Composer mode and paste the same prompts. Cursor's Background Agents feature can also be used — feed it the same per-module prompt.

### 4.6 Same pattern, Aider

Aider is interactive and single-thread by design; it works less naturally for parallel work. Use Aider for **contract change reviews** (lead human, deliberate pace) and integration-day debugging — not for the parallel module work itself.

---

## 5. The Two Canonical Prompts

### 5.1 Implementer Agent Prompt (parameterized)

Copy this verbatim, replace `{N}`, `{Module Name}`, and `{module-slug}`:

```
═══════════════════════════════════════════════════════════════════
  SYNTRA — COMMAND-TIER MODULES (v1.5) — IMPLEMENTER AGENT
  Module M{N} — {Module Name}
═══════════════════════════════════════════════════════════════════

ROLE
  You are the implementation agent for Module M{N}: {Module Name}.
  You are not an architect, not a PM, not a designer. You build what
  the spec says.

BEFORE EVERY EDIT
  1. Read /specs/99-DO-NOT-BUILD.md
  2. Read /specs/{N}-{module-slug}.md (your module's spec)
  3. Read /specs/contracts/00-data-model.contract.ts
  4. Read /reports/supervisor-log.md (last 20 entries) for collision warnings
  5. If anything in steps 1–4 contradicts what you're about to do: STOP.
     Write /reports/questions/{N}-{seq}.md and wait.
  6. If your module touches any UI surface: read syntra_design_guide.md
     §8 (per-screen prompt blocks) and packages/ui/tokens.ts. All colors,
     spacing, radii, transitions, and typography come from tokens.ts.
     Never hardcode hex values, Tailwind color classes, spacing literals,
     or transition durations.

YOU MAY WRITE TO (and only these paths)
  - apps/web/app/(app)/[orgSlug]/{module-slug}/**
  - apps/web/app/api/v1/{module-slug}/**
  - apps/web/components/{module-slug}/**
  - apps/worker/src/jobs/{module-slug}/**
  - packages/db/models/{module-slug}.ts
  - tests/{module-slug}/**
  - /reports/plan-{N}.md
  - /reports/done-{N}.md
  - /reports/questions/{N}-{seq}.md
  - /specs/contract-changes/m{N}-{seq}.md (CCRs only — do not modify
    /specs/contracts/* directly)

YOU MAY NOT
  - Modify /specs/contracts/* directly. Use a CCR.
  - Modify packages/ui/tokens.ts directly. It is a contract surface.
    Token changes require a CCR (reference syntra_design_guide.md §15.5
    in the 'Why' section).
  - Hardcode design tokens. Colors, spacing, radii, transitions, and
    fonts are imported from packages/ui/tokens.ts. No exceptions.
  - Touch any other module's code paths.
  - Add dependencies without /reports/dep-request/{seq}.md.
  - Skip tests.
  - Mark done without /reports/done-{N}.md.
  - Reach for v2 features (compare against /specs/99-DO-NOT-BUILD.md).

WORKFLOW
  1. Read everything in BEFORE EVERY EDIT.
  2. Plan: write /reports/plan-{N}.md. List files you will create,
     files you will modify, schema changes (CCRs needed), tests
     you will write. Stop and wait for any required CCR approval.
  3. Implement.
  4. Test: every change has an associated unit or integration test.
     Run `pnpm test` — must pass before commit.
  5. Typecheck: `pnpm typecheck` — must pass before commit.
  6. Commit at every logical step. Imperative messages. Push frequently.
  7. When acceptance criteria pass: write /reports/done-{N}.md
     describing what was built and where. Then stop.

WHEN STUCK
  Stop. Do not guess. Do not invent. Write
  /reports/questions/{N}-{seq}.md describing the question and what
  you tried. Then stop.

NON-NEGOTIABLE
  - No skipping tests.
  - No modifying contracts without a CCR.
  - No touching another module's paths.
  - No marking done with failing tests.
═══════════════════════════════════════════════════════════════════
```

### 5.2 Supervisor Agent Prompt

```
═══════════════════════════════════════════════════════════════════
  SYNTRA — COMMAND-TIER MODULES (v1.5) — SUPERVISOR AGENT
═══════════════════════════════════════════════════════════════════

ROLE
  You are the supervisor agent. You watch the parallel module
  implementer agents and report status. You do not write
  application code. Ever.

CADENCE
  Every 30 minutes:
  1. Run `git fetch --all`
  2. For each branch matching feature/m*:
     a. Check what's new since last cycle (use git log).
     b. In a temp directory, attempt a hypothetical merge of all
        active feature branches onto main.
     c. Run `pnpm typecheck` against that hypothetical merge.
     d. Run `pnpm test` for the affected modules' test paths.
     e. Verify no file in /specs/contracts/ was modified outside
        a corresponding /specs/contract-changes/ CCR. Also verify
        packages/ui/tokens.ts was not modified outside a corresponding
        CCR (it is a contract surface).
     f. Run `git grep -nE '(zinc-9[0-9]{2}|#27272[Aa]|#3[Ff]3[Ff]46|#52525[Bb])' apps/web packages/ui`
        against the branch's HEAD. Any hits indicate legacy v1 design
        tokens slipped through. Append a `[design-token:legacy]` warning
        to that branch's row in the supervisor log. Do not block the
        branch — flag for lead-human review.

REPORTING
  Append one row to /reports/supervisor-log.md per branch per cycle:
  
    [ISO timestamp] [branch] [tests:pass/fail/n] [typecheck:ok/fail]
    [contracts-touched:y/n] [merge-conflict-with:branches] [notes]

  If a branch is failing for >2 consecutive cycles:
  - Open /reports/blockers/{branch-name}.md with the failure output.
  - Do not fix. Wait for the lead human or per-module agent.

  If two branches modify the same file in
  /apps/web/app/api/v1/* or /apps/web/app/(app)/[orgSlug]/*
  flag a /reports/blockers/collision-{branch1}-{branch2}.md.

YOU MAY NOT
  - Modify any code outside /reports/.
  - Run any agents.
  - Suggest fixes inline in the supervisor log (just "fail" or "ok"
    plus a link to the failure file).
  - Skip a cycle. If something blocks you, log it and try again
    next cycle.

YOU MAY
  - Read everything in the repo.
  - Run typecheck, tests, lint, build.
  - Open files in /reports/.
  - Append to /reports/supervisor-log.md.
═══════════════════════════════════════════════════════════════════
```

---

## 6. Contract Change Request (CCR) Protocol

Any time an implementer needs to change something in `/specs/contracts/*`:

1. Implementer writes `/specs/contract-changes/m{N}-{seq}.md` (template below).
2. Implementer **stops** in their worktree.
3. Lead human (you) reads the CCR, approves or rejects.
4. On approval: lead human edits the actual contract file on a separate `chore/contract-{seq}` branch, merges to main.
5. All in-flight worktrees pull main + rebase.
6. Implementer resumes.

CCR template:

```
# CCR m{N}-{seq} — {one-line description}

## What needs to change
{specific field / type / signature}

## Why
{1–3 sentences. Link to spec section.}

## Backward compatibility
{additive / nullable / migration plan / breaking}

## Affected modules
{list of M-numbers that read or write this contract surface}

## Approval needed from
- Lead human (Maya)

STATUS: AWAITING APPROVAL — DO NOT MERGE
```

CCRs are bureaucratic on purpose. The cost of pausing one agent for a few hours is far lower than the cost of two agents silently disagreeing on a schema.

### Design token CCRs

`packages/ui/tokens.ts` is a contract surface. Any change to design tokens — color values, spacing scale, radii, font choices, transition timing, focus-ring style — requires a CCR. The "Why" section of the CCR must reference the corresponding section of `syntra_design_guide.md` (typically §15.5 Token Authority, or the section being amended). Token changes propagate atomically across all modules: the lead human merges the CCR, all in-flight worktrees rebase, no module ships with stale tokens. Per-module token drift is forbidden.

---

## 7. Integration Day (Every 5 Working Days)

Non-negotiable. Skipping this is how parallel work compounds into merge hell.

```
1. Freeze:
   - Lead human posts /reports/integration-freeze.md
   - All implementer agents stop after their current commit
   
2. Sync:
   - Each branch rebases onto latest main
   - Resolve any rebase conflicts on the spot
   
3. Test:
   - Supervisor (or lead) runs full integration suite against
     the merged state of all active branches
   
4. Triage:
   - Test failures classified as:
     a. Contract collision  → CCR(s) opened, branches updated
     b. Logic collision     → assigned back to module owner
     c. Flake / infra       → fix on spot, recheck
     
5. Merge:
   - Branches that pass full suite → squash-merge to main
   - Other branches stay open, agents resume after unfreeze
   
6. Unfreeze:
   - Lead human deletes /reports/integration-freeze.md
   - Agents resume work
```

---

## 8. Failure Mode Recovery Table

| Symptom | Recovery |
|---|---|
| Two agents both extend the same Mongoose schema differently | Both submit retroactive CCRs; lead picks one canonical shape; the other rebases |
| Agent silently modifies `/specs/contracts/*` | Supervisor flags within 30 min; revert that commit; agent re-submits as a CCR |
| Agent invents a new dependency not in lockfile | Build fails on Vercel preview; reject the dep; ask agent to use existing tooling |
| Agent declares "done" but tests still fail | Reopen the module; agent retries; if 3 retries fail, escalate to human |
| Agent drifts into v2 features | Revert; agent re-reads `99-DO-NOT-BUILD.md`; if drift recurs, kill the session and restart from last clean commit |
| Two parallel agents both touch the same React component | Re-decompose: split component into per-feature subcomponents; each agent owns one |
| Supervisor agent itself stalls or loops | Hard timeout per cycle (5 min); restart from last log entry |
| Lead human is asleep when a CCR comes in | Implementer is paused — that's correct behavior. They wait. Don't try to "guess what the lead would approve." |

---

## 9. Throughput Honesty

These numbers are the realistic expectation, not best-case marketing:

- **One agent on one module:** ~60–80% of an experienced solo developer's productivity, at 2–3× wall-clock speed.
- **4 implementers + supervisor + integration discipline:** ~2.5–3.5× a single agent working serially. Not 4× — coordination overhead eats the rest.
- **Compared to a single solo human developer working serially:** ~5–7× wall-clock speedup on v1.5 scope, conditional on the discipline above.
- **Without the discipline:** the multiplier collapses to 1.5–2×, sometimes less than 1× (parallelism actively destroys throughput when integration becomes the new critical path).

The multiplier is real but conditional. The condition is **contract + supervisor + integration-day discipline.** Skip any one of those three and the math stops working.

---

## 10. Cheat Sheet (Pin To Every Agent Session)

```
═══════════════════════════════════════════════════════════════════
  AGENT CHEAT SHEET — paste at top of every session
═══════════════════════════════════════════════════════════════════

WHO YOU ARE
  Implementation agent for Module M{N}. Not an architect.
  Build what the spec says.

BEFORE EVERY EDIT
  1. Read /specs/99-DO-NOT-BUILD.md
  2. Read /specs/{N}-*.md
  3. Read /specs/contracts/00-data-model.contract.ts
  4. Read /reports/supervisor-log.md
  5. If touching UI: read syntra_design_guide.md + packages/ui/tokens.ts

YOU MAY WRITE TO
  - Module-scoped paths only (per spec)
  - /reports/plan-{N}.md, /reports/done-{N}.md
  - /reports/questions/{N}-{seq}.md
  - /specs/contract-changes/m{N}-{seq}.md

YOU MAY NOT
  - Modify /specs/contracts/* directly
  - Modify packages/ui/tokens.ts directly (it is a contract surface)
  - Hardcode design tokens (use packages/ui/tokens.ts)
  - Touch other modules' code paths
  - Add dependencies without /reports/dep-request/{seq}.md
  - Skip tests
  - Mark done without /reports/done-{N}.md

WHEN STUCK
  Stop. Write /reports/questions/{N}-{seq}.md. Wait.

WHEN FINISHED
  All tests pass. Typecheck clean. /reports/done-{N}.md exists.
  No further edits until reviewed.
═══════════════════════════════════════════════════════════════════
```

---

*End of orchestration playbook. Build in waves. Hold the discipline. Ship.*

---

# PART III — OPERATIONAL FOUNDRY ORCHESTRATION

> **Scope:** Extends the v1.5 orchestration playbook for the 11 modules (M28–M38) defined in `syntra_buildplan.md` Part III. The core discipline (parallel-safe partitions, contract files, supervisor agent, integration days, CCRs, hardcoded-token enforcement) is unchanged. This Part III adds: a new wave plan, new contract surfaces, paid-API cost discipline, and customer-pull gates that govern when each module ships.

---

## 11. Wave Plan (M28–M38)

```
WAVE 1 — Foundation (4 implementer agents + supervisor, ~3 wks wall-clock)
  M28 Intel Provenance Layer       — touches: source_articles, extraction_runs,
                                              alerts.{methodology, knowledge_timestamps},
                                              events.{source_article_ids, corroboration}
  M29 Decision Log                  — touches: new decisions collection
  M30 Financial Exposure Engine     — touches: exposures, exposure_deltas,
                                              insurance_models, watchlist_entities.{value fields}
  M32 Workflow + War Room          — touches: alerts.{war_room_id}, new war_rooms

  All four are additive only on existing collections. M28 is foundational —
  many later modules read from it but Wave 1 modules don't depend on it,
  so Wave 1 ships first as ordered.

WAVE 2 — Ontology + Coverage open (3 implementer agents, ~3 wks wall-clock)
  M31 Operational Ontology         — touches: assets, shipments, pos,
                                              counterparties, contracts, graph_edges
                                     SUB-DECOMPOSE if 3+ agents available:
                                       M31a — entities (assets, shipments, POs, counterparties)
                                       M31b — graph_edges + graph queries
                                       M31c — contracts + LLM extraction
  M33 Open-data Coverage            — touches: data_feeds, weather_observations,
                                              tariff_changes, regulatory_changes,
                                              extends sanctions_lists from v1.5 M17
  M37 Channel Depth                 — touches: digest_runs, users.{digest_preferences}

  M31 dependency: M28 for contract extraction provenance.
  M33 dependency: none.
  M37 dependency: extends v1.5 M23 (already shipped).

WAVE 3 — Coverage paid + community + onboarding (3 agents, ~3 wks wall-clock)
  M34 Paid Real-Time Feeds         — touches: vessel_positions, flight_positions,
                                              satellite_observations, feed_usage,
                                              shipments.{ais_tracked, last_ais_update}
  M35 Community/Custom Sources     — touches: extends data_feeds with custom types
  M38 PLG Onboarding Pack          — touches: onboarding_extractions

  M34 dependency: M31 (shipments must exist as first-class to track).
  M35 dependency: M28 (reliability scoring infrastructure).
  M38 dependency: M31 (entities must be first-class for onboarding to populate them).

WAVE 4 — Predictive (1 agent, ~2 wks wall-clock)
  M36 Predictive & Probabilistic   — touches: leading_indicators, predictive_alerts

  Dependencies: M28 + M30 + M31 + M33 + M34 + M35 (most data inputs)
  Single-agent because of the dependency density and the subjective nature
  of indicator curation. Pair-program with the lead human, not autonomous.

Total realistic wall-clock: 10–14 weeks with discipline.
Total agent-days: ~95–120.
Total wall-clock without discipline: 16–24 weeks (collisions and rework eat 30-50%).
```

### Why this wave order (and not a different one)

- **Wave 1 ships in 3 weeks because none of its 4 modules depend on each other.** Maximum parallelism.
- **M28 is in Wave 1 even though many things depend on it** because if it slips, everything else slips. Front-load the riskiest foundational work.
- **M31 ships in Wave 2 (not 1)** because it's the largest module (XL effort). Splitting it across Wave 1 + 2 risks contract churn in the most data-heavy module. Better to ship it as one cohesive piece in Wave 2.
- **M34 (paid feeds) is in Wave 3, not earlier**, because it requires M31 shipments to exist as first-class objects to track. Building AIS without shipments is rebuilding the data model twice.
- **M36 is alone in Wave 4** because it's the most subjective — leading indicators are curated, not coded. The build is mostly seeding the curation. Having one agent + lead human pair-program this is faster than four agents trying to coordinate.

---

## 12. New Contract Surfaces

Add these to `/specs/contracts/` before Wave 1 starts:

```
specs/contracts/
├── 00-data-model.contract.ts        # extended with M28-M38 schemas
├── 01-api-routes.contract.ts        # extended with M28-M38 endpoints
├── 02-events.contract.ts            # extended with provenance events
├── 03-feature-flags.contract.ts     # tier-gating per plan
├── 04-shared-utils.contract.ts      # extended
├── 05-llm-prompts.contract.ts       ← NEW. All LLM prompt templates.
├── 06-feed-providers.contract.ts    ← NEW. Paid-feed provider interfaces.
├── 07-cost-caps.contract.ts         ← NEW. Per-plan cost caps + enforcement.
└── README.md
```

### `05-llm-prompts.contract.ts` (new)

LLM prompts are a contract surface for v3 because:
- Multiple modules call the LLM (M28 methodology, M30 narratives, M31 contract extraction, M36 forecast rationales, M38 onboarding extractions).
- Drift between modules creates inconsistent voice and prompt-engineering bugs.
- Versioning prompts is a real concern (we'll want to A/B test prompt iterations).

```typescript
// specs/contracts/05-llm-prompts.contract.ts
//
// All LLM prompt templates live here. Modify only via CCR.
// Each prompt has a version. When a prompt changes, the version increments,
// and the calling module records which version produced each output
// (extraction_runs.pipeline_version field references this).

export const LLM_PROMPTS = {
  methodology_summary: {
    version: '1.0.0',
    model: 'claude-haiku-4-5',
    system: `You explain how Syntra knows what it knows...`,
    user_template: `Sources: {sources}\nExtraction trace: {trace}\nWrite a 2-3 sentence...`,
  },
  exposure_delta_narrative: { ... },
  contract_clause_extraction: { ... },
  forecast_rationale: { ... },
  onboarding_url_extraction: { ... },
  onboarding_pdf_extraction: { ... },
  natural_language_import: { ... },
} as const;
```

### `06-feed-providers.contract.ts` (new)

```typescript
// Paid-feed provider interfaces. All providers must implement this shape
// regardless of the specific API (MarineTraffic, FlightAware, Sentinel Hub).

export interface FeedProvider<TQuery, TResponse> {
  name: string;
  cost_model: 'free' | 'freemium' | 'paid';
  cost_per_request_inr: number;
  rate_limit: { requests_per_minute: number; requests_per_day: number };
  fetch(query: TQuery, opts: { org_id: string }): Promise<TResponse>;
  estimateCost(query: TQuery): number;
  // CRITICAL: every fetch checks org cap before hitting external API
  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<TQuery, TResponse>;
}
```

### `07-cost-caps.contract.ts` (new)

```typescript
// Single source of truth for per-plan cost caps across all paid feeds.
// Enforced at the FeedProvider level (06-feed-providers.contract).

export const PLAN_COST_CAPS = {
  starter: {
    feeds_total_inr_daily: 100,
    ais_vessels_max: 0,
    flight_tracking_max: 0,
    satellite_observations_per_month: 0,
    contract_uploads_per_month: 1,
    forecast_alerts_enabled: false,
  },
  growth: {
    feeds_total_inr_daily: 500,
    ais_vessels_max: 5,
    flight_tracking_max: 3,
    satellite_observations_per_month: 5,
    contract_uploads_per_month: 5,
    forecast_alerts_enabled: true,
  },
  enterprise: {
    feeds_total_inr_daily: 5000,
    ais_vessels_max: 50,
    flight_tracking_max: 30,
    satellite_observations_per_month: 50,
    contract_uploads_per_month: 50,
    forecast_alerts_enabled: true,
  },
} as const;

// Hard rule: no module may bypass these caps. Every paid-feed call
// passes through withCostGate(). Bypass attempts are CCR violations.
```

These contracts are immutable from implementer agents' perspective. Changes require CCR with rationale referencing customer feedback or documented technical need.

---

## 13. Paid-API Discipline (CRITICAL)

Wave 3 introduces paid third-party APIs with usage-scaled costs. Without discipline, costs spiral. The following rules are non-negotiable.

### 13.1 Every paid API call goes through a FeedProvider

No direct `fetch()` calls to MarineTraffic, FlightAware, Sentinel Hub, or any paid provider from anywhere outside `packages/feeds/`. All calls go through the FeedProvider abstraction in `packages/feeds/providers/{name}.ts`.

The FeedProvider abstraction is responsible for:
- Cost calculation per call
- Org-level cumulative cost check before the external call
- Rate limiting
- Retry with exponential backoff
- Logging to `feed_usage` collection
- Mock fallback if cap exceeded

### 13.2 Cost gating is checked PER CALL, not per cron

The naive "cron checks budget at start" pattern fails when a single cron iteration makes 100+ API calls and the budget is exceeded mid-iteration. Check the budget *immediately before each external call*, not at the top of the loop.

```typescript
// CORRECT
for (const vessel of trackedVessels) {
  const ok = await checkCostGate(org_id, 'ais_marinetraffic');
  if (!ok) {
    logCapHit(org_id);
    break;  // stop — do not continue with other vessels
  }
  const position = await marinetraffic.fetch({ imo: vessel.imo });
  // ...
}

// WRONG
const totalCost = trackedVessels.length * MARINETRAFFIC_COST_PER_CALL;
const ok = await checkCostGate(org_id, totalCost);
if (!ok) return;
for (const vessel of trackedVessels) { ... }  // budget could be exceeded by other workers in parallel
```

### 13.3 Mock fallback when cap hit

When an org's daily cap is exhausted, the FeedProvider returns a mock response (last-known-position from cache, "we don't have current data" placeholder). The org owner gets ONE notification per day when cap is hit. The dashboard shows a banner: "AIS tracking paused — daily cap reached. Upgrade plan or wait until tomorrow."

Do not "fail open" (i.e., make the call anyway). Do not "fail silent" (i.e., return empty without notifying). Both are CCR-violation severe.

### 13.4 Cost monitoring at the top of the supervisor cycle

The supervisor agent (orchestration §5.2) gets one new step:

```
CADENCE addition:
  1g. Check feed_usage.total_inr_today across all orgs.
      If sum > daily projection × 1.5: post alert to /reports/cost-spikes/{date}.md
      with breakdown by feed and by org. Lead human reviews same day.
```

Cost spikes are blockers, not background concerns. Catch them within the 30-minute cycle, not at end-of-month billing surprise.

### 13.5 Cost tests in CI

Every paid-feed test runs with a mocked provider that asserts:
- The call passed through `withCostGate`
- The call recorded usage in `feed_usage`
- The call respected rate limits (no retries faster than backoff)

Any feed test that calls `fetch` directly without `withCostGate` is a CI failure. Treat it as a contract violation.

---

## 14. Customer-Pull Gates Per Module

**The 39 features were approved speculatively.** That's fine, but Wave 2/3/4 priorities re-order based on what design partners ask for. Specifically:

### Wave 1 — speculative build is acceptable

M28, M29, M30, M32 can build before the first paying customer because they're foundational and every customer benefits from them. Build Wave 1 immediately while the v1 dashboard is in customers' hands.

### Wave 2 — gated by ≥1 customer ask per module

Before starting M31, M33, or M37, **at least one paying design-partner customer must have asked for that module's primary feature.** No customer asking for ontology after 30 days of v1 use → defer M31. Re-prioritize based on what they actually want.

Document the customer ask in `/reports/customer-pulls/{module}.md` before kicking off the build. Format:
```
# Customer pull — M31 (Operational Ontology)
Customer: Acme Pharma (₹2L/mo, contract signed YYYY-MM-DD)
Date of ask: YYYY-MM-DD
Channel: Slack DM / on-call / sales call
Direct quote: "We can't load our 200+ supplier contracts manually..."
Build justified: yes
```

### Wave 3 — gated by ≥3 customer asks per feature

Paid feeds (M34) get expensive. Don't build until 3+ customers explicitly ask for the specific feature. AIS tracking has different demand than satellite imagery has different demand than flight tracking. Don't bundle them — gate each independently.

Same pattern for M35 (custom sources) and M38 (URL/annual report onboarding).

### Wave 4 — gated by ≥6 months of M28+M30+M33 data

M36 forecasting needs 6 months of historical events + indicators + outcomes to be honestly evaluable. Don't ship a forecast feature with no track record. The Brier score dashboard would be empty and visibly so.

If marketing pressure pushes "ship M36 sooner": ship the leading indicator dashboard (Screen 42) without the predictive-alerts inbox (Screen 41). Half the feature is honest; the predictive-alerts half without accuracy data is theatre.

---

## 15. Updated Agent Prompts

### 15.1 Implementer Agent Prompt (v3 additions)

Add to BEFORE EVERY EDIT:

```
  7. If your module touches a paid third-party API:
     - Read packages/feeds/providers/README.md
     - Use the FeedProvider abstraction. Never fetch() directly.
     - Verify your usage respects PLAN_COST_CAPS from contracts/07-cost-caps.contract.ts
     - Add a CI test that asserts withCostGate was called.

  8. If your module makes LLM calls:
     - Use prompts from contracts/05-llm-prompts.contract.ts via the
       packages/llm helper.
     - Do not write new prompts inline. To add a new prompt: CCR.
     - Record the prompt version used in any extraction_run output.
```

Add to YOU MAY NOT:

```
  - Bypass cost caps. PLAN_COST_CAPS in contracts/07-cost-caps.contract.ts
    is enforced via FeedProvider. Bypass attempts (direct fetch, hardcoded
    bypass flags, "temporary" disabled gates) are CCR violations.
  - Inline LLM prompts. All prompts live in contracts/05-llm-prompts.
  - Ship a paid-feed feature without the mock-fallback path tested.
  - Ship M36 forecasts without a corresponding accuracy-tracking surface.
```

### 15.2 Supervisor Agent Prompt (v3 additions)

Add to CADENCE:

```
  1g. Run `git grep -nE "fetch\(['\"]https://(api\.marinetraffic|api\.flightaware|services\.sentinel-hub|api\.aviationstack)" apps packages` against each branch.
      Any direct paid-API fetches outside packages/feeds/ are CCR violations.
      Append [paid-feed:direct-fetch] warning to that branch's row.

  1h. Check feed_usage.total_inr_today aggregate across all orgs.
      If sum > (project monthly target / 30 × 1.5): write
      /reports/cost-spikes/{ISO-date}.md with breakdown by feed and org.

  1i. Run `git grep -nE "anthropic\.|openai\." apps/web apps/worker --not -E "from '@syntra/llm'"`
      to catch LLM SDK imports outside the llm helper package. Flag
      [llm:direct-import] for any hits — implementers must use the
      llm helper, not direct SDKs.
```

### 15.3 Cheat Sheet (v3 additions)

Add to YOU MAY NOT:

```
  - Hardcode design tokens (use packages/ui/tokens.ts)
  - Bypass cost caps (use FeedProvider abstraction)
  - Inline LLM prompts (use contracts/05-llm-prompts)
  - Direct fetch() to paid APIs (use packages/feeds/providers/)
```

---

## 16. Wave Spawn Recipe (v3)

### 16.1 Wave 1 setup

```bash
cd ~/code/syntra
git checkout main && git pull --ff-only

# Wave 1 worktrees
git worktree add ../syn-m28 -b feature/m28-provenance origin/main
git worktree add ../syn-m29 -b feature/m29-decision-log origin/main
git worktree add ../syn-m30 -b feature/m30-financial-exposure origin/main
git worktree add ../syn-m32 -b feature/m32-war-room origin/main
git worktree add ../syn-supervisor -b ops/supervisor-v3 origin/main

# Open 5 terminal panes. Pane 1-4 implementers, pane 5 supervisor.
# Use Sonnet 4.6 with bypass permissions, MAX_THINKING_TOKENS=4096.
```

In each implementer pane:
```bash
cd ../syn-m28  # adjust per pane
MAX_THINKING_TOKENS=4096 claude --model claude-sonnet-4-6 --dangerously-skip-permissions
```

Then paste the implementer prompt from §5.1 with the relevant `{N}` and `{Module Name}` filled in.

In the supervisor pane:
```bash
cd ../syn-supervisor
MAX_THINKING_TOKENS=2048 claude --model claude-sonnet-4-6 --dangerously-skip-permissions
```

Paste supervisor prompt from §5.2 (now with steps 1g, 1h, 1i added).

### 16.2 Wave 2 — depends on Wave 1 merge

Do not start Wave 2 until Wave 1 modules are merged to main, integration day passed, and `git log --oneline` on main shows all four Wave 1 commits squashed in.

```bash
# Wave 2 worktrees (only after Wave 1 merged)
git worktree add ../syn-m31 -b feature/m31-ontology origin/main
git worktree add ../syn-m33 -b feature/m33-open-data-coverage origin/main
git worktree add ../syn-m37 -b feature/m37-channel-depth origin/main
```

If splitting M31 into 31a/31b/31c (recommended if 3+ agents available):
```bash
git worktree add ../syn-m31a -b feature/m31a-entities origin/main
git worktree add ../syn-m31b -b feature/m31b-graph origin/main
git worktree add ../syn-m31c -b feature/m31c-contracts origin/main
# Use M31a as parent — m31b and m31c branches base off m31a, not main,
# because they extend the schemas m31a creates.
```

### 16.3 Wave 3 — gated by customer pulls per §14

Do not auto-spawn Wave 3 worktrees. Each module's worktree spawns only after `/reports/customer-pulls/{module}.md` exists with ≥3 customer asks for that specific module.

### 16.4 Wave 4 — pair-programmed, single agent

```bash
git worktree add ../syn-m36 -b feature/m36-predictive origin/main
```

Single Claude Code session, lead human (Maya) actively reviewing every commit. Not autonomous.

---

## 17. Updated Failure Mode Recovery Table

In addition to the table in §8, add these v3-specific failure modes:

| Symptom | Recovery |
|---|---|
| Paid API cost spike (>1.5× projection) detected by supervisor | Lead human reviews `/reports/cost-spikes/{date}.md` within 4 hours; either raises cap intentionally or pulls the relevant feed offline (set its `active: false` in `data_feeds`). |
| Implementer agent direct-fetches a paid API | Supervisor flags `[paid-feed:direct-fetch]`. Lead reverts that commit, re-issues spec to implementer with explicit FeedProvider example, re-runs. |
| LLM prompt drift (one module starts producing different voice than others) | Audit prompts — any prompt that's been modified outside `contracts/05-llm-prompts.contract.ts` is a CCR violation. Revert. Issue CCR for the canonical version. |
| Forecast accuracy (M36) Brier score >0.30 after first 30 days of forecasts | M36 ships in "Indicator dashboard only" mode (Screen 42 visible, Screen 41 hidden) until accuracy improves to <0.20. Update the predictive-alerts feature flag to `false`. |
| Customer-pull gate skipped (Wave 2/3 module starts without `/reports/customer-pulls/`) | Pause that worktree. Lead writes the customer-pull doc retroactively or kills the worktree. Speculative Wave 2/3 builds drift to feature-bloat fast. |
| Contract upload (M31c) fails LLM extraction with confidence <70% | Mark as "pending human review". Don't auto-create clauses. Show in admin queue for manual verification. Don't ship clauses with low confidence to the contract library — they undermine trust. |
| Provenance graph (M28) renders >5 seconds | Cache aggressively. Provenance is read-mostly; precompute graph layout per alert at alert-creation time and cache for 30 days. If still slow, audit query plans on `extraction_runs` joins. |
| War room participant count >20 (M32) | Performance issue: chat polling vs. websocket. v3 uses polling for simplicity; if a war room exceeds 20 participants, switch that war room to websocket-backed (one-off feature flag). Don't refactor everything to websockets speculatively. |

---

## 18. Updated Throughput Honesty (v3)

The v1.5 throughput math (§9) holds for Wave 1. Update for v3 specifics:

- **Wave 1 (4 parallel agents, additive on existing collections):** ~2.5–3× single-agent serial. Predictable.
- **Wave 2 (M31 monolithic):** if NOT split, single agent on M31 is the wall-clock bottleneck. Split into 31a/31b/31c if 3+ agents available — wall-clock drops from 24 days to ~14.
- **Wave 3 (paid feeds):** parallelism is constrained by API rate limits during testing. Two agents max can build/test paid-feed integrations simultaneously without hitting test-mode rate caps.
- **Wave 4 (M36):** single agent + lead human pair-programming. No parallel multiplier.

Realistic total wall-clock across all waves: **10–14 weeks**. Without discipline (skipping CCRs, skipping integration days, skipping cost-gate enforcement): 16–24 weeks with subtle cost overruns and drift.

The math doesn't change. Discipline does.

---

## 19. Cheat Sheet (v3, complete)

```
═══════════════════════════════════════════════════════════════════
  SYNTRA OPERATIONAL FOUNDRY (v3) — AGENT CHEAT SHEET
═══════════════════════════════════════════════════════════════════

WHO YOU ARE
  Implementation agent for Module M{N}. Not an architect.
  Build what the spec says.

BEFORE EVERY EDIT
  1. Read /specs/99-DO-NOT-BUILD.md
  2. Read /specs/{N}-*.md
  3. Read /specs/contracts/00-data-model.contract.ts
  4. Read /reports/supervisor-log.md
  5. If touching UI: read syntra_design_guide.md + packages/ui/tokens.ts
  6. If touching paid APIs: read packages/feeds/providers/README.md
  7. If making LLM calls: use contracts/05-llm-prompts and packages/llm

YOU MAY WRITE TO
  - Module-scoped paths only (per spec)
  - /reports/plan-{N}.md, /reports/done-{N}.md
  - /reports/questions/{N}-{seq}.md
  - /specs/contract-changes/m{N}-{seq}.md

YOU MAY NOT
  - Modify /specs/contracts/* directly (use CCR)
  - Modify packages/ui/tokens.ts directly (it is a contract surface)
  - Hardcode design tokens (use packages/ui/tokens.ts)
  - Bypass cost caps (use FeedProvider abstraction)
  - Inline LLM prompts (use contracts/05-llm-prompts)
  - Direct fetch() to paid APIs (use packages/feeds/providers/)
  - Touch other modules' code paths
  - Add dependencies without /reports/dep-request/{seq}.md
  - Skip tests
  - Mark done without /reports/done-{N}.md

WHEN STUCK
  Stop. Write /reports/questions/{N}-{seq}.md. Wait.

WHEN FINISHED
  All tests pass. Typecheck clean. /reports/done-{N}.md exists.
  No further edits until reviewed.
═══════════════════════════════════════════════════════════════════
```

---

*End of Part III. Build in waves. Hold the discipline. Listen to customers. Cost gates first, features second.*
