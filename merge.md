# Prompt: wire the real agentic pipeline into the staged run UI

> Hand this to the coding agent building the agentic layer. Read `AGENTS.md` first (single source of truth), then `GRAPH-GUIDE.md` (graph contract). Work from branch `fix-ui` (or `main` once it's merged).

## Context

The home page (`app/page.tsx`) plays a **staged prospect run**: signals log into the activity feed → the org constellation grows person by person on the Three.js graph → Claude picks ONE contact (orange ignition, others dim) → FullEnrich reveals the email. Today the whole run is produced synchronously by **`lib/demo-run.ts` → `buildDemoRun(companyName, realProspects)`**, which returns `{ prospect: Prospect, frames: DemoFrame[] }` — pure mock, deterministic.

Your job: make the **real agentic pipeline** (Sillage signals/people → Claude structured-output pick → FullEnrich enrichment, per AGENTS.md v0) produce those **exact same shapes**, streamed progressively, without touching the UI or the graph.

## The contract you must emit (do not change it)

- `DemoFrame` (`components/graph/demo-frames.ts`): `{ delay: ms, log: string, people?: PersonNode[] }` — each frame is a feed line + optionally a FULL people snapshot (the graph diffs internally).
- `PersonNode` (`components/graph/types.ts`): `{ id, name, title, status: "pending"|"active"|"picked"|"enriched"|"dim", seniority: 1-4, reportsTo?, sublabel? }`.
- `Prospect` (`lib/types.ts`): `{ id, companyName, signals, contacts, relationships }` — consumed by the queue/reachout routing; contact ids MUST equal PersonNode ids. Jury contacts carry `juryId` (routes clicks to `/reachout/[id]`).

## What to build

1. `lib/sillage.ts` — `getSignals(company)`, `getPeople(company)`; MCP or V2 API per AGENTS.md, **mock fallback when env keys absent** (reuse `lib/demo-run.ts` data as the mock). Time-box every call; on failure → mock.
2. `lib/orchestrator.ts` — ONE Claude structured-output call (AI SDK, `claude-sonnet-5`, Zod-parsed): rank people, pick the best contact, write the outreach angle. Output feeds the "Claude · picked …" frame log + `picked`/`dim` statuses.
3. `lib/fullenrich.ts` — v2 bulk enrich + poll (see AGENTS.md adapter facts), mock fallback → the `enriched` frame with `sublabel: email`.
4. Wire into the page with **the same progressive rhythm**: emit frames as each adapter returns (SSE or client-side orchestration — your call), so the graph animates identically. `buildDemoRun` stays as the stage fallback — env-switched, never deleted.

## Do NOT

- Touch `components/graph/**` (nodes, transitions, shaders — locked, see GRAPH-GUIDE.md) or the frame timings/feel of the run.
- Break the jury bridge: contacts matched from `/api/prospects` keep `juryId` → "click → `/reachout/[id]`".
- Skip Zod at the boundary, log secrets, or commit `.env.local` (AGENTS.md never-relax rules).

## Verify

`npx tsc --noEmit && npm run lint && npm run build && npx tsx scripts/smoke.ts` all green; with no env keys the app behaves EXACTLY as today (mock run); with keys set, the same story plays with real data. Commit early and often; every commit runnable.
