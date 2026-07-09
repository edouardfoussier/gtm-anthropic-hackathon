> ⚠️ **HISTORICAL BRIEF — superseded by `AGENTS.md` wherever they differ.** Known deltas: graph is **vanilla Three.js** (not react-flow); FullEnrich is **v2** (§5's v1 URL is dead); Sillage is **MCP or V2 API**; the §7 reuse paths are **unavailable** (pipeline rebuilt in `engine/`); colors are **not locked**. Read `AGENTS.md` first.

# AutoDeck — One-Shot Build Brief

> **Agentic GTM Hackathon** · Station F, Paris · **TODAY, one day**: build 9:30 → submission 17:30 → pitch 18:00.
> Mandatory stack: **Claude (Anthropic) + Sillage + FullEnrich**. Bonus prizes: **Best Use of Gamma ($1000)**, **Best Use of Gradium ($500)**, Most Creative GTM Angle, Crowd Favorite (loudest demo, DB-meter).
> This brief is written for a coding agent to one-shot. Read it fully before writing code. **Mocks-first policy** (§8) — the app must demo end-to-end even if a partner API misbehaves.

## 1. The product (one line)

**AutoDeck** — the GTM agent that turns an intent signal into a **personalized video pitch deck in the prospect's inbox**: Sillage finds the moment and the person, FullEnrich finds the coordinates, Claude writes the story, **Gamma builds the deck**, **Gradium speaks it in the seller's cloned voice**, a lip-synced avatar presents it, and the seller gets a **live "your prospect is watching" notification** the second it's opened.

**The framing that wins "Most Creative GTM Angle": AutoDeck is not a deck generator — it's an *autopilot*.** A champion changes jobs (Sillage signal) → 20 minutes later there's a personalized video deck for their new company in their inbox. Sales reps don't make videos; the pipeline makes itself. Include an **"Autopilot" toggle** in the UI that watches signals and auto-runs the whole chain.

**ROI line for the jury:** a personalized video pitch takes an SDR 45+ minutes (research, deck, record, edit, send). AutoDeck: **~3 minutes, hands-free, at signal-time** — when buying intent is hottest.

## 2. The judged demo (build FOR this exact script)

1. On stage: type a **jury member's company** into AutoDeck.
2. **Live**: Sillage agent surfaces intent signals + best contact → FullEnrich enriches (email/phone/LinkedIn) → nodes pop onto the **contact graph** with a satisfying animation.
3. Show the **pre-generated** video deck for that company (generated during the afternoon — see §9 timing strategy): Gamma slides, presenter avatar bottom-right, cloned voice narration.
4. Click **Send** → real email lands in the jury member's inbox, live.
5. Jury member opens it, presses play → **the app fires a LOUD "cha-ching 🔔💰" + a toast: "🎬 {Name} is watching — 0:12 watched"**. (The cha-ching is deliberately loud — the Crowd Favorite prize is measured with a DB-meter. Make the sound satisfying and let it rip through the speakers.)
6. Flip the **Autopilot** toggle: show the signal feed auto-queueing the next 3 prospects with decks being generated. Close.

Every technical choice below serves this script.

## 3. Stack

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** — single app, light premium theme, ONE accent color (electric blue `#2563EB` or similar — NOT orange, that was our last product). Clean, salesy, confident.
- **Engine** = Node scripts inside the same repo (`engine/` dir) run via `npx tsx`, spawned by API routes (this is a local live demo — no serverless constraints). **ffmpeg + Playwright available locally.**
- **AI SDK (`ai` npm pkg) + `@ai-sdk/anthropic`** for all Claude calls (structured outputs via `Output.object`). Model: `claude-sonnet-5` (fast) unless noted.
- **react-flow** (`@xyflow/react`) for the contact graph.
- **Resend** for email. **SSE** (or simple polling) for live view-notifications.
- State: **in-memory + JSON files** in `data/` (no DB — one-day hack).

## 4. Architecture & flow

```
[Company input] → POST /api/prospect
   ├─ lib/sillage.ts    → signals + best contact          (Sillage API, mock fallback)
   ├─ lib/fullenrich.ts → email / phone / linkedin        (FullEnrich bulk API, mock fallback)
   └─ data/prospects/{id}.json  → graph nodes stream to UI

[Reach out] → POST /api/generate/{prospectId}   (long-running, streams progress steps via SSE)
   1. lib/research.ts   → Claude: company brief + angle from signals (web knowledge + Sillage data)
   2. lib/gamma.ts      → Gamma Generate API → deck → **export PNG** (one image per slide)
   3. lib/script.ts     → Claude: one short VO line per slide (personalized, ≤ 2 sentences each)
   4. engine/tts.ts     → Gradium TTS per line (cloned voice) → wav + durations (ffprobe)
   5. engine/assemble.ts→ slides→video: each slide dwells for its VO duration (+0.4s), subtle
                          Ken-Burns zoom, concat (ffmpeg concat FILTER, re-encode, yuv420p)
   6. engine/avatar.ts  → fal.ai talking-head from presenter photo + full VO track → PIP overlay
                          bottom-right (~20% width, rounded corners), keep original audio
   → public/videos/{id}.mp4 (+ poster jpg)

[Send] → POST /api/send/{prospectId}
   → Resend email: personal 3-line note (Claude) + video thumbnail image linking to /v/{id}
     (VIDEO AS LINK, never attachment — deliverability)

[Watch] → /v/{id} public share page (no auth): brand-clean player
   → on play + every 10s: POST /api/track {id, event, currentTime}  (hash IP, no raw PII)
   → dashboard listens via SSE → 🔔 LOUD cha-ching + toast "{Name} is watching — {mm:ss}"
```

## 5. Partner adapters — exact API facts (verified 2026-07-09)

- **Gamma** (`lib/gamma.ts`): `POST https://public-api.gamma.app/v1.0/generations` — **header `X-API-KEY`** (NOT Bearer). Body: `{ inputText, textMode, format: "presentation", numCards: 6-8, exportAs: "png", ... }` (themes/images/language params exist — read https://developers.gamma.app quickly). Then **poll** `GET /v1.0/generations/{generationId}` until done → `gammaUrl` + `exportUrl` (signed, expires ~1 week). One export format per call; PNG gives per-slide images = exactly what the video pipeline needs. **Also surface `gammaUrl` in the UI** ("open in Gamma") — visible Gamma love for the Gamma prize.
- **FullEnrich** (`lib/fullenrich.ts`): `POST https://app.fullenrich.com/api/v1/contact/enrich/bulk` — `Authorization: Bearer`. Input: `{ datas: [{ firstname, lastname, company_name (or domain), linkedin_url?, enrich_fields: [...] }] }`. It's a **waterfall** (email + phone) and likely **async** — check `docs.fullenrich.com` for the result webhook/polling shape day-of. Wrap as `enrichContact(person) → { email, phone, linkedin, title }`.
- **Sillage** (`lib/sillage.ts`): docs/keys handed at the hackathon (intent signals: job changes, champion tracking, competitor engagement, hiring intent). Wrap as `getSignals(company) → Signal[]` and `bestContact(company) → Person`. **Write the adapter against the mock first**; plug the real API the moment keys+docs land.
- **Gradium** (`engine/tts.ts`): `POST https://api.gradium.ai/api/post/speech/tts`, header `x-api-key`, body `{ text, voice_id, output_format: "wav", only_audio: true, model_name: "default" }`. Cloned voice id comes from env `GRADIUM_VOICE_ID`.
- **fal.ai** (`engine/avatar.ts`): use `@fal-ai/client` `fal.subscribe(MODEL, { input, logs })` with a talking-head model (see the working reference in §7 — copy its model choice). ~66s audio works in one call.
- **Anthropic**: AI SDK + `@ai-sdk/anthropic`, structured outputs for research/script. **Gotcha: do NOT route image content through the OpenRouter provider (broken serialization) — Anthropic-native only.**
- **Resend** (`lib/email.ts`): domain `diffender.studio` is on Cloudflare and can be verified in minutes (or use the Resend onboarding sender as fallback). Sender like `edouard@diffender.studio`.

## 6. UI (4 surfaces, shadcn, light, fast)

1. **`/` Command bar + contact graph** — big input "Target a company…", react-flow canvas: company node → signal nodes (badge per signal type) → contact node (avatar, title) → enrichment leaves (email ✓ phone ✓). Progress states animate in as each adapter returns. An **Autopilot toggle** top-right: when ON, a signal feed (right rail) auto-enqueues prospects and shows decks auto-generating.
2. **Prospect drawer** — signals list, the Claude "angle" paragraph, the generated deck (slide thumbnails + "open in Gamma" link), the video player, buttons: **Generate** → **Send**.
3. **`/v/[id]` share page** — public, clean, prospect-facing: "A message for {FirstName} @ {Company}", the video, sender signature. Fires tracking events.
4. **Dashboard notifications** — persistent toast stack + the **cha-ching sound** (ship a punchy `public/chaching.mp3`, played at volume 1.0) on `view` events, with live watch-time updating.

## 7. REUSE — working code to copy from (absolute paths, all proven in production last week)

From **Diffender** (`/Users/edouardfoussier/code/hackathons/raise-hack/drift/`):
- `mcp-server/src/gradium.ts` — the exact Gradium TTS client (port as-is; voice id via env).
- `mcp-server/src/fal.ts` + `mcp-server/src/cli-avatar.ts` — **working fal.ai talking-head + ffmpeg PIP overlay** (rounded corners, bottom-right, keeps original audio). Copy the model id + subscribe/poll/download pattern + the overlay filtergraph verbatim.
- `mcp-server/src/cli-submission.ts` + `mcp-server/src/cli-walktour.ts` — **audio-timed segment assembly**: per-segment TTS → ffprobe durations → each visual dwells for its narration → concat. Steal: the concat-FILTER approach (never the demuxer — inputs differ), `setsar=1` + `yuv420p` normalization per input, **the Ken-Burns `zoompan` gotcha** (pre-composite the still to ONE frame before zoompan or it renders d× frames per input), and **never use `-shortest`** when muxing VO (it truncates the outro).
- `mcp-server/src/compose.ts` — branded intro/outro card rendering (HTML→PNG via Playwright at exact video size). Reuse for a title card + CTA card around the slides.
- `cloudflare/src/worker.ts` — reference for view tracking with **salted-hash IPs** (privacy). For the hack, implement tracking as a simple Next API route + JSON log instead.
- `web/` — Next.js 16 + Tailwind v4 + shadcn patterns: wizard stepper (`web/components/generate/generate-wizard.tsx`), SSE-ish progress handling in `web/app/api/generate/route.ts` (spawns engine via `npx tsx`, streams logs), assets store.

Known env gotchas: run Playwright/ffmpeg scripts from the engine dir; `tsx -e` breaks on top-level await (use script files); Next only auto-loads `.env.local` (engine loads its own env file).

## 8. Mocks-first policy (non-negotiable)

Every adapter (`sillage.ts`, `fullenrich.ts`, `gamma.ts`) ships with a **realistic deterministic mock** behind the same interface, switched by env (`SILLAGE_API_KEY` absent → mock). Mock data must look REAL (real-sounding names, plausible signals like "VP Sales left for {Company} 12 days ago", "3 SDR job openings posted"). The demo can never die on stage because a partner API is down. When real keys land (kick-off, 9:00), flip envs one by one and verify.

For **Gamma fallback** (if API access is delayed): a local slide renderer — Claude writes slide JSON → HTML slides → Playwright screenshots. Same PNG output, pipeline unchanged. (Still push hard to use real Gamma — it's a $1000 prize.)

## 9. Timing strategy for the live pitch

- The full chain takes minutes (Gamma generation ~1-3 min, fal avatar ~2-5 min). **NEVER run the full chain live.**
- **Live on stage:** company input → Sillage/FullEnrich → graph (seconds, safe) → **Send** → jury opens → cha-ching. 
- **Pre-baked during the afternoon:** the generated deck + video for 2-3 jury/sponsor companies (find jury names in the event page/LinkedIn around 15:00).
- Record a **full-run screen capture** as the fallback video + for the viral X/LinkedIn posts (tag @Anthropic @Sillage @FullEnrich, `#agenticgtm` — two more prizes).

## 10. Env vars (`.env.local` — never commit)

```
ANTHROPIC_API_KEY=            # hackathon credits
SILLAGE_API_KEY=              # handed at kickoff
FULLENRICH_API_KEY=           # handed at kickoff
GAMMA_API_KEY=                # X-API-KEY header
GRADIUM_API_KEY=              # + GRADIUM_VOICE_ID=<cloned voice>
FAL_KEY=
RESEND_API_KEY=               # + EMAIL_FROM=edouard@diffender.studio
APP_URL=http://localhost:3000 # or the tunnel URL for the live email links
```
**Email links must be publicly reachable by the jury's phone** → either deploy the share page to Vercel early (share page is static+API-light, deployable) or run a tunnel (`cloudflared tunnel`/ngrok) to localhost. Decide by 15:00, test from a phone on 4G.

## 11. Build order (8h, 2 lanes if teammates)

| When | Lane A (app) | Lane B (pipeline) |
|---|---|---|
| 9:30–10:30 | Scaffold app + theme + graph UI w/ mocks | Port gradium.ts/fal.ts/assembly; chaching.mp3 |
| 10:30–12:30 | Real Sillage + FullEnrich adapters + drawer | Gamma adapter → PNG slides → assembled video E2E |
| 12:30–14:00 | Send (Resend) + share page + tracking + SSE toasts | Avatar PIP integrated; first full video |
| 14:00–15:30 | Autopilot toggle + polish + deploy/tunnel + phone test | Pre-generate jury-company videos |
| 15:30–17:30 | **Submission**, fallback recording, pitch rehearsal, viral posts | Buffer |

## 12. Definition of done

- [ ] Type a company → real Sillage signals + real FullEnrich contact on the graph
- [ ] One click → Gamma deck (PNG slides) → cloned-voice narrated video with avatar PIP
- [ ] Send → email arrives on a phone → tap → share page plays
- [ ] Dashboard cha-chings LOUDLY + shows live watch-time within 2s of play
- [ ] Autopilot toggle shows the agentic loop
- [ ] Fallback video recorded; posts drafted with sponsor tags
