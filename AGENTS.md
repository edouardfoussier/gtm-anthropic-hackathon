# <Project Name> — Agent Guide

<!-- ─────────────────────────────────────────────────────────────────────
HOW TO USE THIS TEMPLATE (delete this comment block once filled in)

1. Replace every <angle-bracket> placeholder. Delete sections that truly
   don't apply — but keep the principles; they are stack-agnostic.
2. Create a one-line `CLAUDE.md` next to this file containing exactly:
       @AGENTS.md
   Claude Code auto-loads CLAUDE.md; Codex and Cursor read AGENTS.md
   directly. AGENTS.md is the single source of truth — never let them drift.
3. For a hackathon: fill "Project context" with the track statement and
   demo scenario, keep the "Hackathon mode" section at the bottom.
   For a long-lived project: delete "Hackathon mode".
──────────────────────────────────────────────────────────────────────── -->

<One paragraph: what this project is, who it serves, and the single outcome
that matters. E.g. "Agent that fuses live translated status calls with a
persistent task ledger so a site office always knows what is blocked.">

This file is the single source of truth for working in this repo. Read it before starting any task. It is:

- **Normative** — the current implementation may not satisfy every rule yet; new work must move the codebase *toward* these practices, never imitate existing code that violates them.
- **Living** — when you learn something durable (architecture decision, constraint, incident, convention), update this file **in the same change**. Do not use hidden memory as a substitute for updating this file.

## Project context

<What the product does, end to end. Domain vocabulary the code must align
with. The core flow as a short diagram or numbered list. For a hackathon:
paste the track statement verbatim here, then state your chosen scenario,
which capability is load-bearing (the thing the demo cannot work without),
and the judging criteria you are optimizing for.>

```
<core flow, e.g.:>
<Input (voice / event / user action)>
  └── <processing step — which API/primitive, what it produces>
        └── <state held where, keyed by what>
              └── <output surfaced to whom, how>
```

## Stack

| Layer | Choice |
|---|---|
| Language(s) | <TypeScript 5.x strict / Python 3.12+ typed> |
| Framework | <Next.js App Router / FastAPI / ...> |
| Package manager | <npm / pnpm / uv> — do not switch without approval |
| Data / state | <Postgres + Prisma / SQLite / in-memory store behind an interface> |
| LLM / external APIs | <provider + model, links to docs> |
| Validation | <Zod / Pydantic> — all external input parsed at the boundary |
| Tests | <Vitest / pytest> |
| Lint / format / types | <ESLint + Prettier + tsc / Ruff + Pyright> |

## Commands

```bash
<install>            # e.g. pnpm install / uv sync
<dev>                # run the app locally
<test>               # full test suite
<test-focused>       # single file / keyword filter
<typecheck>          # tsc --noEmit / pyright
<lint>               # check-only
<build>              # production build
```

## Architecture

```
<project structure tree, 2 levels deep, one comment per folder, e.g.:>
src/
  app/          # thin routes / entry points — wiring only, no business logic
  core/         # pure domain logic — no IO, no framework, no model calls
  services/     # business logic + transaction boundaries, typed inputs/outputs
  adapters/     # external systems (APIs, DB, storage) behind interfaces
  components/   # UI, private feature folders behind a public barrel
```

Non-negotiable structural rules:

- **Dependencies point inward only.** Entry points call services; services call the domain core and adapters. If you feel the need to put an HTTP concern in a service, business logic in a route, or an external SDK call in the pure core — **stop and rethink the layer** before writing code.
- **Monolith tripwire:** a module past ~300–400 lines, or a function juggling unrelated concerns, gets split into a focused sibling module — not another method.
- **Raise domain-specific errors in the core; translate them to HTTP status / CLI exit / UI state exactly once** at the transport boundary. Never scatter status handling through business logic.
- **Time-box every external call** (LLM, API, DB, storage). One slow dependency must not be able to hang a request. Never hold a transaction, session, or lock open across an external call.
- **Make impossible states impossible.** Model state machines as discriminated unions plus a legal-transition map, not loose booleans. Stable IDs over list positions.
- **Parse external input at the boundary.** URL params, env vars, uploaded files, LLM output, webhook payloads — validate into typed domain values before they reach logic.
- **Don't scaffold.** Create only folders and abstractions with real code behind them. No speculative seams, empty directories, or pre-built flexibility the flow doesn't need yet.

## Take a step back before writing code

Before implementing, answer:

1. **Has this already been built?** Grep first (`rg`). Duplication is the most common agent failure.
2. **Does this file already encode the answer?** Re-read the relevant section.
3. **Is this the right layer for the change?**
4. **Will this create or extend a monolith?** If a module is near the tripwire, split first.
5. **Is the test value real?** A unit test that mocks everything it touches is noise.

When in doubt, ask — a 20-second clarification beats a 2-hour wrong implementation. Challenge before you build: restate the goal in one line, flag risky or underspecified assumptions, propose the alternative with its tradeoff. Once the user decides, disagree and commit.

## Quality rules

These override personal style and anything the existing code happens to do.

### Typing

- No `any` / `as any`, anywhere — including ORM writes. Fix types properly: narrow, add a type guard, add a generic parameter, or update the interface.
- No double casts (`value as unknown as T`) and no non-null assertions to silence uncertainty — fix the upstream type or model the empty/loading/error state explicitly.
- Annotate generic type parameters explicitly when constructing from external data (`new Set<string>(data)`).
- Python: full type hints on every function, modern syntax (`list[str]`, `X | None`), no `Any`, avoid `cast()` and bare `type: ignore`.

### Code shape

- Guard clauses first; max ~3 levels of nesting. One responsibility per function.
- Named constants for thresholds, batch sizes, retries — no magic numbers.
- Descriptive names over abbreviations; prefer a self-explanatory name over a comment.
- **Comments capture business decisions only** — a product constraint, an external-system requirement, a deliberate deviation from the obvious approach. Never narrate what the code does, and no "added for task X" trailers.
- **Helper migration discipline:** when introducing a helper, grep for every inline duplicate of the logic it replaces and migrate them all in the same PR. A helper that coexists with the raw pattern it abstracts is worse than no helper.
- **Remove dead code.** If you migrate all call sites, delete the old function — no deprecated wrappers, shims, or `// removed` comments. Grep to confirm zero callers before committing.

### Security

- Secrets live in env vars / secret manager only. Server-side keys never reach the client (never `NEXT_PUBLIC_*` or equivalent), never get committed, never appear in logs or error messages.
- Never log secrets, tokens, auth headers, PII, raw user content, or full prompts.
- Auth fails closed in production. A secret URL is not auth.
- Validate all external input with schemas; parse and validate LLM output before acting on it. LLM output is a draft until confirmed — **no uncontrolled AI writes** to external systems.
- Do not weaken auth, scopes, tests, or safety checks to make CI pass.

### Logging

- Structured events with stable `snake_case` names. Emit a start event and a completion event carrying identifiers and `duration_ms`, so a hung step is visible as a start without its matching completion.
- Aggregate counts instead of logging per-row/per-frame inside loops.

## Testing

Every non-trivial change ships with meaningful tests. A change without them is incomplete. Never weaken or delete a test to make it pass.

**Think before writing a test.** For the unit under change, answer: (1) what is its contract? (2) what are the edge cases — empty, single, duplicate, `None`/zero/negative, unicode, stale state, races? (3) what are the failure modes — timeout, constraint violation, malformed input? (4) what invariant must always hold? (5) what would catch the bug a future refactor introduces? If you cannot answer these, you do not understand the code well enough to change it.

- Coverage is by **value, not percentage**. High-value paths get a happy path + one test per edge case + one per failure mode; thin passthroughs get none.
- **Mutation-test mindset:** if flipping `>` to `>=` or deleting a guard clause would still pass the suite, the tests are weak.
- Arrange / Act / Assert with blank lines between phases. Name tests after **behavior**, not the function. One behavior per test — if the name needs an "and", split it.
- **Mock at the boundary only** (external APIs, LLM calls, time, network) — never the unit under test or internal helpers. Assert observable outcomes (returned values, state, status codes), not internal calls.
- LLM evals are a separate, explicitly-marked tier (slow, costs credits) — excluded from the default test run.
- Test-data scripts and throwaway verification code are means-to-verify, **not part of the change** — do not commit them.

### Validation gate — run before any handoff

```bash
<typecheck>
<lint>          # check-only; never auto-fix or reformat as part of a commit
<test>
<build>
```

If a command cannot be run, say why and state the residual risk. **Do not assume previous results are still valid** — every change can regress something, so re-run after every change, even "trivial" ones.

## Git workflow

- One dedicated branch per feature/fix: `<type>/<slug>` (e.g. `feat/live-translate-channel`). No `wip`, `patch-1`, or tool-generated names. One branch, one concern, one PR — no stacked PRs unless explicitly requested.
- **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`), scoped when a scope is clear, imperative mood, body when there's meaningful context or tradeoffs. All repo artifacts (comments, commits, PR text) in **English**, regardless of the conversation language.
- **No `Co-Authored-By` or tool-attribution lines** in commits, PR bodies, or squash descriptions. Commit messages describe the change, not the tooling. Strip accidental trailers before push.
- **Stop before commit.** Implement, validate, then stop and report: summary, changed files, validation results, residual risks, open questions. Commit and open the PR only after explicit approval.
- **Never merge a PR yourself.** Merging is a human-only action, no matter how green CI is.
- **No force pushes, no destructive git operations.** `push --force` (even `--force-with-lease`), `reset --hard`, `clean -f`, `rebase` on pushed branches, deleting branches with unmerged work, or anything that rewrites shared history requires explicit approval first.
- PR title: `<type>: <summary>`. PR body: exactly `## Context`, `## Implementation`, `## Checks / QA`. The QA section lists only commands actually run and concrete reviewer verification steps with expected outcomes — and states explicitly what was **not** tested.
- UI-affecting changes: include before/after screenshots in the PR body. No screenshots, no PR.

## Agent rules

- Read the affected files before editing them. Keep changes small and verifiable.
- Implement only the requested scope. New dependencies require explicit approval.
- Ask before consequential product, architecture, security, or workflow assumptions — use direct questions, don't guess.
- **Do not trust internal knowledge for fast-moving libraries** (LLM SDKs, agent frameworks, new APIs). Read the installed package docs, `node_modules/<pkg>/docs/`, or the official reference before writing integration code.
- Do not kill or restart the owner's running dev servers or long-lived processes without asking.
- **No destructive commands without explicit approval:** `rm -rf`, dropping or truncating database tables, deleting cloud resources, overwriting files you did not create, bulk renames/moves. Before deleting or overwriting anything, look at the target — if it doesn't match what you expected, stop and surface it.
- Protected paths: <list any read-only, source-of-truth directories — e.g. golden datasets, generated clients, vendored docs>. Never modify them without explicit approval; never hand-edit generated files — regenerate them.
- When adding a hard-won rule to this file, state the one-line **Why** first, then the normative rule. Example: *"Incident: schema drift broke batch inserts because production missed a check constraint. Rule: schema changes must ship with a migration and a health-check path."*

## Decision log

Record durable decisions here, numbered, newest last. Later entries may supersede earlier ones (say so: "Supersedes D00X"). Decisions are challengeable before implementation — settled after.

- **D001** — <date> — <decision, one line of why, rejected alternative>.

## External services

| Service | Purpose | Env vars |
|---|---|---|
| <LLM provider> | <what it's used for> | `<API_KEY_NAME>` |
| <storage / DB> | <...> | `<...>` |

Keep a committed `.env.example` in sync with every variable the app reads. Never commit `.env.local` or real keys.

---

## Hackathon mode

<!-- Keep this section for hackathons/demos; delete it for long-lived projects. -->

Time-boxed build (~<X> hours). The demo path **is** the product. Rules above still apply unless explicitly relaxed here.

**What changes:**

- **Build the riskiest integration first.** Prove the load-bearing capability (the one the demo cannot work without) end-to-end within the first hours, ugly. Everything else layers on top of a working spine.
- **Vertical slice over horizontal completeness.** One scenario, demoed flawlessly, beats five half-working features. Cut scope, not the demo path.
- Stop-before-commit relaxes to: commit early and often to `main` or short-lived branches; keep every commit runnable so you can roll back live.
- Testing focuses on the demo path: one smoke test / script that exercises the full flow beats a unit-test suite. Re-run it after every change — a broken demo found at minute 5 is fixable; at minute 55 it is not.
- A hardcoded fallback for every external dependency in the demo (canned API response, recorded audio, seeded state) — networks fail on stage.

**What never relaxes:**

- No secrets in client code or committed files.
- Typecheck must pass — type errors cost more time than they save under pressure.
- Parse LLM/external output before acting on it — a demo that crashes on a malformed response is a failed demo.
- The step-back checklist — especially "has this already been built?" (SDK quickstarts and official examples exist; use them).
- Update this file when the plan changes, so every teammate's agent stays aligned.

**Demo checklist (fill in during the event):**

- [ ] Load-bearing capability proven end-to-end
- [ ] Second capability fires *because* the first is running (not bolted on)
- [ ] Full demo run-through from a clean state, twice
- [ ] Fallbacks tested (kill the network, replay the canned path)
- [ ] Pitch states the one thing the task can't work without
