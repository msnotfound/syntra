# Syntra v3 Contract Files

This directory contains the canonical contract files for the Syntra v3 parallel build.
Every implementer agent reads these files **before every edit**. No implementer agent
writes to this directory — all changes go through the CCR protocol below.

---

## What are contracts?

Contracts are immutable TypeScript files that define the shared API surface across all
parallel modules. They contain:

- **Type declarations** — Mongoose schema mirrors as plain TypeScript types
- **Zod schemas** — request/response shapes for every API endpoint
- **Enums** — shared classification values (severity, event kind, entity type)
- **Interface signatures** — abstract interfaces that implementations must satisfy
- **Configuration constants** — feature flags, cost caps, provider registry

Contracts have **zero app code**. They import only `zod`. They never import from
`@syntra/db`, `@syntra/shared`, or any app package. This keeps them lightweight and
prevents circular dependencies.

---

## File index

| File | Purpose | Primary consumers |
|---|---|---|
| `00-data-model.contract.ts` | All Mongoose schema types + v3 additions | All modules, supervisor |
| `01-api-routes.contract.ts` | Zod schemas for every `/api/v1/*` endpoint | API route implementers, tests |
| `02-events.contract.ts` | Event taxonomy (kind enum, GeoJSON, dispatch shapes) | Matching engine, M17, M20 |
| `03-feature-flags.contract.ts` | v3 feature flags + plan-tier gating | All modules, middleware |
| `04-shared-utils.contract.ts` | Utility function signatures + v3 additions | All modules |
| `05-llm-prompts.contract.ts` | LLM prompt template registry | M18, M22, M26, M27, dispatcher |
| `06-feed-providers.contract.ts` | FeedProvider interface + provider registry | M17, M33, M34, M35 |
| `07-cost-caps.contract.ts` | Per-plan INR cost caps + enforcement types | FeedProvider, supervisor |

---

## BEFORE EVERY EDIT — implementer agent checklist

```
1. Read specs/99-DO-NOT-BUILD.md
2. Read your module spec (/specs/{N}-*.md)
3. Read specs/contracts/00-data-model.contract.ts
4. Read specs/contracts/README.md (this file)
5. Read /reports/supervisor-log.md (last 20 entries)
6. If touching UI: read syntra_design_guide.md + packages/ui/tokens.ts
7. If touching paid APIs: read 06-feed-providers.contract.ts + 07-cost-caps.contract.ts
8. If making LLM calls: read 05-llm-prompts.contract.ts
```

If anything in steps 1–8 contradicts what you are about to build: **STOP**. Write a
question file at `/reports/questions/{N}-{seq}.md` and wait for lead-human resolution.

---

## Contract Change Request (CCR) Protocol

Any time an implementer needs to change a contract file, they must follow this protocol.
Silently modifying a contract file is a violation caught by the supervisor agent within
30 minutes and triggers a branch revert.

### Step 1 — Write the CCR

Create `/specs/contract-changes/m{N}-{seq}.md` using this template:

```markdown
# CCR m{N}-{seq} — {one-line description}

## What needs to change
{Specific field / type / signature — be precise}

## Why
{1–3 sentences. Reference the spec section that requires this change.}

## Backward compatibility
{additive / nullable / migration plan / breaking}
Choose one:
- additive: new field with a default, no existing code breaks
- nullable: existing required field becomes optional, callers may need updating
- migration plan: describe it
- breaking: schema change that breaks existing consumers — justify strongly

## Affected modules
{List M-numbers that read or write this contract surface}

## Approval needed from
- Lead human (Maya)

STATUS: AWAITING APPROVAL — DO NOT MERGE
```

### Step 2 — Stop work

After writing the CCR, the implementer **stops** in their worktree. They do not proceed
with implementation. They do not guess what the approved version will look like.

### Step 3 — Lead human reviews

The lead human (Maya) reads the CCR, approves or rejects. Approval comes via a comment
on the CCR file or a direct message.

### Step 4 — Lead applies the change

On approval, the lead edits the contract file on a separate `chore/contract-{seq}` branch
and merges to main. This is not done by the implementer agent.

### Step 5 — All worktrees rebase

All in-flight worktrees pull main and rebase:

```bash
git fetch origin
git rebase origin/main
```

### Step 6 — Implementer resumes

Only after rebase is the implementer allowed to continue building.

### Why the overhead is worth it

CCRs are bureaucratic on purpose. The cost of pausing one agent for a few hours is far
lower than the cost of two agents silently disagreeing on a schema and producing
conflicting implementations that take two days to untangle on integration day.

Four parallel agents with a shared contract surface outperform four independent agents
by 2–3×. Four agents without the contract surface underperform a single agent.

---

## Design token CCRs

`packages/ui/tokens.ts` is also a contract surface. Changing color values, spacing
scale, radii, font choices, or transition timing requires a CCR with the "Why" section
referencing the corresponding section of `syntra_design_guide.md` (typically §15.5).

Token changes propagate atomically: lead merges, all worktrees rebase, no module ships
with stale tokens. Per-module token drift is the failure mode that turns a consistent
product into four inconsistent screens — the supervisor checks for it every 30 minutes.

---

## Supervisor enforcement

The supervisor agent (running in `ops/supervisor` worktree) enforces contracts every
30-minute cycle:

1. Verifies no file in `/specs/contracts/` was modified without a corresponding CCR
2. Verifies `packages/ui/tokens.ts` was not modified without a CCR
3. Greps for hardcoded legacy zinc tokens (`#27272A`, `#3F3F46`, `#52525B`)
4. Greps for direct paid-API `fetch()` calls outside `packages/feeds/`
5. Greps for inline LLM SDK imports outside `packages/llm/`
6. Runs `pnpm typecheck` against a hypothetical merge of all active branches
7. Runs `pnpm test` for each module's test paths

Violations are flagged in `/reports/blockers/` within 30 minutes, not at integration day.

---

## Integration day

Every 5 working days, a freeze is called. All branches rebase onto main and the full
suite runs against the merged state. Branches that pass are squash-merged. Branches
that have contract collisions get CCRs opened before the unfreeze.

Skipping integration day is how parallel work compounds into merge hell. Do not skip.

---

## Adding a new contract file

New contract files (e.g., `08-ontology.contract.ts`) require a CCR describing:
- What new surface this covers
- Which modules will read it
- Why it cannot be expressed in an existing contract file

The lead human creates the new file on a `chore/contract-{seq}` branch.
Implementers do not create contract files.

---

*End of contract README. Build in waves. Hold the discipline. Ship.*
