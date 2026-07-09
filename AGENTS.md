<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AutoDeck — Agent Guide

**AutoDeck** turns an intent signal into a **personalized video pitch deck in the prospect's inbox**: Sillage finds the moment and the person, FullEnrich finds the coordinates, Claude picks the target and writes the story, Gamma builds the deck, Gradium speaks it in the seller's cloned voice, an avatar presents it, and the seller gets a live "your prospect is watching" cha-ching the second it's opened. It's not a deck generator — it's an **autopilot**: pipeline that makes itself.

This file is the **single source of truth** for working in this repo today. It is normative (new work follows it, never imitates code that violates it) and living (learned something durable? update this file in the same change). Companion doc: `AUTODECK-BRIEF.md` (full brief); where they disagree, **this file wins**.

**Updating this file is append-only for choices.** Every product, architecture, or tooling decision gets a new numbered entry appended to the Decision log (newest last) — never rewrite or delete an old entry; supersede it ("Supersedes D00X"). Reference sections (stack table, folder tree, adapter facts, gotchas) are updated in place to stay true, and the decision that changed them gets logged.

## The event (context every agent needs)

Agentic GTM Hackathon, Station F — **build 9:30 → submission 17:30 → pitch 18:00, TODAY (2026-07-09)**.

- **Mandatory in the pipeline: Anthropic + Sillage + FullEnrich** — submission rule AND a 25-pt judging criterion. Mocks are stage insurance, not the plan.
- Judging: 4 × 25 pts — business impact · depth of Anthropic use · depth of Sillage/FullEnrich use · presentation.
- Bonus prizes we chase: **Best Use of Gamma ($1000)**, **Best Use of Gradium ($500)**, Most Creative GTM Angle, Crowd Favorite (loudest demo — DB-meter, hence the LOUD cha-ching).
- Submission: 2-min demo video + GitHub repo + short description. Pitch rounds are 1:30 pitch + 1:30 demo.

## The judged demo script — every technical choice serves this

1. On stage: type a **jury member's company** into AutoDeck.
2. **Live**: Sillage signals + people → Claude picks the best contact → FullEnrich enriches → nodes pop onto the **3D contact graph** with a satisfying animation.
3. Show the **pre-generated** video deck for that company: Gamma slides, avatar bottom-right, cloned-voice narration.
4. Click **Send** → real email lands in the jury member's inbox, live.
5. They open it, press play → **LOUD cha-ching 🔔💰 + toast "🎬 {Name} is watching — 0:12 watched"**.
6. Flip **Autopilot**: signal feed auto-queues the next 3 prospects with decks generating. Close.

**Never run the full generation chain live** (Gamma ~1-3 min, avatar ~2-5 min). Live = input → graph → send → cha-ching. Videos are pre-baked in the afternoon.

## Product staging — build in this order, each stage demoable

- **v0 (JUDGED PATH):** company-name input → Sillage signals + people → **one Claude structured-output call** ranks people, picks the best contact, writes the outreach angle → FullEnrich enriches the pick → graph animates. Deterministic, debuggable, fast.
- **v1:** the input field also accepts a free prompt ("fintechs in Paris hiring SDRs") → Claude + FullEnrich Search (`people/search`, `company/search`) propose companies → user picks → v0 flow.
- **v2 (only after v0 is solid E2E):** upgrade the orchestrator to a real **agentic tool-use loop** — Claude gets Sillage MCP tools + FullEnrich as tools and decides what to fetch and who to target. This is the "depth of AI use" points.
- **Autopilot toggle:** signal feed auto-enqueues prospects and shows decks auto-generating.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js **16.2.10** (App Router) + React 19.2 + TypeScript strict + Tailwind **v4** + shadcn/ui (base-nova preset) |
| Theme | Light, premium, salesy. ONE accent: electric blue `#2563EB`. **NOT orange.** |
| Graph | **Vanilla Three.js** mounted in a React component, behind a **data-only props interface** (`nodes`, `links`, statuses) — renderer stays swappable if 3D melts down |
| LLM | AI SDK **v7** (`ai` + `@ai-sdk/anthropic`), model `claude-sonnet-5`, structured output via `generateText({ output: Output.object })` |
| Sillage | **MCP client** via `@ai-sdk/mcp` (`createMCPClient`, native `{type:'http'}` transport) — **not in `ai@7`**, install when access lands; no public REST API |
| FullEnrich | REST **v2** (Bearer) |
| Package manager | **npm** — do not switch |
| State | In-memory + JSON files in `data/` — no DB |
| Email | Resend (video as **link, never attachment**) |
| Live notify | SSE (or simple polling) |
| Video tooling | ffmpeg + Playwright, local, run from `engine/` |

## Commands

```bash
npm install
npm run dev                 # app on :3000
npx tsc --noEmit            # typecheck — must pass before every commit
npm run lint                # eslint 9 flat config
npm run build               # production build
npx tsx engine/<script>.ts  # run a pipeline script standalone
npx tsx scripts/smoke.ts    # THE demo-path smoke run — re-run after every change
npx shadcn@latest add <component>   # add shadcn/ui components
```

## Architecture

```
[Company name OR sector prompt] → POST /api/prospect
   ├─ lib/sillage.ts     → getSignals(company), getPeople(company)   (Sillage MCP, mock fallback)
   ├─ lib/orchestrator.ts→ Claude: rank people, pick best contact, write angle (structured output)
   ├─ lib/fullenrich.ts  → enrichContact(person) → {email, phone, linkedin, title}  (v2 API, mock fallback)
   └─ data/prospects/{id}.json → graph nodes stream to UI

[Generate] → POST /api/generate/{prospectId}   (long-running, streams progress via SSE)
   1. lib/research.ts  → Claude: company brief + angle from signals
   2. lib/gamma.ts     → Gamma Generate API → deck → export PNG per slide → data/slides/{id}/
   3. lib/script.ts    → Claude: one short VO line per slide (≤ 2 sentences, personalized)
   4. engine/tts.ts    → Gradium TTS per line (cloned voice) → wav + durations (ffprobe)
   5. engine/assemble.ts → slides→video: dwell = VO duration +0.4s, Ken-Burns, concat
   6. engine/avatar.ts → fal.ai talking-head from presenter photo + VO → PIP bottom-right
   → public/videos/{id}.mp4 (+ poster.jpg)

[Send] → POST /api/send/{prospectId} → Resend: 3-line personal note (Claude) + thumbnail → /v/{id}

[Watch] → /v/{id} public share page → on play + every 10s: POST /api/track (hash IP, no raw PII)
   → dashboard SSE → 🔔 LOUD cha-ching + toast "{Name} is watching — {mm:ss}"
```

```
app/            # routes + API — thin wiring only; long jobs spawn engine scripts via npx tsx
components/     # UI; components/graph/ = Three.js scene behind data-only props; components/ui/ = shadcn
agentic/        # THE AGENT LAYER (decoupled, pure TS, NO next/*): sillage + fullenrich adapters, orchestrator (runProspect), Claude pick, mocks, store (memory), types (event/state contract). Entry + smoke: agentic/run.ts. See D009.
lib/            # shadcn utils.ts (cn) + app-side helpers (gamma, email, research, script). Agent orchestration lives in agentic/ (D009)
engine/         # EDOUARD'S LANE — standalone tsx scripts: tts.ts, assemble.ts, avatar.ts
data/           # prospects/{id}.json (+ {id}.events.jsonl log) · seen.json · slides/{id}/*.png  ← the lane contract (gitignored, .gitkeep'd)
public/videos/  # {id}.mp4 + {id}.jpg  ← engine output (gitignored)
scripts/        # smoke.ts and other throwaway runners
```

### Team lanes & the contract between them

- **Lane A — Mathis + Tom:** app, graph UI, adapters, orchestrator, send/share/tracking, Autopilot.
- **Lane B — Edouard:** everything in `engine/` (rebuilt from scratch — the old Diffender code is not in this repo). Merges to `main` continuously.
- **File-based contract (do not break it):** engine reads `data/prospects/{id}.json` + `data/slides/{id}/*.png`, writes `public/videos/{id}.mp4` + `public/videos/{id}.jpg`. Each side can build and test against fixture files without the other.

## Partner adapters — exact facts (verified 2026-07-09)

- **Sillage** (`agentic/sillage.ts`): **MCP only.** Server URL + auth handed at kickoff (login with the registered email; workspace at hackathon.getsillage.com, ≤20 tracked accounts). MCP client is in **`@ai-sdk/mcp`** (NOT `ai@7`) — install it and use the native `{ type:'http', url, headers }` transport; wrap tools as `getSignals(company) → Signal[]` and `getPeople(company) → Person[]`, Zod-parsed at the boundary. **Written against the mock first** (real branch is a marked TODO that falls back to mock); plug the real MCP the moment access lands. In v2, hand the MCP tools to Claude directly.
- **FullEnrich** (`lib/fullenrich.ts`): **v2 API** — docs: https://docs.fullenrich.com (index: `/llms.txt`). `POST https://app.fullenrich.com/api/v2/contact/enrich/bulk`, `Authorization: Bearer`. Async waterfall → poll `GET /api/v2/contact/enrich/bulk` (skip webhooks). Key from https://app.fullenrich.com/app/api. Also: `POST /api/v2/people/search` + `/api/v2/company/search` for v1 prospecting. The brief's v1 URL is outdated — use v2.
- **Gamma** (`lib/gamma.ts`): `POST https://public-api.gamma.app/v1.0/generations` — header **`X-API-KEY`** (NOT Bearer). Body: `{ inputText, textMode, format: "presentation", numCards: 6-8, exportAs: "png" }`. Poll `GET /v1.0/generations/{id}` until done → `gammaUrl` + `exportUrl` (signed, ~1 week). **Surface `gammaUrl` in the UI** ("open in Gamma") — visible Gamma love for the prize. Docs: https://developers.gamma.app
- **Gradium** (`engine/tts.ts`): `POST https://api.gradium.ai/api/post/speech/tts`, header `x-api-key`, body `{ text, voice_id, output_format: "wav", only_audio: true, model_name: "default" }`. Voice id from `GRADIUM_VOICE_ID` (cloned voice).
- **fal.ai** (`engine/avatar.ts`): `@fal-ai/client`, `fal.subscribe(MODEL, { input, logs })` with a talking-head model; ~66s audio works in one call.
- **Anthropic**: AI SDK + `@ai-sdk/anthropic` only. **Never route image content through OpenRouter — broken serialization. Anthropic-native only.**
- **Resend** (`lib/email.ts`): sender domain via env; onboarding sender as fallback. Video always a **link** to `/v/{id}` — deliverability.

## Mocks-first policy (non-negotiable)

Every adapter (`sillage.ts`, `fullenrich.ts`, `gamma.ts`) ships a **realistic deterministic mock** behind the same interface, switched by env (key/URL absent → mock). Mock data must look REAL ("VP Sales left for {Company} 12 days ago", "3 SDR job openings posted"). The demo can never die on stage because a partner API is down. When real access lands, flip envs one by one and verify.

**Gamma fallback** (if API access is delayed): Claude writes slide JSON → HTML slides → Playwright screenshots. Same PNG output, pipeline unchanged. (Still push hard for real Gamma — $1000 prize.)

## Quality rules — hackathon mode

**Never relaxes:**

- `npx tsc --noEmit` passes before every commit. No `any` / `as any` — type errors cost more than they save under pressure.
- **Parse every LLM and external response with Zod at the boundary** before acting on it. A demo that crashes on a malformed response is a failed demo.
- Secrets only in `.env.local` (never committed, never `NEXT_PUBLIC_*`, never logged). Keep `.env.example` in sync.
- Time-box every external call; on timeout/failure, fall back to the mock — never hang the UI.
- Grep before building (`rg`) — has this already been built? SDK quickstarts exist; use them.
- Track hashed IPs only on `/api/track` — no raw PII in logs.

**Relaxed today:**

- Commit **early and often to `main`**; every commit runnable so we can roll back live. No PR ceremony, no branch policing.
- No unit-test suite. **One smoke script (`scripts/smoke.ts`) exercising the demo path** — re-run after every change, and every new demo step adds its check there. A broken demo found at minute 5 is fixable; at minute 55 it is not.
- Comments/polish/refactors only on the demo path. Cut scope, not the demo path.

**Tooling gotchas (hard-won — violating these costs an hour each):**

- Next.js 16 differs from training data — **read `node_modules/next/dist/docs/` before writing framework code** (see block at top).
- shadcn CLI changed: `npx shadcn@latest init -y -d` (base-nova preset), `npx shadcn@latest add <component>` — old flags like `--base-color` are gone.
- ffmpeg concat **FILTER**, never the demuxer (inputs differ); normalize each input with `setsar=1` + `yuv420p`.
- Ken-Burns `zoompan`: **pre-composite the still to ONE frame first**, or it renders d× frames per input.
- **Never `-shortest`** when muxing VO — it truncates the outro.
- `tsx -e` breaks on top-level await → use script files.
- Next.js only auto-loads `.env.local` → engine scripts load their own env; run Playwright/ffmpeg from the engine dir.
- `create-next-app` writes its own `AGENTS.md` — it clobbered this file once already (restored). Careful when hoisting scaffolds.

## Timing strategy

- **Live on stage:** input → graph → Send → cha-ching (seconds, safe). Full chain: never live.
- **~15:00:** find jury/sponsor company names → pre-generate their decks + videos.
- **By 15:00:** email links must be reachable from the jury's phone → deploy share page to Vercel OR run a tunnel (`cloudflared`/ngrok). **Test from a phone on 4G.**
- Record a **full-run screen capture**: fallback video + material for the X/LinkedIn posts (tag @Anthropic @Sillage @FullEnrich, `#agenticgtm` — two more prizes).

## Env vars (`.env.local` — never commit)

See `.env.example` (committed, kept in sync — it is the authoritative list):
`ANTHROPIC_API_KEY` · `SILLAGE_MCP_URL` · `FULLENRICH_API_KEY` · `GAMMA_API_KEY` · `GRADIUM_API_KEY` + `GRADIUM_VOICE_ID` · `FAL_KEY` · `RESEND_API_KEY` + `EMAIL_FROM` · `APP_URL`

## Build order (8h, 2 lanes)

| When | Lane A — Mathis + Tom (app) | Lane B — Edouard (engine/) |
|---|---|---|
| 9:30–10:30 | Scaffold app + theme + Three.js graph w/ mocks | Gradium TTS client + chaching.mp3 + assemble.ts skeleton (fixture slides) |
| 10:30–12:30 | Real Sillage MCP + FullEnrich v2 adapters + orchestrator (Claude pick) + drawer | Gamma adapter → PNG slides → assembled video E2E |
| 12:30–14:00 | Send (Resend) + share page + tracking + SSE cha-ching | Avatar PIP integrated; first full video |
| 14:00–15:30 | Autopilot toggle + v1 prompt input + deploy/tunnel + phone test | Pre-generate jury-company videos |
| 15:30–17:30 | **Submission**, fallback recording, pitch rehearsal, viral posts | Buffer |

## Definition of done

- [ ] Type a company → real Sillage signals + Claude-picked contact + real FullEnrich enrichment on the 3D graph
- [ ] One click → Gamma deck (PNG slides) → cloned-voice narrated video with avatar PIP
- [ ] Send → email arrives on a phone → tap → share page plays
- [ ] Dashboard cha-chings LOUDLY + live watch-time within 2s of play
- [ ] Autopilot toggle shows the agentic loop
- [ ] v1: prompt input proposes companies · v2: orchestrator upgraded to agentic tool-use loop
- [ ] Fallback video recorded; posts drafted with sponsor tags

## Decision log (append-only, newest last)

- **D001** — 2026-07-09 — Graph is vanilla Three.js in a React component behind a data-only interface. Rejected: react-flow (brief §3) — team wants the 3D wow; the interface keeps a 2D fallback cheap.
- **D002** — 2026-07-09 — Orchestrator staged: v0 hybrid (deterministic adapters + one Claude structured pick) → v2 agentic tool-use loop after v0 works. Rejected: agent-loop-first (too slow to debug on demo day).
- **D003** — 2026-07-09 — Sillage via MCP client (no public REST API exists); FullEnrich via REST v2 with polling. Supersedes brief §5's Sillage-API + FullEnrich-v1 assumptions.
- **D004** — 2026-07-09 — Input staging: v0 company name (judged path), v1 sector/prompt → proposed companies as second milestone.
- **D005** — 2026-07-09 — Full video scope: Gamma + Gradium voice + fal.ai avatar PIP. Rejected: voice-only (loses wow + weakens Gradium prize story).
- **D006** — 2026-07-09 — Video pipeline rebuilt from scratch in `engine/` (Diffender reuse code unavailable in this repo); its gotchas kept as rules above.
- **D007** — 2026-07-09 — npm; in-memory + JSON state; no DB, no test suite — one smoke script for the demo path.
- **D008** — 2026-07-09 — Scaffold live at repo root: create-next-app (Next 16.2.10, React 19.2.4, Tailwind v4, ESLint 9, `--app --no-src-dir`, alias `@/*`) + shadcn/ui init (`-d`, base-nova) + deps `three ai @ai-sdk/anthropic zod resend @fal-ai/client` (+ dev: `@types/three tsx`). Lane folders + `.gitkeep`s created; `data/*` and `public/videos/*` gitignored; `.env.example` committed; `scripts/smoke.ts` seeded. Typecheck + build + smoke all pass.
- **D009** — 2026-07-09 — Agent orchestration built as a decoupled, pure-TypeScript module in `agentic/` (no `next/*` imports), not scattered across `lib/`. Core = `runProspect(input, {onEvent, signal})`: transport-agnostic, emits a typed `AgentEvent` stream (UI seam) and persists `ProspectState` to `data/prospects/{id}.json` (pipeline seam). `agentic/run.ts` is the standalone entry + agent-layer smoke check (runs the full flow on mocks, asserts the event sequence + written state). Rationale: build/test independently now; a one-file SSE route and the video pipeline both plug into the two seams later. Supersedes the lib/-scattered adapter layout for sillage/fullenrich/orchestrator (folder tree updated in place).
- **D010** — 2026-07-09 — Flow is **Sillage-first** (confirms the AGENTS.md architecture over the alternative "Sillage-last detection" order): Sillage supplies people + signals → one Claude structured pick (`generateText({ output: Output.object })`) ranks/picks/writes the angle → FullEnrich enriches the pick. A `hot` signal on a person emits `signal_detected` → UI paints that node red. Every step degrades to a deterministic fallback (no `ANTHROPIC_API_KEY` → scored pick; adapter failure/timeout → mock), so the run never hangs or throws. MVP = single run per company; Autopilot is a later wrapper over `runProspect`.
- **D011** — 2026-07-09 — SDK reality corrections (refines D003 + stack table): the AI SDK **MCP client is not in `ai@7`** — it moved to `@ai-sdk/mcp` (install when Sillage access lands; native `{type:'http'}` transport avoids a direct `@modelcontextprotocol/sdk` dep). Structured output = `generateText({ output: Output.object({ schema }) })` (`experimental_output` and `generateObject` are out on v7). Zod is **v4**. Memory persisted three ways (all three consumers confirmed): `data/prospects/{id}.json` (state), `{id}.events.jsonl` (append-only decision log), `data/seen.json` (global seen-companies cache).
