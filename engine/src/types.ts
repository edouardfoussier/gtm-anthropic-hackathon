/**
 * Shared domain types + zod schemas. A jury member is the "prospect" (the video
 * pitches AutoDeck to them, personalized to their own company); the seller is us.
 * The deck is always exactly four beats in this fixed order.
 */
import { z } from "zod";

export const JuryMemberSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  companyDomain: z.string().optional(),
});
export type JuryMember = z.infer<typeof JuryMemberSchema>;

/** The four fixed slide beats, in render order. */
export const SLIDE_KINDS = ["intro", "problem", "solution", "cta"] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

export const SlideSchema = z.object({
  kind: z.enum(SLIDE_KINDS),
  /** Big on-slide title, ≤ ~7 words. */
  headline: z.string(),
  /** One supporting line under the headline, ≤ ~16 words. */
  subtext: z.string(),
  /** Spoken voiceover for this slide, ≤ 2 sentences, first-person seller voice. */
  voiceover: z.string(),
});
export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z.object({
  /** One-paragraph rationale — why this angle for this company (internal). */
  angle: z.string(),
  slides: z.array(SlideSchema).length(SLIDE_KINDS.length),
});
export type Deck = z.infer<typeof DeckSchema>;

export interface PipelineResult {
  id: string;
  juryMember: JuryMember;
  deck: Deck;
  mp4: string;
  poster: string;
  gif: string;
  durationSeconds: number;
  voDurations: number[];
  avatarUsed: boolean;
  ttsUsed: boolean;
  llmUsed: boolean;
}
