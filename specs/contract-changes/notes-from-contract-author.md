# Notes from Contract Author — Pre-existing Issues Found

**Date:** 2026-05-10
**Author:** Contract author agent (agent/syntra-contracts worktree)

---

## Bug 1 — packages/llm typecheck fails (pre-existing, not caused by contracts)

**Severity:** Medium — blocks `pnpm typecheck` from returning exit 0

**Location:** `packages/llm/index.ts`

**Errors observed:**
```
packages/llm: index.ts(6,21): error TS2307: Cannot find module '@anthropic-ai/sdk' or its corresponding type declarations.
packages/llm: index.ts(10,36): error TS2580: Cannot find name 'require'. Do you need to install type definitions for node?
packages/llm: index.ts(11,39): error TS2580: Cannot find name 'process'. Do you need to install type definitions for node?
packages/llm: index.ts(28,18): error TS2580: Cannot find name 'process'. Do you need to install type definitions for node?
packages/llm: ../shared/mocks/anthropic.ts(1,1): error TS2584: Cannot find name 'console'.
packages/llm: ../shared/mocks/anthropic.ts(32,54): error TS2304: Cannot find name 'setTimeout'.
```

**Root cause:** The `packages/llm` package appears to have two issues:
1. `@anthropic-ai/sdk` is either not installed or not listed in its `package.json` dependencies
2. `@types/node` is missing from `devDependencies`, so `process`, `require`, `console`, and `setTimeout` are not available to TypeScript

**Impact on parallel build:** The supervisor's `pnpm typecheck` cycle will always fail until this is fixed. This means the supervisor cannot use the exit code of `pnpm typecheck` as a reliable health signal — it must filter out the known-broken package.

**Recommended fix (lead human action required — do not let any implementer fix this):**
1. Add `@anthropic-ai/sdk` to `packages/llm/package.json` dependencies
2. Add `@types/node` to `packages/llm/package.json` devDependencies  
3. Run `pnpm install`
4. Verify `pnpm --filter @syntra/llm typecheck` passes

**This is pre-existing.** The contracts package (`@syntra/contracts`) was added to the workspace and its typecheck passes without errors. The overall `pnpm typecheck` failure is solely attributable to `packages/llm`.

---

## Note on pnpm-workspace.yaml modification

The contract author added `specs/*` to `pnpm-workspace.yaml` to include the contracts package in the workspace. This was necessary to make `pnpm typecheck` validate the contracts alongside the rest of the codebase. This is a one-line additive change and not a TypeScript source modification.

If the lead human objects to this change, an alternative approach would be to move `specs/contracts/` inside `packages/contracts/`. Either path achieves the same result.

---

## Contracts themselves: all pass

Running `pnpm --filter @syntra/contracts typecheck` returns exit 0 with no errors.
All 8 contract files are syntactically valid TypeScript 5.4 with strict mode enabled.
