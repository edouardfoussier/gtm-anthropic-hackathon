// AutoDeck agentic layer — the exported contract.
//
// Two consumers import from here:
//   - the UI (Lane A) reads `AgentEvent`s to animate the graph
//   - the video pipeline (Lane B) reads `ProspectState` from data/prospects/{id}.json
//
// Boundary data that arrives from outside (Sillage, FullEnrich, Claude) is defined as a Zod
// schema and its type is inferred — so we parse before we trust. Types we construct ourselves
// (events, graph projection, state) are plain TS.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Boundary data — Zod-validated
// ---------------------------------------------------------------------------

export const SeveritySchema = z.enum(["hot", "warm", "cold"]);
export type Severity = z.infer<typeof SeveritySchema>;

/** An intent signal surfaced by Sillage. `personId` ties it to a person node; absent = company-level. */
export const SignalSchema = z.object({
  id: z.string(),
  kind: z.enum(["job_change", "hiring", "funding", "news", "tech_adopt", "engagement"]),
  title: z.string(), // human-readable, e.g. "VP Sales left for a competitor 12 days ago"
  detail: z.string().optional(),
  severity: SeveritySchema,
  source: z.string(), // e.g. "LinkedIn", "Crunchbase"
  url: z.string().optional(),
  ts: z.string(), // ISO
  personId: z.string().optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

/** Contact coordinates from FullEnrich. */
export const ContactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  title: z.string().optional(),
  confidence: z.number().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const EnrichmentStatusSchema = z.enum(["pending", "enriching", "done", "failed"]);
export type EnrichmentStatus = z.infer<typeof EnrichmentStatusSchema>;

/** A person surfaced by Sillage, enriched over the run. */
export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  company: z.string(),
  seniority: z.number().optional(), // 0..1, higher = more senior; used for deterministic ranking
  signals: z.array(SignalSchema).default([]),
  contact: ContactSchema.optional(),
  enrichment: EnrichmentStatusSchema.default("pending"),
});
export type Person = z.infer<typeof PersonSchema>;

/** Claude's structured pick — validated before we act on it. */
export const PickSchema = z.object({
  selectedPersonId: z.string(),
  reason: z.string(),
  angle: z.string(),
});
export type Pick = z.infer<typeof PickSchema>;

// ---------------------------------------------------------------------------
// Graph projection — what the UI renders (data-only, per AGENTS.md D001)
// ---------------------------------------------------------------------------

export type NodeStatus = "default" | "hot" | "selected" | "enriched";

export interface GraphNode {
  id: string;
  type: "company" | "person";
  label: string;
  sublabel?: string;
  status: NodeStatus;
  meta?: Record<string, unknown>;
}

export interface GraphLink {
  id: string;
  source: string; // node id
  target: string; // node id
  kind?: "works_at";
}

// ---------------------------------------------------------------------------
// Durable per-prospect state — the pipeline contract (data/prospects/{id}.json)
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "done" | "error";

export interface ProspectState {
  id: string;
  company: string;
  createdAt: string; // ISO
  status: RunStatus;
  people: Person[];
  nodes: GraphNode[];
  links: GraphLink[];
  selectedContactId?: string;
  angle?: string;
  reason?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Event stream — the UI contract (append-only decision log too)
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "run_started"; ts: string; prospectId: string; company: string }
  | { type: "node_added"; ts: string; node: GraphNode }
  | { type: "link_added"; ts: string; link: GraphLink }
  | { type: "signal_detected"; ts: string; nodeId: string; signal: Signal } // hot → UI paints red
  | { type: "contact_selected"; ts: string; nodeId: string; reason: string }
  | { type: "angle_written"; ts: string; angle: string }
  | { type: "contact_enriching"; ts: string; nodeId: string }
  | { type: "contact_enriched"; ts: string; nodeId: string; contact: Contact }
  | { type: "run_completed"; ts: string; prospect: ProspectState }
  | { type: "error"; ts: string; stage: string; message: string };

export type AgentEventType = AgentEvent["type"];
