// Data-only contract for the graph (D001): nothing outside components/graph/
// imports Three.js types — the renderer stays swappable.

export type PersonStatus = "pending" | "active" | "picked" | "enriched" | "dim";

/** One person at the target company — rendered as a satellite particle mini-sphere. */
export interface PersonNode {
  id: string;
  name: string;
  title: string;
  status: PersonStatus;
  /** Shown under the title once known (e.g. enriched email · phone). */
  sublabel?: string;
}

export interface DotSphereNode {
  id: string;
  /** 0..1 — reveal progress; nodes below this in build order stay hidden. */
  revealed: boolean;
}

export interface DotSphereProps {
  /** Total number of dots on the company sphere shell. */
  nodeCount?: number;
  /** Legacy reveal driver — which dots (by build order) are revealed. */
  nodes?: DotSphereNode[];
  /** Preferred reveal driver: how many ambient dots are lit (signals streaming in). */
  revealCount?: number;
  /** People found at the company — each becomes a linked satellite cluster. */
  people?: PersonNode[];
  /** Label shown under the company sphere while a prospect run is active. */
  companyLabel?: string;
  radius?: number;
  className?: string;
}
