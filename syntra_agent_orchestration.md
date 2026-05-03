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
