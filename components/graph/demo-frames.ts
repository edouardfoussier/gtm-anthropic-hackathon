// Staged mock of the judged demo path (v0): signals stream in → people found →
// Claude picks the best contact → FullEnrich enriches. The page replays these
// frames on timers to mimic progressive adapter returns (D014). When the real
// adapters land, the live flow drives the same prop shapes and this stays a
// UI fixture / stage fallback.
import type { PersonNode, PersonStatus } from "./types";

export interface DemoFrame {
  /** ms to wait after the previous frame before applying this one */
  delay: number;
  /** activity-feed line shown when the frame lands */
  log: string;
  /** ambient dots lit on the company sphere (signals streaming in) */
  reveal?: number;
  /** full people state at this frame (replaces previous) */
  people?: PersonNode[];
}

/** Ambient dots lit at the start of a run, before any signal lands. */
export const RUN_START_REVEAL = 240;

interface PersonSeed {
  id: string;
  name: string;
  title: string;
}

const PEOPLE: PersonSeed[] = [
  { id: "p-claire", name: "Claire Fontaine", title: "Head of Revenue" },
  { id: "p-marc", name: "Marc Delacroix", title: "CRO" },
  { id: "p-sofia", name: "Sofia Reyes", title: "Sales Ops Manager" },
  { id: "p-antoine", name: "Antoine Bernard", title: "Talent Lead" },
];

const PICKED_ID = "p-marc";

function cast(
  count: number,
  statusFor: (seed: PersonSeed) => PersonStatus,
  sublabelFor?: (seed: PersonSeed) => string | undefined,
): PersonNode[] {
  return PEOPLE.slice(0, count).map((seed) => ({
    ...seed,
    status: statusFor(seed),
    sublabel: sublabelFor?.(seed),
  }));
}

export function buildDemoFrames(company: string): DemoFrame[] {
  const domain =
    company.toLowerCase().replace(/[^a-z0-9]/g, "") || "prospect";
  const email = `m.delacroix@${domain}.com`;

  return [
    {
      delay: 350,
      log: `Sillage · tracking ${company}`,
      reveal: 320,
    },
    {
      delay: 950,
      log: "Sillage · signal — VP Sales departed 12 days ago",
      reveal: 480,
    },
    {
      delay: 850,
      log: "Sillage · signal — 3 SDR job openings posted this week",
      reveal: 640,
    },
    {
      delay: 850,
      log: "Sillage · signal — Series D announced (€120M)",
      reveal: 800,
    },
    {
      delay: 750,
      log: "Sillage · found Claire Fontaine — Head of Revenue",
      people: cast(1, () => "active"),
    },
    {
      delay: 420,
      log: "Sillage · found Marc Delacroix — CRO",
      people: cast(2, () => "active"),
    },
    {
      delay: 420,
      log: "Sillage · found Sofia Reyes — Sales Ops Manager",
      people: cast(3, () => "active"),
    },
    {
      delay: 420,
      log: "Sillage · found Antoine Bernard — Talent Lead",
      people: cast(4, () => "active"),
      reveal: 900,
    },
    {
      delay: 1600,
      log: "Claude · picked Marc Delacroix (CRO) — angle: rebuild the SDR engine post-Series D",
      people: cast(4, (s) => (s.id === PICKED_ID ? "picked" : "dim")),
    },
    {
      delay: 1500,
      log: "FullEnrich · email + mobile verified ✓",
      people: cast(
        4,
        (s) => (s.id === PICKED_ID ? "enriched" : "dim"),
        (s) => (s.id === PICKED_ID ? email : undefined),
      ),
    },
  ];
}
