# Backfire — Agent Guide

Hackathon build (7h, demo at 18:00). Backfire maps competitive contagion across a customer account galaxy, arms defense plays gated on verified contacts, and reallocates Sillage tracking slots as a counter-strike. Product concept, judging context, and demo script live in `PRODUCT.md`. This file is the engineering source of truth: read it before any task, update it in the same change when a durable decision or constraint appears.

## Core flow (what the code implements)

```
POST /api/scan
  └── adapters/sillage: fetch signals for book accounts
        └── agents/strategist: infer adversary playbook from trigger signal
              └── agents/critic: per-neighbor contagion test
                  (precomputed Claude similarity + targeted sillage calls)
                    └── core: Verdict { accountId, state, evidence[] }
                          └── exposed accounts → agents/playwright: defense play
                                └── adapters/fullenrich: verify contact
                                    play stays "frozen" until verified → "armed"
POST /api/go/:playId
  └── unlocks draft generation for that play only (no send path exists)
POST /api/reallocate
  └── agents/quartermaster: move Sillage slots defense ↔ counter-fire,
      justification required per move
GET /api/state → full galaxy + plays + audit log (UI polls this)
```

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript 5.x strict, single Next.js App Router app |
| Package manager | pnpm. Do not switch |
| State | In-memory store behind an interface. `data/` = mock book JSON, `fixtures/` = recorded MCP responses. No DB |
| LLM | Anthropic SDK. Model name in one named constant in `src/core/constants.ts` |
| MCP | Sillage + FullEnrich, called from API routes via adapters only |
| Validation | Zod on every MCP response and every LLM output |
| Front | D3 force layout on 2D canvas. Fallback: clustered static grid. No 3D |
| Tests | `pnpm smoke` = the demo path against fixtures |

## Commands

```bash
pnpm install
pnpm dev
pnpm smoke            # demo path on fixtures; run after EVERY change
pnpm smoke:live       # same path, live MCPs; costs credits, use sparingly
pnpm typecheck        # tsc --noEmit
pnpm lint
pnpm build
```

## Architecture

```
src/
  app/          # routes + API endpoints. Wiring only, no business logic
  core/         # pure domain: states, verdicts, slot budget math, constants. No IO
  agents/       # strategist / critic / playwright / quartermaster: prompts, schemas, loop
  adapters/     # sillage, fullenrich, anthropic, fixture-replay. Interfaces only
  components/   # galaxy canvas, play panel, counter-fire panel, GO flow
data/           # mock CRM book. Frozen after 11:00 (demo script depends on ids)
fixtures/       # recorded real MCP responses. PROTECTED: regenerate, never hand-edit
```

Non-negotiable rules:

- **Dependencies point inward only.** Routes call agents; agents call core and adapters. No SDK call in core, no business logic in routes or components.
- **States are discriminated unions with a legal-transition map.** Account: `unknown | attacked | exposed | cleared`. Play: `frozen | armed | go | draft_ready`. A play cannot reach `armed` without a verified contact; `draft_ready` is only reachable from `go`. Make illegal transitions unrepresentable, not runtime-checked.
- **Parse at the boundary.** Zod schema on every MCP response and every LLM reply before it reaches logic or UI. Malformed LLM output degrades to a visible `verdict_pending` state, never a crash.
- **Time-box every external call**: LLM 60s, MCP 20s, one retry, then fall through to the fixture. A hung call must not hang the request.
- **Fixture-or-live is one adapter decision** behind `DEMO_MODE=live|replay`. In `live` mode, every successful MCP call is recorded to `fixtures/`. Business code never knows which it got.
- **No scaffolding.** Only folders with real code behind them. Not on the demo path = not built today.

## Before writing code

1. `rg` first: has this already been built? SDK and MCP quickstarts exist, use them.
2. Is this on the demo path? If not, stop.
3. Right layer? An MCP concern leaking into core or a component means stop and rethink.

A 20-second question to the team beats a 2-hour wrong implementation. Restate the goal in one line, flag the risky assumption, disagree and commit.

## Quality rules

- No `any` / `as any` / double casts / non-null assertions. Fix the type or model the state.
- Guard clauses first, max 3 nesting levels, one responsibility per function.
- Named constants for thresholds: similarity cutoff, slot count, timeouts, model name.
- Comments capture business decisions only (e.g. "send path intentionally does not exist"). Never narrate code.
- Secrets in env vars only; server-side keys never reach the client. Never log prompts, tokens, or enriched contact values (emails/mobiles are PII: log `verified: boolean` + provider count, never the values).
- LLM output is a draft until parsed. This app performs **no external writes**; the only mutation is internal state after a human GO.

## Logging (spec, not optional: the audit log is a UI feature)

Structured events, stable `snake_case` names, start + completion pairs carrying ids and `duration_ms`: `playbook_inference_*`, `contagion_test_*`, `verdict_emitted`, `enrichment_verified`, `slot_reallocated`, `draft_unlocked`. `GET /api/state` exposes this log; the front renders it as the agent audit trail. Aggregate counts in loops, no per-row logging.

## Testing

`pnpm smoke` seeds the book, replays fixtures, runs the full loop, and asserts: final galaxy states, at least one `cleared` account, one `armed` play, one slot reallocation, and that no `draft_ready` exists without a prior GO. Re-run after every change. Never weaken it to make it pass.

## Git

- Commit early and often to `main`. Every commit leaves `pnpm smoke` green (live rollback points).
- Conventional Commits, imperative, English. No `Co-Authored-By` or tool-attribution lines.
- No force pushes, no destructive git operations.

## Agent rules

- Read affected files before editing. Small, verifiable changes. Only the requested scope.
- New dependencies require team approval (one message).
- **Do not trust internal knowledge for Sillage MCP, FullEnrich MCP, or the Anthropic SDK.** Read the tool schemas from the MCP handshake and installed package docs before writing integration code. Record hour-1 findings in the Decision log.
- Protected paths: `fixtures/` (regenerate only), `data/` after 11:00.
- No destructive commands without explicit approval.

## Decision log

- **D001** — 2026-07-09 — Single Next.js app, in-memory state, no DB. Rejected: separate backend (integration overhead in 7h).
- **D002** — 2026-07-09 — Draft generation gated behind `go` state; no send path anywhere in the codebase. Product constraint, see PRODUCT.md.
- **D003** — 2026-07-09 — `data/` book = real companies with real recent trackable events; only CRM history is fabricated. Frozen after 11:00.
- **D004** — 2026-07-09 — Pivot rule: if competitor-activity signals are weak by 10:30, trigger becomes champion job change. Architecture unchanged.
- **D005** — 2026-07-09 — Similarity = Claude-judged with cited reasons, precomputed for the whole book, cached in `data/similarity.json`. Rejected: embeddings.
- **D006** — 2026-07-09 — 2D canvas force layout, clustered-grid fallback. Rejected: Three.js.
- **D007** — 2026-07-09 — `DEMO_MODE=live|replay` with auto-recording of live calls to fixtures.

## External services

| Service | Purpose | Env vars |
|---|---|---|
| Anthropic API | All four agents | `ANTHROPIC_API_KEY` |
| Sillage MCP | Signals, power map, slot management | `SILLAGE_MCP_URL`, `SILLAGE_API_KEY` |
| FullEnrich MCP | Waterfall contact verification | `FULLENRICH_MCP_URL`, `FULLENRICH_API_KEY` |

Keep `.env.example` in sync with every variable read. Never commit real keys.

## Hackathon engineering mode

- **Riskiest integration first**: the contagion loop end-to-end on real Sillage data, ugly, before any UI polish.
- **Vertical slice over completeness**: one scenario, flawless. Cut scope, never the demo path.
- Hardcoded fixture fallback for every external dependency: networks fail on stage.
- What never relaxes: typecheck passes, boundaries parse, no secrets or PII in code/logs, this file stays current when the plan changes.
