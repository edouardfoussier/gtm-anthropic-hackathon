# AutoDeck

The GTM autopilot: an intent signal (Sillage) → the right person (Claude + FullEnrich) → a personalized video pitch deck (Gamma + Gradium cloned voice + avatar) → in the prospect's inbox → live "your prospect is watching" cha-ching.

Built in one day at the Agentic GTM Hackathon (Station F, Paris — 2026-07-09).

## Run

```bash
npm install
cp .env.example .env.local   # fill in keys — adapters fall back to mocks without them
npm run dev
```

**Read `AGENTS.md` before touching anything** — it is the single source of truth (architecture, lane contract, partner API facts, decision log).
