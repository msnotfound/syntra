# Handoff to next Claude Code session

**Maya, msnotfound on GitHub.** Building **Syntra** — B2B supply-chain risk intelligence platform, positioned as Palantir-competitor for mid-market enterprises Palantir refuses to serve. Subsidiary of Warfront (parent OSINT brand at warfront.live).

**Status as of this writing**: YC application has been submitted. Build is post-v3-complete, currently in *deep-pass* phase upgrading REAL-LITE features to REAL-DEEP. Multi-night marathon with orcha (parallel-agent harness in `~/agents/`).

---

## Read this in order

1. The "what's actually true" section below
2. The "Maya's working style" section — non-negotiable
3. The "in flight" section — what's running and what to do when it finishes
4. The "what's next" queue
5. SETUP.md (already in this directory) for credentials Maya still needs to wire

---

## What's actually true (verified, not claimed)

### Repo state
- Path: `/mnt/WindowsData/Users/MAYANK SAHU/Desktop/LinuxFiles/warfront/syntra`
- Origin: `https://github.com/msnotfound/syntra`
- Current branch: `main`, pushed to origin, typecheck green across all 8 packages, 176/176 tests pass, 35/35 routes return 200.

### What's on `main` (genuinely built and merged)
- All 23 v3 modules (M16–M38). ~35,000 LOC of feature code.
- 8 contract files in `specs/contracts/` — locked surfaces, no agent edits allowed.
- Premium UIUX overhaul (60-file token migration + 20-file premium pass) — wine-restraint enterprise feel, motion tokens (instant/quick/poised/considered), focus-visible only, no shadows, hairline borders.
- Comprehensive Sundaram Pharma seed across 17 v3 collections (`packages/db/seed/sundaram-pharma-v3.ts`, idempotent).
- `SETUP.md` — 14-section manual checklist for prod launch.
- Routing conflict in `/api/v1/briefs` resolved (token route moved under `/share/`).
- Test infrastructure: 176 tests, 13 suites, all green on host (NOT in codex sandbox — sandbox blocks sockets).

### What's flagged THIN despite shipping (per Maya's last critique)
She's right about all three:
1. **Provenance traceability** exists in M28 but is buried — should be pervasive UX.
2. **War rooms** are "just chat" — no action items, no decision-recorder, no state propagation.
3. **PLG onboarding** is shallow — no PDF parsing, no JS-rendered SPA support, no real enrichment.

She rejected the buildplan's REAL-LITE/REAL-DEEP framing. Her words: *"fuck the buildplans, I want all of those features (real, real-lite, impossible whatever the fuck there is), absolutely complete."*

---

## In flight RIGHT NOW (10 deep-pass agents)

Spawned in parallel ~12:00 IST. Tracker:

| Agent | Branch | State | Notes |
|---|---|---|---|
| `syn-prov-ux` | `feature/prov-ux-deep` | ✅ DONE & PUSHED | Sonnet, 5 atomic commits. Pervasive provenance UX, tooltips, source badges, forecast detail with React Flow claim graph, decision log integration. |
| `syn-warroom-deep` | `feature/warroom-deep` | ✅ DONE & PUSHED | Sonnet, 2 commits. Action items, decision recorder, state propagation, mitigation accept flow, quick-poll, transcript PDF export. |
| `syn-plg-deep` | `feature/plg-deep` | ✅ DONE & PUSHED | Sonnet, 1 commit. Multi-strategy fetch (HTML + Playwright + pdf-parse), sector template, dedupe, multi-source enrich (LinkedIn/Crunchbase/CompaniesHouse/GST stubs). |
| `syn-graph-deep` | `feature/graph-deep` | ✅ DONE & PUSHED | Codex, 1 commit. Graph extract worker, sourcing inference, confidence scoring. No rate-limit hits = full depth. |
| `syn-sanctions-deep` | (not pushed yet) | 🔄 STILL RUNNING | Codex. Composite scoring (name + DOB + country + address), UBO traversal, UN/EU lists. No rate-limit hits as of last check. |
| `syn-var-monte` | (staged not committed) | ⚠️ PARTIAL | Codex, 2 rate-limit hits. Monte Carlo VaR sim. ~40-60% complete. |
| `syn-mitig-deep` | (staged not committed) | ⚠️ PARTIAL | Codex, 2 rate-limit hits. Multi-step LLM chain + accept follow-on. ~30-60% complete. |
| `syn-nl-deep` | (staged not committed) | ⚠️ PARTIAL | Codex, 2 rate-limit hits. NL multi-turn + conjunctions. ~50-70% complete. |
| `syn-forecast-ml` | (staged not committed) | ⚠️ PARTIAL | Codex, 2 rate-limit hits. Bayesian update + calibration. ~40-60% complete. |
| `syn-insurance-deep` | (staged not committed) | ⚠️ PARTIAL | Codex, 2 rate-limit hits. Sub-limits / aggregate / claims math. ~30-60% complete. |

**The codex partials are because OpenAI's org TPM limit is 500K — running 7 codex agents in parallel exceeded it; each got truncated mid-run, retried, eventually exited 0 with incomplete work. Exit-code-0-but-rate-limited = the wrapper script can't tell the difference.**

### What "DONE" partials actually need

For the 5 ⚠️ rows above:
1. Manually `git add -A && git commit && git push origin HEAD:feature/<name>` for each (codex doesn't commit at end — *known recurring pattern*).
2. Then queue **sequential** retries (one at a time, not parallel) for any spec items the partial pass didn't cover. Each retry needs ~$3-5 of codex spend and gets the full 500K TPM to itself.

---

## What's queued for after this wave merges

Spawn order, all single-stream (NOT parallel — TPM management):

1. `syn-mitig-deep-2` — finish the 4-step LLM chain + accept-flow integration with Shipment/Decision/Contract follow-ons.
2. `syn-nl-deep-2` — verify multi-turn conversation state, conjunction parsing, follow-up resolution.
3. `syn-var-monte-2` — Monte Carlo math + 4-test-case validation + 75/95/99 percentile bands UI.
4. `syn-forecast-ml-2` — Bayesian update math + calibration plot in indicators page.
5. `syn-insurance-deep-2` — sub-limit application + aggregate exhaustion + exclusion zero-out.

Then **the Firecrawl swap-in for `feature/plg-deep`**:
- Replace Playwright primary with Firecrawl primary, Playwright as fallback.
- Replace LinkedIn-scraper stub with Apollo API stub (legitimacy).
- Crunchbase API stub (real, $99/mo plan).
- Maya's research: she asked about Apify/Firecrawl. My recommendation: **Firecrawl YES**, **Apify NO** (legal risk on LinkedIn). See conversation context.

**Then RBAC + visual-polish-remaining-30-screens + Playwright E2E tests.** That's the final batch before "REAL-DEEP across the board."

---

## Maya's working style — non-negotiable

**Direct, blunt, no fluff.** She'll catch you if you miss something, gloss over something, or oversell. She caught me twice — once when I called rate-limited agents "complete," and once when I said "all features built" and she rightly said war room is just chat.

**Hates scope-deferral excuses.** If you're tempted to say "let's defer to v1.5" or "buildplan says REAL-LITE", *don't*. The previous Claude got fired for being too cautious. Quote: *"claude always insists on leaving actually good features for later etc.. and delays everythig its s mch ofa headache."*

**Prefers codex when possible** (free OpenAI credits, $2,500 YC startup school grant) over Claude credits ($500 budget, ~$340 spent). API key for codex was added; current TPM tier on org `org-A2u9BRRQ1FShG06i1gvwwSF5` is 500K (Tier 1 with payment method added). Codex auth mode: `apikey` in `~/.codex/auth.json`.

**Tracks costs.** Tell her transparently when you spend. She's at ~$340/$500 of Claude credits as of this session ending, OpenAI ~$20-25 spent of $2,500.

**Wants the demo to look unmistakably premium.** "Wine-like, restrained, expensive without flashy." Inspo: warfront.live (the parent brand's site). Bloomberg Terminal / Linear / Pylon are reference targets. Anti-references: vibe-coded SaaS, glassmorphism, gradients, Webflow-grade animations. The `syntra_design_guide_v3.md` codifies this.

**Doesn't want explanations she didn't ask for.** Just do the thing. If you have to push back on a decision, do it in 2-3 sentences with the alternative and let her redirect.

**Iterates fast.** She'll fire instructions one after the other. Don't wait for permission to act on the obvious next move.

---

## Recurring gotchas (will save you time)

1. **Codex doesn't commit/push at end.** Even on clean exits. Pattern is: `exit code: 0`, files staged, no commits. Solution: every codex agent's wrap-up MUST be `git -C <worktree> add -A && commit && push`. Don't trust exit code as "done."
2. **Codex sandbox can't bind sockets** → mongodb-memory-server fails inside agents → tests fail in agent but pass on host. Run tests on host, not in agent worktrees.
3. **Codex sandbox has no network during install** → `pnpm install` fails → smoke-tests die. Run smoke tests on host.
4. **Claude headless `claude -p` buffers stdout until exit by default.** `--verbose` flag added to `orch-spawn` mostly fixes this but some sonnet agents still go silent for 10+ min while making real progress. Don't kill silent claude; check the worktree filesystem for activity.
5. **Sonnet `--max-turns` default was 60 → bumped to 150** in `orch-spawn`. Don't lower it. Real module work needs 100-150.
6. **Auto-resolver script at `/tmp/auto_keep_both.py`** handles "additive both-side merge conflicts" automatically. Use it. Won't handle non-additive conflicts (like Sidebar.tsx imports) — those need manual edit.
7. **`apps/web/.env` is a symlink to `../../.env`** (or copy). Required because Next.js dev server doesn't load root `.env`. `seed/index.ts` and `apps/worker/src/index.ts` were patched to load `../../../.env` explicitly.
8. **MongoDB Atlas is set up.** URI in `.env`. Real seeded data lives there. `pnpm seed` is idempotent.
9. **Anthropic API key is set.** LLM features call real Anthropic.
10. **Mapbox token is set.** Maps render.
11. **Don't push to `origin/main` directly from agent worktrees.** Always merge via the main syntra clone.
12. **`packages/shared/mocks/anthropic.ts` had a malformed function bracket once** — caused typecheck cascade. If you see weird TS1005 errors after a merge, check this file first.
13. **Sidebar.tsx is the canonical UI shell.** Every UI module wants to add a nav item there → it's a recurring conflict surface. Keep an eye on it.
14. **Disk fills up fast.** Every orcha worktree gets its own ~150-800MB pnpm install. Wipe old worktrees regularly: `git worktree prune && rm -rf ~/agents/worktrees/<finished-id>`.

---

## Cost ledger (best estimates)

```
Claude credits (of $500 YC grant):
  orcha L0+L1 setup          ~$5
  Wave 6 (7 modules + retries)   ~$50
  Wave 6.5 (8 modules)            ~$80
  Wave 7 (4 + m31 manual finish)  ~$50
  Wave 8 (m22 sonnet + 2 haiku)    ~$10
  m36 forecast (sonnet)            ~$15
  contracts authoring               ~$5
  test fixes / cleanup              ~$5
  premium UIUX (sonnet)            ~$15
  3 deep-pass sonnets (this wave)  ~$45
  ───────────────────────────────────
  ≈ $280-340 spent, ~$160-220 remaining

OpenAI credits (of $2,500 YC grant):
  rate-limited fails before payment add: $0
  codex run since payment add ~$20
  ≈ $2,480 remaining
```

**Rule going forward**: codex first for any task where it's adequate. Sonnet for: cross-file architecture, design synthesis, integration that needs pattern-matching across many files. Opus only when explicitly authorized.

---

## File map for fast orientation

```
syntra/
├── HANDOFF.md                           ← you are here
├── SETUP.md                             ← Maya's manual setup checklist (Atlas, Mapbox, etc.)
├── syntra_buildplan_v3.md               ← 148KB spec — module M16–M38 definitions
├── syntra_design_guide_v3.md            ← 134KB design contract (read this for UI work)
├── syntra_agent_orchestration_v3.md     ← 45KB orchestration playbook
├── tokens.ts (root)                     ← legacy, see packages/ui/tokens.ts for current
├── apps/
│   ├── web/                             ← Next.js 14 App Router; ~35 routes
│   └── worker/                          ← Node + cron + BullMQ workers
├── packages/
│   ├── db/                              ← Mongoose schemas + seed (sundaram-pharma + v3)
│   ├── ui/                              ← tokens.ts (canonical), 4 v1 components
│   ├── shared/                          ← schemas, mocks, utils
│   ├── llm/                             ← Anthropic helper with mock fallback
│   └── feeds/                           ← FeedProvider abstraction + cost gate
├── specs/
│   └── contracts/                       ← 8 LOCKED contract files; no agent edits
├── reports/
│   ├── design-qa-*.md                   ← token violation audit
│   ├── smoke-test-*.md                  ← route status table
│   ├── uiux-overhaul-summary.md         ← premium pass writeup
│   └── overnight/                       ← session-N handoffs from earlier nights
└── .env                                 ← MongoDB + Mapbox + Anthropic populated
```

---

## What "victory" looks like

For YC + first design partners (10 days from session end):
- All 5 ⚠️ partials → ✅ DONE
- Firecrawl swap-in done; PLG actually works on real PDFs and JS-rendered SPAs
- RBAC working (admin/analyst/viewer)
- Playwright E2E tests for the 8 demo flow steps
- Visual polish swept across remaining ~30 screens
- Mongo Atlas IPv6 / DNS / restricted-IP setup
- Domain decided + DNS pointed (`syntra.app` candidate)
- Vercel deploy live with secrets piped through

For first paying enterprise customer:
- See `SETUP.md` items 0–11. None of those are auto-doable; all need Maya's hands.

For SOC2 / Refinitiv / SAP-tier features: that's v2, separate sprint.

---

## Final note from this session

The orcha pattern works — it shipped 23 modules in one night, a premium UIUX overhaul in 30 min, and 4 deep-pass refactors in 1 hour. The breakage points are all known and documented above:

- Codex finish-without-commit (always manually finalize)
- Codex parallel TPM contention (sequence them)
- Codex sandbox limits (run tests / smoke on host)
- Sonnet headless silence (trust filesystem activity over log lines)
- Auto-merge conflicts on additive collisions (use the python script)

Don't re-learn these. They're the cost of admission, paid.

Maya is sharp. Don't bullshit her. If you find yourself using buildplan or scope as a shield, she'll spot it and shove the conversation back to "absolute completion." That's the right instinct. Build the thing.

— Claude (this session)

---

## Appendix: orcha cheatsheet

Bash scripts at `~/agents/bin/`, on `$PATH`. Run any with `-h` for help.

```bash
# Spawn an agent
orch-spawn <agent-type> <task-id> "<prompt>" --repo . [--budget-usd N] [--turns N]
#   agent-types: codex | gemini | claude-haiku | claude-sonnet | claude-opus
#   creates worktree at ~/agents/worktrees/<task-id>/ on branch agent/<task-id>
#   logs to ~/agents/logs/<task-id>.log
#   spawns in tmux session "orchestra"
#   for codex: --budget-usd is silently ignored (codex bills OpenAI directly)
#   for claude: --budget-usd caps spend per spawn

# Status / monitoring
orch-list                          # status table of all tracked agents
orch-watch <task-id>               # last 50 lines from agent's tmux pane
orch-watch <task-id> --follow      # tail -F the log
orch-watch <task-id> --grep ERR    # filter

# Killing
orch-kill <task-id>                # kills tmux window; asks whether to keep worktree

# Inspecting output
~/agents/logs/<task-id>.log        # full streaming log (claude --verbose, codex always streams)
~/agents/worktrees/<task-id>/      # the worktree — `git status`, `git diff`, `cat <file>`

# When codex finishes (ALWAYS staged-but-not-committed — recurring pattern):
cd ~/agents/worktrees/<task-id>
git add -A
git commit -m "feat(...): description"
git push origin HEAD:feature/<your-branch>

# Auto-resolve trivial both-side additive merge conflicts (model exports, route registers):
python3 /tmp/auto_keep_both.py <conflicted-file>
# Won't handle import-line collisions or non-additive merges → manual edit.

# Defaults patched into orch-spawn (do NOT lower):
#   sonnet  --max-turns 150
#   haiku   --max-turns 50
#   opus    --max-turns 200
#   --verbose flag enabled so claude streams during run

# Disk hygiene — every worktree gets ~150-800MB of pnpm install:
git worktree prune
rm -rf ~/agents/worktrees/<finished-id>

# State file (jq-readable):
~/agents/state/.orchestra-state.json
```

### TPM management for codex
- Org `org-A2u9BRRQ1FShG06i1gvwwSF5` is at Tier 1 (~500K TPM on gpt-5.5).
- Running >3 codex agents in parallel collectively will exceed TPM → silent truncation → exit 0 with partial work.
- Sequence codex when each agent's prompt + reads will exceed ~150K tokens. Parallelize codex only for trivial scopes.
- Anthropic rate limits are separate and much higher; sonnet/haiku/opus can run 5+ in parallel safely.

### Common spawn templates

```bash
# Codex on the main syntra repo:
orch-spawn codex syn-feature-name \
  "your tight prompt here. Push to feature/feature-name." \
  --repo .

# Sonnet on a heavy module:
orch-spawn claude-sonnet syn-feature-name \
  "preamble + tight prompt + push instruction" \
  --repo . --budget-usd 16

# Gemini for long-context reads (1M ctx, free tier):
orch-spawn gemini doc-reader-task "..." 
# (gemini sandbox to cwd — pre-stage docs in worktree before spawning)
```
