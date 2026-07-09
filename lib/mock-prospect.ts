import type { Prospect, Signal, SignalKind } from "@/lib/types";

const SIGNAL_TEMPLATES: { kind: SignalKind; label: (company: string) => string }[] = [
  {
    kind: "job_change",
    label: (company) => `VP Sales left for ${company} 12 days ago`,
  },
  {
    kind: "hiring",
    label: () => "3 SDR job openings posted this month",
  },
  {
    kind: "funding",
    label: (company) => `${company} closed a Series B 6 weeks ago`,
  },
  {
    kind: "competitor_engagement",
    label: () => "Engaged with a competitor's LinkedIn post twice",
  },
];

const FIRST_NAMES = ["Amélie", "Julien", "Sofia", "Marcus", "Nina", "Theo"];
const LAST_NAMES = ["Rousseau", "Bernard", "Okafor", "Lindqvist", "Chen", "Dubois"];
const TITLES = [
  "VP Sales",
  "Head of Growth",
  "CRO",
  "Director of Revenue Ops",
  "VP Marketing",
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function slugify(company: string): string {
  return company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Deterministic mock standing in for Sillage (signals) + FullEnrich
 * (contact data) — same shape the real adapters will return, so this
 * file is a drop-in replacement point, not throwaway.
 */
export function buildMockProspect(companyName: string): Prospect {
  const id = slugify(companyName) || "prospect";
  const rand = seededRandom(hashString(companyName));

  const signalCount = 2 + Math.floor(rand() * 2);
  const signals: Signal[] = SIGNAL_TEMPLATES.slice(0, signalCount).map(
    (template, index) => ({
      id: `${id}-signal-${index}`,
      kind: template.kind,
      label: template.label(companyName),
    }),
  );

  const contactCount = 2 + Math.floor(rand() * 2);
  const domain = `${slugify(companyName)}.com`;
  const contacts = Array.from({ length: contactCount }, (_, index) => {
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const title = TITLES[Math.floor(rand() * TITLES.length)];
    return {
      id: `${id}-contact-${index}`,
      name: `${firstName} ${lastName}`,
      title,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
      phone: `+1 415 555 ${String(1000 + Math.floor(rand() * 9000)).slice(0, 4)}`,
      linkedin: `linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
    };
  });

  const relationships = contacts.map((contact, index) => ({
    id: `${id}-rel-${index}`,
    contactId: contact.id,
    kind: index === 0 ? ("decision_maker" as const) : ("champion" as const),
    signalId: signals[index % signals.length]?.id,
  }));

  return { id, companyName, signals, contacts, relationships };
}
