/**
 * Deck writer. Turns a jury member into the four-beat, personalized AutoDeck
 * pitch (intro → problem → solution → CTA) using Claude via the AI SDK with a
 * structured schema. Falls back to a deterministic mock when no key is present,
 * and always reconciles the model output back to the fixed beat order so the
 * downstream video stages get exactly four slides in the right sequence.
 */
import "./env.js";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { DeckSchema, SLIDE_KINDS } from "./types.js";
import type { Deck, JuryMember, Slide, SlideKind } from "./types.js";

const MODEL = process.env.AUTODECK_MODEL?.trim() || "claude-sonnet-5";

const SYSTEM = `You are the founder of AutoDeck pitching to a hackathon jury member.

AutoDeck is a GTM autopilot: an intent signal (a champion changes jobs, a company
starts hiring SDRs) triggers a fully personalized *video* pitch deck that lands in
the prospect's inbox — Claude writes the story, the deck is built and narrated in
the seller's own cloned voice by a lip-synced avatar, and the seller gets a live
"your prospect is watching" ping the moment it's opened. A personalized video pitch
takes an SDR 45+ minutes; AutoDeck does it in ~3, hands-free, at signal-time.

This is meta: the video you are scripting IS an AutoDeck video, addressed to this
specific jury member, personalized to THEIR company. Speak in first person as the
founder — warm, sharp, confident, never salesy-cheesy.

This is a follow-up after meeting the jury member at the hackathon. The intro voiceover
should open warmly by referencing that, e.g. "Hi {firstName} — it was great to meet you at
GTM-Hack at Station F on July 9th! As promised, here's a quick demo of what we built at the
hackathon, made just for {company}." Adapt the exact wording, keep it natural.

Write exactly four slides in this order:
  1. intro    — greet {firstName} by name, reference meeting at GTM-Hack (Station F, July 9th),
                and frame this as the promised demo of what you built, personalized for {company}.
  2. problem  — GTM teams burn huge time on manual personalized outreach; make it feel
                real for a company like {company} / a role like {title}.
  3. solution — AutoDeck is the fix: signal → personalized video pitch in minutes, hands-free.
  4. cta      — invite {firstName} to talk / get AutoDeck for {company}.

Constraints:
- headline: punchy, ≤ 7 words, title-case-ish, no trailing period.
- subtext: one supporting line, ≤ 16 words.
- voiceover: what the avatar SAYS for this slide — natural spoken English, ≤ 2 sentences.
  The four voiceovers must read as one continuous 25-40s narration.
- Do NOT invent specific private facts about the company you cannot know. Stay credible.`;

function userPrompt(j: JuryMember): string {
  return [
    `Jury member: ${j.firstName} ${j.lastName}`,
    j.title ? `Title: ${j.title}` : null,
    `Company: ${j.company}`,
    j.companyDomain ? `Company domain: ${j.companyDomain}` : null,
    ``,
    `Write the four-slide AutoDeck video pitch personalized to ${j.firstName} at ${j.company}.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Deterministic, presentable copy — used with no key and to fill any missing beat. */
function mockSlide(kind: SlideKind, j: JuryMember): Slide {
  const who = j.firstName;
  const co = j.company;
  switch (kind) {
    case "intro":
      return {
        kind,
        headline: `${who}, this one's for ${co}`,
        subtext: `A 30-second pitch that built itself — for you.`,
        voiceover: `Hi ${who} — this is a quick, personalized pitch for ${co}. And here's the twist: I didn't make it by hand.`,
      };
    case "problem":
      return {
        kind,
        headline: "Personalized outreach doesn't scale",
        subtext: `Your team burns 45+ minutes building a single tailored video pitch.`,
        voiceover: `Right now, a great personalized video takes a rep the better part of an hour — so it almost never happens. The moment a buyer is hot, you're too slow.`,
      };
    case "solution":
      return {
        kind,
        headline: "Meet AutoDeck — GTM on autopilot",
        subtext: `Signal to personalized video pitch in ~3 minutes, hands-free.`,
        voiceover: `AutoDeck watches for the signal, writes the story, and ships a personalized video in my own voice — in about three minutes, hands-free. This whole video is AutoDeck, running.`,
      };
    case "cta":
      return {
        kind,
        headline: `Want this for ${co}?`,
        subtext: `Tap "be called back" and let's talk.`,
        voiceover: `If you want this running for ${co}, just tap below and I'll call you back. Thanks for watching, ${who}.`,
      };
  }
}

function mockDeck(j: JuryMember): Deck {
  return {
    angle: `Meta pitch to ${j.firstName} at ${j.company}: the video demonstrates AutoDeck by being an AutoDeck video.`,
    slides: SLIDE_KINDS.map((k) => mockSlide(k, j)),
  };
}

/** Force the model output back into the canonical four-beat order, filling gaps. */
function reconcile(deck: Deck, j: JuryMember): Deck {
  const byKind = new Map<SlideKind, Slide>();
  for (const s of deck.slides) if (!byKind.has(s.kind)) byKind.set(s.kind, s);
  const slides = SLIDE_KINDS.map((k) => byKind.get(k) ?? mockSlide(k, j));
  return { angle: deck.angle, slides };
}

export async function generateDeck(
  jury: JuryMember,
): Promise<{ deck: Deck; llmUsed: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { deck: mockDeck(jury), llmUsed: false };

  const anthropic = createAnthropic({ apiKey: key });
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: DeckSchema,
    system: SYSTEM,
    prompt: userPrompt(jury),
  });
  return { deck: reconcile(object, jury), llmUsed: true };
}
