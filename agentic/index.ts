// Public surface of the agentic layer. The app (UI) and the pipeline import from here.
//
//   import { runProspect, loadProspect } from "@/agentic";
//   import type { AgentEvent, ProspectState, GraphNode, GraphLink } from "@/agentic";

export { runProspect } from "./orchestrator";
export type { RunInput, RunOptions } from "./orchestrator";
export { loadProspect, getSeen, slugify } from "./store";
export type { SeenEntry } from "./store";

export type {
  AgentEvent,
  AgentEventType,
  ProspectState,
  RunStatus,
  Person,
  Signal,
  Severity,
  Contact,
  Pick,
  GraphNode,
  GraphLink,
  NodeStatus,
  EnrichmentStatus,
} from "./types";
