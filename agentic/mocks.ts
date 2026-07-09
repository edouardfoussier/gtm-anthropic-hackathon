// Realistic, deterministic mock data (AGENTS.md: mocks must look REAL). Same input → same
// output, so demo runs are reproducible. Curated sets for a few well-known companies; a
// deterministic generator for everything else. `mockDataset` is pure and side-effect free —
// both Sillage adapter functions call it, so their person ids always line up.

import { slugify } from "./store";
import type { Person, Signal } from "./types";

export interface MockDataset {
  people: Person[];
  signals: Signal[];
}

// A fixed clock for mock timestamps so runs are byte-reproducible (real signals carry real ts).
const MOCK_NOW = "2026-07-09T08:30:00.000Z";
function daysAgo(n: number): string {
  return new Date(Date.parse(MOCK_NOW) - n * 86_400_000).toISOString();
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// Curated demo companies
// ---------------------------------------------------------------------------

const CURATED: Record<string, (company: string, slug: string) => MockDataset> = {
  ramp: (company, slug) => ({
    people: [
      { id: `${slug}-p1`, name: "Sarah Chen", title: "VP of Sales", company, seniority: 0.9, signals: [], enrichment: "pending" },
      { id: `${slug}-p2`, name: "Marcus Webb", title: "Head of Revenue Operations", company, seniority: 0.75, signals: [], enrichment: "pending" },
      { id: `${slug}-p3`, name: "Priya Nair", title: "Director of Sales Development", company, seniority: 0.6, signals: [], enrichment: "pending" },
      { id: `${slug}-p4`, name: "Diego Alvarez", title: "Account Executive", company, seniority: 0.35, signals: [], enrichment: "pending" },
    ],
    signals: [
      { id: `${slug}-s1`, kind: "hiring", title: "8 open SDR + AE roles posted in the last 2 weeks", detail: "Rapid GTM expansion — outbound motion scaling fast.", severity: "hot", source: "LinkedIn Jobs", ts: daysAgo(4), personId: `${slug}-p1` },
      { id: `${slug}-s2`, kind: "job_change", title: "Marcus Webb promoted to Head of RevOps 18 days ago", detail: "New RevOps leader — actively evaluating tooling.", severity: "warm", source: "LinkedIn", ts: daysAgo(18), personId: `${slug}-p2` },
      { id: `${slug}-s3`, kind: "funding", title: "Raised $150M Series D at a $8.1B valuation", detail: "Fresh budget, board pressure to grow pipeline.", severity: "warm", source: "Crunchbase", ts: daysAgo(30) },
    ],
  }),
  notion: (company, slug) => ({
    people: [
      { id: `${slug}-p1`, name: "Elena Rossi", title: "Head of Sales", company, seniority: 0.85, signals: [], enrichment: "pending" },
      { id: `${slug}-p2`, name: "Tom Becker", title: "VP Marketing", company, seniority: 0.8, signals: [], enrichment: "pending" },
      { id: `${slug}-p3`, name: "Aisha Khan", title: "Sales Enablement Lead", company, seniority: 0.55, signals: [], enrichment: "pending" },
    ],
    signals: [
      { id: `${slug}-s1`, kind: "job_change", title: "Head of Sales started 9 days ago", detail: "New leader building the outbound playbook from scratch.", severity: "hot", source: "LinkedIn", ts: daysAgo(9), personId: `${slug}-p1` },
      { id: `${slug}-s2`, kind: "tech_adopt", title: "Adopted a new CRM last month", severity: "warm", source: "BuiltWith", ts: daysAgo(28), personId: `${slug}-p3` },
    ],
  }),
  figma: (company, slug) => ({
    people: [
      { id: `${slug}-p1`, name: "Nathan Brooks", title: "VP Revenue", company, seniority: 0.9, signals: [], enrichment: "pending" },
      { id: `${slug}-p2`, name: "Sofia Marchetti", title: "Enterprise Sales Director", company, seniority: 0.7, signals: [], enrichment: "pending" },
      { id: `${slug}-p3`, name: "Kenji Watanabe", title: "Sales Ops Manager", company, seniority: 0.5, signals: [], enrichment: "pending" },
    ],
    signals: [
      { id: `${slug}-s1`, kind: "news", title: "Announced enterprise push into regulated industries", detail: "New segment = new sales motion and tooling needs.", severity: "hot", source: "TechCrunch", ts: daysAgo(6), personId: `${slug}-p1` },
      { id: `${slug}-s2`, kind: "hiring", title: "5 enterprise AE roles open", severity: "warm", source: "LinkedIn Jobs", ts: daysAgo(11), personId: `${slug}-p2` },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Deterministic generator for unknown companies
// ---------------------------------------------------------------------------

const FIRST = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn"];
const LAST = ["Nguyen", "Silva", "Kowalski", "Okafor", "Bianchi", "Larsson", "Haddad", "Novak", "Reyes", "Mori"];
const TITLES: Array<{ title: string; seniority: number }> = [
  { title: "VP of Sales", seniority: 0.9 },
  { title: "Head of Revenue Operations", seniority: 0.75 },
  { title: "Director of Sales Development", seniority: 0.6 },
  { title: "Account Executive", seniority: 0.35 },
];
const SIGNAL_TEMPLATES: Array<Omit<Signal, "id" | "ts" | "personId">> = [
  { kind: "hiring", title: "Multiple SDR & AE roles posted this month", detail: "Outbound motion scaling — GTM tooling in play.", severity: "hot", source: "LinkedIn Jobs" },
  { kind: "job_change", title: "New revenue leader started recently", detail: "Fresh leadership re-evaluating the stack.", severity: "warm", source: "LinkedIn" },
  { kind: "funding", title: "Closed a new funding round", detail: "Budget freed up for growth investments.", severity: "warm", source: "Crunchbase" },
];

function generate(company: string, slug: string): MockDataset {
  const h = hash(slug);
  const count = 3 + (h % 2); // 3 or 4 people
  const people: Person[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[(h + i * 7) % FIRST.length];
    const last = LAST[(h + i * 13) % LAST.length];
    const role = TITLES[i % TITLES.length];
    people.push({
      id: `${slug}-p${i + 1}`,
      name: `${first} ${last}`,
      title: role.title,
      company,
      seniority: role.seniority,
      signals: [],
      enrichment: "pending",
    });
  }
  // Always at least one HOT signal, tied to the most senior person → guarantees a red node.
  const hotTemplate = SIGNAL_TEMPLATES[0];
  const warmTemplate = SIGNAL_TEMPLATES[1 + (h % 2)];
  const signals: Signal[] = [
    { ...hotTemplate, id: `${slug}-s1`, ts: daysAgo(5 + (h % 7)), personId: people[0].id },
    { ...warmTemplate, id: `${slug}-s2`, ts: daysAgo(15 + (h % 14)), personId: people[Math.min(1, people.length - 1)].id },
  ];
  return { people, signals };
}

export function mockDataset(company: string): MockDataset {
  const slug = slugify(company);
  const curated = CURATED[slug];
  return curated ? curated(company, slug) : generate(company, slug);
}
