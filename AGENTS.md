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

| Layer           | Choice                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App             | Next.js **16.2.10** (App Router) + React 19.2 + TypeScript strict + Tailwind **v4**                                                                                                        |
| UI components   | shadcn/ui initialized (base-nova preset, **Base UI — not Radix**) — **PROVISIONAL, not locked**: component-layer deep research pending; don't build deep dependencies on its internals yet |
| Design          | **LOCKED:** editorial, minimalist, startup-inspired (Linear/Stripe/Figma); the **Three.js node graph is the visual centerpiece** of the product. Colors: **LOCKED (D015)** — off-white bg `#F7F7F5`, near-black text `#111111`, ONE accent orange `#FF6500` used sparingly. Supersedes D011's "to define". |
| Graph           | **Vanilla Three.js** mounted in a React component, behind a **data-only props interface** (`nodes`, `links`, statuses) — renderer stays swappable if 3D melts down. Restyled as a dot-particle sphere (D015): builds up point-by-point as nodes resolve, permanent slow rotational drift, orange dots. |
| LLM             | AI SDK (`ai` + `@ai-sdk/anthropic`), model `claude-sonnet-5`, structured outputs (`Output.object`)                                                                                         |
| Sillage         | **MCP client OR V2 API** — whichever access lands first at kickoff; adapter interface is the invariant                                                                                     |
| FullEnrich      | REST **v2** (Bearer)                                                                                                                                                                       |
| Package manager | **npm** — do not switch                                                                                                                                                                    |
| State           | In-memory + JSON files in `data/` — no DB                                                                                                                                                  |
| Email           | Resend (video as **link, never attachment**)                                                                                                                                               |
| Live notify     | SSE (or simple polling)                                                                                                                                                                    |
| Video tooling   | ffmpeg + Playwright, local, run from `engine/`                                                                                                                                             |

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
   ├─ lib/sillage.ts     → getSignals(company), getPeople(company)   (Sillage MCP/API, mock fallback)
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
lib/            # adapters (sillage, fullenrich, gamma, email) + claude steps (orchestrator, research, script) + utils.ts (shadcn cn)
engine/         # EDOUARD'S LANE — standalone tsx scripts: tts.ts, assemble.ts, avatar.ts
data/           # prospects/{id}.json · slides/{id}/*.png  ← the lane contract (gitignored, .gitkeep'd)
public/videos/  # {id}.mp4 + {id}.jpg  ← engine output (gitignored)
scripts/        # smoke.ts and other throwaway runners
```



### Team lanes & the contract between them

- **Lane A — Mathis + Tom:** app, graph UI, adapters, orchestrator, send/share/tracking, Autopilot.
- **Lane B — Edouard:** everything in `engine/` (rebuilt from scratch — the old Diffender code is not in this repo). Merges to `main` continuously.
- **File-based contract (do not break it):** engine reads `data/prospects/{id}.json` + `data/slides/{id}/*.png`, writes `public/videos/{id}.mp4` + `public/videos/{id}.jpg`. Each side can build and test against fixture files without the other.



## Partner adapters — exact facts (verified 2026-07-09)

- **Sillage** (`lib/sillage.ts`): **MCP or V2 API — both are valid; use whichever access lands first at kickoff.** No public docs (verified: docs are participant-gated; MCP docs + V2 API key link handed at kickoff; workspace at hackathon.getsillage.com, ≤20 tracked accounts, login with registered email; API key via app settings). The invariant is the adapter interface: `getSignals(company) → Signal[]`, `getPeople(company) → Person[]` — transport (MCP client via AI SDK `experimental_createMCPClient`, or REST) is an implementation detail behind it. **Write against the mock first.** In v2, if on MCP, hand the tools to Claude directly.
- **FullEnrich** (`lib/fullenrich.ts`): **v2 API** — docs: [https://docs.fullenrich.com](https://docs.fullenrich.com) (index: `/llms.txt`). `POST https://app.fullenrich.com/api/v2/contact/enrich/bulk`, `Authorization: Bearer`. Async waterfall → poll `GET /api/v2/contact/enrich/bulk` (skip webhooks). Key from [https://app.fullenrich.com/app/api](https://app.fullenrich.com/app/api). Also: `POST /api/v2/people/search` + `/api/v2/company/search` for v1 prospecting. The brief's v1 URL is outdated — use v2.
- **Gamma** (`lib/gamma.ts`): `POST https://public-api.gamma.app/v1.0/generations` — header `X-API-KEY` (NOT Bearer). Body: `{ inputText, textMode, format: "presentation", numCards: 6-8, exportAs: "png" }`. Poll `GET /v1.0/generations/{id}` until done → `gammaUrl` + `exportUrl` (signed, ~1 week). **Surface** `gammaUrl` **in the UI** ("open in Gamma") — visible Gamma love for the prize. Docs: [https://developers.gamma.app](https://developers.gamma.app)
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

- Commit **early and often to** `main`; every commit runnable so we can roll back live. No PR ceremony, no branch policing.
- No unit-test suite. **One smoke script (**`scripts/smoke.ts`**) exercising the demo path** — re-run after every change, and every new demo step adds its check there. A broken demo found at minute 5 is fixable; at minute 55 it is not.
- Comments/polish/refactors only on the demo path. Cut scope, not the demo path.

**Tooling gotchas (hard-won — violating these costs an hour each):**

- Next.js 16 differs from training data — **read** `node_modules/next/dist/docs/` **before writing framework code**.
- shadcn CLI changed: `npx shadcn@latest init -y -d` (base-nova preset), `npx shadcn@latest add <component>` — old flags like `--base-color` are gone.
- ffmpeg concat **FILTER**, never the demuxer (inputs differ); normalize each input with `setsar=1` + `yuv420p`.
- Ken-Burns `zoompan`: **pre-composite the still to ONE frame first**, or it renders d× frames per input.
- **Never** `-shortest` when muxing VO — it truncates the outro.
- `tsx -e` breaks on top-level await → use script files.
- Next.js only auto-loads `.env.local` → engine scripts load their own env; run Playwright/ffmpeg from the engine dir.
- `create-next-app` writes its own `AGENTS.md` — it clobbered this file once already (restored). Careful when hoisting scaffolds.



## Timing strategy

- **Live on stage:** input → graph → Send → cha-ching (seconds, safe). Full chain: never live.
- **~15:00:** find jury/sponsor company names → pre-generate their decks + videos.
- **Deploy: Vercel (locked, D014).** The app (share page `/v/{id}` + tracking API) deploys to Vercel early. Constraint: **video generation stays LOCAL** — ffmpeg/Playwright/engine scripts don't run on Vercel — so pre-baked videos must reach the deployed app (commit + deploy, or Vercel Blob) before the demo. **Test email links from a phone on 4G by 15:00.**
- Record a **full-run screen capture**: fallback video + material for the X/LinkedIn posts (tag @Anthropic @Sillage @FullEnrich, `#agenticgtm` — two more prizes).



## Env vars (`.env.local` — never commit)

See `.env.example` (committed, kept in sync — it is the authoritative list):
`ANTHROPIC_API_KEY` · `SILLAGE_MCP_URL` / `SILLAGE_API_KEY` (either enables the real adapter) · `FULLENRICH_API_KEY` · `GAMMA_API_KEY` · `GRADIUM_API_KEY` + `GRADIUM_VOICE_ID` · `FAL_KEY` · `RESEND_API_KEY` + `EMAIL_FROM` · `APP_URL`

## Build order (2 lanes, steps in strict order — riskiest integration first)


| Step | Lane A — Mathis + Tom (app)                                                 | Lane B — Edouard (engine/)                                                |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | ~~Scaffold app + theme~~ ✅ + Three.js graph w/ mocks                        | Gradium TTS client + chaching.mp3 + assemble.ts skeleton (fixture slides) |
| 2    | Real Sillage + FullEnrich v2 adapters + orchestrator (Claude pick) + drawer | Gamma adapter → PNG slides → assembled video E2E                          |
| 3    | Send (Resend) + share page + tracking + SSE cha-ching                       | Avatar PIP integrated; first full video                                   |
| 4    | Autopilot toggle + v1 prompt input + Vercel deploy + phone test             | Pre-generate jury-company videos                                          |
| 5    | **Submission**, fallback recording, pitch rehearsal, viral posts            | Buffer                                                                    |


(Deadlines live in "The event" and "Timing strategy" — steps here carry no clock.)

## Definition of done

- [ ] Type a company → real Sillage signals + Claude-picked contact + real FullEnrich enrichment on the 3D graph
- [ ] One click → Gamma deck (PNG slides) → cloned-voice narrated video with avatar PIP
- [ ] Send → email arrives on a phone → tap → share page plays
- [ ] Dashboard cha-chings LOUDLY + live watch-time within 2s of play
- [ ] Autopilot toggle shows the agentic loop
- [ ] v1: prompt input proposes companies · v2: orchestrator upgraded to agentic tool-use loop
- [ ] Fallback video recorded; posts drafted with sponsor tags



## Open vs locked — quick glance

**Deliberately open (decide later, never hardcode in the meantime):**

- UI component layer (D010) — shadcn provisional, keep usage shallow
- Graph layout algorithm (radial vs force-directed vs hybrid) — Lane A prototypes, then logs the pick
- Avatar model + narration voice — **Edouard's call** (D013)
- Email sender address / domain — must be decided **before the 15:00 phone deliverability test** (D013)
- Demo assets: presenter photo, chaching.mp3 — open (D013)

**Confirmed working rules (D014):**

- Graph animates **progressively** — nodes land as each adapter returns; slow enrichment never blocks the moment.
- Target/jury companies are added to the Sillage workspace **at kickoff** (≤20 accounts) so signals have time to populate.
- App deploys on **Vercel**; video generation stays local (see Timing strategy).

**Locked (D015):**

- Colors / palette — off-white `#F7F7F5` bg, near-black `#111111` text, orange `#FF6500` accent (editorial, not electric blue).

## Decision log (append-only, newest last)

- **D001** — 2026-07-09 — Graph is vanilla Three.js in a React component behind a data-only interface. Rejected: react-flow (brief §3) — team wants the 3D wow; the interface keeps a 2D fallback cheap.
- **D002** — 2026-07-09 — Orchestrator staged: v0 hybrid (deterministic adapters + one Claude structured pick) → v2 agentic tool-use loop after v0 works. Rejected: agent-loop-first (too slow to debug on demo day).
- **D003** — 2026-07-09 — Sillage via MCP client (no public REST API exists); FullEnrich via REST v2 with polling. Supersedes brief §5's Sillage-API + FullEnrich-v1 assumptions.
- **D004** — 2026-07-09 — Input staging: v0 company name (judged path), v1 sector/prompt → proposed companies as second milestone.
- **D005** — 2026-07-09 — Full video scope: Gamma + Gradium voice + fal.ai avatar PIP. Rejected: voice-only (loses wow + weakens Gradium prize story).
- **D006** — 2026-07-09 — Video pipeline rebuilt from scratch in `engine/` (Diffender reuse code unavailable in this repo); its gotchas kept as rules above.
- **D007** — 2026-07-09 — npm; in-memory + JSON state; no DB, no test suite — one smoke script for the demo path.
- **D008** — 2026-07-09 — Scaffold live at repo root: create-next-app (Next 16.2.10, React 19.2.4, Tailwind v4, ESLint 9, `--app --no-src-dir`, alias `@/`*) + shadcn/ui init (`-d`, base-nova) + deps `three ai @ai-sdk/anthropic zod resend @fal-ai/client` (+ dev: `@types/three tsx`). Lane folders + `.gitkeep`s created; `data/*` and `public/videos/*` gitignored; `.env.example` committed; `scripts/smoke.ts` seeded. Typecheck + build + smoke all pass.
- **D009** — 2026-07-09 — Sillage transport: **MCP or V2 API, both valid** — use whichever access lands first at kickoff; the `getSignals`/`getPeople` adapter interface is the invariant, transport hidden behind it. Env: `SILLAGE_MCP_URL` or `SILLAGE_API_KEY` enables the real adapter (absent → mock). Docs are participant-gated (nothing public — verified 2026-07-09). Partially supersedes D003 (which locked MCP-only).
- **D010** — 2026-07-09 — UI component layer **NOT locked**: shadcn/ui is initialized (base-nova preset, Base UI under the hood — not Radix) and usable, but the choice is provisional pending a component-layer deep research. Until then: add components only via `npx shadcn@latest add`, keep usage shallow (no reliance on internals), so swapping stays cheap. `shadcn` CLI moved to devDependencies.
- **D011** — 2026-07-09 — Colors **unlocked, to define** during theme work. Supersedes the brief §3 mandate — that reasoning was Diffender-specific. The "ONE accent color" principle stays.
- **D012** — 2026-07-09 — Design **locked as design, not colors**: light/premium/salesy style + the Three.js node graph as the visual centerpiece (with D001). Only the palette stays open (D011).
- **D013** — 2026-07-09 — Delegated/open by team choice: fal.ai avatar model + narration voice are **Edouard's call** (Lane B); email sender domain and demo assets (presenter photo, chaching.mp3) stay **open** — sender must be settled before the phone deliverability test. Graph layout algorithm also open (Lane A prototypes first). `AUTODECK-BRIEF.md` got a superseded-banner so no agent follows its outdated instructions.
- **D014** — 2026-07-09 — **Vercel deploy locked** for the app (share page + tracking); video generation stays local (ffmpeg/Playwright can't run there) — pre-baked videos reach production via commit+deploy or Vercel Blob. Confirmed working rules: progressive graph animation (nodes land per adapter); Sillage workspace gets the target/jury companies at kickoff. Supersedes the tunnel-vs-Vercel day-of decision.
- **D015** — 2026-07-09 — Tom (UI lane): closes D011 — accent color is **orange `#FF6500`**, not electric blue. Editorial/risograph design system (off-white `#F7F7F5` bg, near-black `#111111` text, condensed ALL-CAPS display headings, numbered sections `01`/`02`, no shadows/gradients/glassmorphism). Supersedes the brief's §3 blue-accent note. Rejected: blue accent (brief default) — team wants a distinct editorial identity, not a generic SaaS blue. Contact-graph surface (D001) stays vanilla Three.js but restyled as a dot-particle sphere: builds up point-by-point as nodes resolve, permanent slow rotational drift, orange dots on off-white/near-black.
