// Staged mock of the judged demo path (v0): signals stream in → org mapped
// person by person → Claude picks the best contact → FullEnrich enriches.
// The page replays these frames on timers to mimic progressive adapter
// returns (D014). When the real adapters land, the live flow drives the same
// prop shapes and this stays a UI fixture / stage fallback.
import type { PersonNode, PersonStatus } from "./types";

export interface DemoFrame {
  /** ms to wait after the previous frame before applying this one */
  delay: number;
  /** activity-feed line shown when the frame lands */
  log: string;
  /** full people state at this frame (replaces previous) */
  people?: PersonNode[];
}

type PersonSeed = Omit<PersonNode, "status" | "sublabel">;

// 7-person org: CEO center → CRO / VP Marketing / Talent Lead;
// under the CRO → Head of Revenue / Sales Ops / SDR Lead.
// Discovery order = array order (CEO first, the org grows outward).
const PEOPLE: PersonSeed[] = [
  { id: "p-ceo", name: "Élodie Marchand", title: "CEO", seniority: 1 },
  { id: "p-cro", name: "Marc Delacroix", title: "CRO", seniority: 2, reportsTo: "p-ceo" },
  { id: "p-vpm", name: "Camille Rousseau", title: "VP Marketing", seniority: 2, reportsTo: "p-ceo" },
  { id: "p-talent", name: "Antoine Bernard", title: "Talent Lead", seniority: 3, reportsTo: "p-ceo" },
  { id: "p-rev", name: "Claire Fontaine", title: "Head of Revenue", seniority: 3, reportsTo: "p-cro" },
  { id: "p-ops", name: "Sofia Reyes", title: "Sales Ops Manager", seniority: 3, reportsTo: "p-cro" },
  { id: "p-sdr", name: "Théo Lambert", title: "SDR Lead", seniority: 4, reportsTo: "p-cro" },
];

const PICKED_ID = "p-cro";

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
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, "") || "prospect";
  const email = `m.delacroix@${domain}.com`;

  const foundFrames: DemoFrame[] = PEOPLE.map((seed, i) => ({
    delay: i === 0 ? 750 : 380,
    log: `Sillage · found ${seed.name} — ${seed.title}`,
    people: cast(i + 1, () => "active"),
  }));

  return [
    {
      delay: 350,
      log: `Sillage · tracking ${company}`,
    },
    {
      delay: 950,
      log: "Sillage · signal — VP Sales departed 12 days ago",
    },
    {
      delay: 850,
      log: "Sillage · signal — 3 SDR job openings posted this week",
    },
    {
      delay: 850,
      log: "Sillage · signal — Series D announced (€120M)",
    },
    ...foundFrames,
    {
      delay: 1600,
      log: "Claude · picked Marc Delacroix (CRO) — angle: rebuild the SDR engine post-Series D",
      people: cast(PEOPLE.length, (s) =>
        s.id === PICKED_ID ? "picked" : "dim",
      ),
    },
    {
      delay: 1500,
      log: "FullEnrich · email + mobile verified ✓",
      people: cast(
        PEOPLE.length,
        (s) => (s.id === PICKED_ID ? "enriched" : "dim"),
        (s) => (s.id === PICKED_ID ? email : undefined),
      ),
    },
  ];
}
