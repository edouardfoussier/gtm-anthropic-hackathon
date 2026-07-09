// Data-only contract for the graph (D001): nothing outside components/graph/
// imports Three.js types — the renderer stays swappable.

export type PersonStatus = "pending" | "active" | "picked" | "enriched" | "dim";

/** 1 = most senior (biggest node) … 4 = junior (smallest). */
export type Seniority = 1 | 2 | 3 | 4;

/** One person at the target company — rendered as a particle mini-sphere. */
export interface PersonNode {
  id: string;
  name: string;
  title: string;
  status: PersonStatus;
  /** Drives node size (role seniority). */
  seniority: Seniority;
  /** Org link: id of the manager. Absent = root, placed at the center. */
  reportsTo?: string;
  /** Shown under the title once known (e.g. enriched email · phone). */
  sublabel?: string;
}

export interface PeopleGraphProps {
  /** People found at the company — the whole map derives from this. */
  people?: PersonNode[];
  className?: string;
  /** Fired when a person's label is clicked — opens their contact detail. */
  onPersonClick?: (id: string) => void;
}
