// The single source of truth for a prospect run: builds BOTH the staged
// graph frames (the validated D016 story — signals → org grows from the CEO
// → Claude picks the CRO → FullEnrich enriches) AND the matching Prospect
// object the contact drawer / queue consume. When the typed company matches
// a real jury prospect, the picked contact takes that person's identity and
// carries juryId so the drawer routes into the real video pipeline
// (/reachout/[id]) instead of the mock queue.
import type { DemoFrame } from "@/components/graph/demo-frames";
import type { PersonNode, PersonStatus, Seniority } from "@/components/graph/types";
import type { Contact, Prospect, Signal, SignalKind } from "@/lib/types";
import type { RealProspect } from "@/lib/mock-prospect";
import type { CachePerson, JuryRun } from "@/lib/jury-cache";

interface OrgSeed {
  key: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: Seniority;
  reportsTo?: string;
}

// 7-person org, discovery order = array order (CEO first, org grows outward).
const ORG: OrgSeed[] = [
  { key: "ceo", firstName: "Élodie", lastName: "Marchand", title: "CEO", seniority: 1 },
  { key: "cro", firstName: "Marc", lastName: "Delacroix", title: "CRO", seniority: 2, reportsTo: "ceo" },
  { key: "vpm", firstName: "Camille", lastName: "Rousseau", title: "VP Marketing", seniority: 2, reportsTo: "ceo" },
  { key: "talent", firstName: "Antoine", lastName: "Bernard", title: "Talent Lead", seniority: 3, reportsTo: "ceo" },
  { key: "rev", firstName: "Claire", lastName: "Fontaine", title: "Head of Revenue", seniority: 3, reportsTo: "cro" },
  { key: "ops", firstName: "Sofia", lastName: "Reyes", title: "Sales Ops Manager", seniority: 3, reportsTo: "cro" },
  { key: "sdr", firstName: "Théo", lastName: "Lambert", title: "SDR Lead", seniority: 4, reportsTo: "cro" },
];

const PICKED_KEY = "cro";

const SIGNAL_SEEDS: { kind: SignalKind; label: (company: string) => string }[] = [
  { kind: "job_change", label: () => "VP Sales departed 12 days ago" },
  { kind: "hiring", label: () => "3 SDR job openings posted this week" },
  { kind: "funding", label: (c) => `${c} announced a Series D (€120M)` },
];

const ANGLE_BY_SIGNAL: Record<SignalKind, string> = {
  job_change: "new sales leadership needs quick wins",
  hiring: "rebuild the SDR engine",
  funding: "post-funding growth push",
  competitor_engagement: "competitive displacement window",
};

function slugify(company: string): string {
  return company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface DemoRun {
  prospect: Prospect;
  frames: DemoFrame[];
}

export function buildDemoRun(
  companyName: string,
  realProspects: RealProspect[] = [],
): DemoRun {
  const id = slugify(companyName) || "prospect";
  const domain = `${id}.com`;

  const signals: Signal[] = SIGNAL_SEEDS.map((seed, index) => ({
    id: `${id}-signal-${index}`,
    kind: seed.kind,
    label: seed.label(companyName),
  }));

  // Jury bridge: the picked contact takes the real prospect's identity.
  const juryMatch = realProspects.find(
    (p) => p.company.trim().toLowerCase() === companyName.trim().toLowerCase(),
  );

  const contacts: Contact[] = ORG.map((seed) => {
    const contactId = `${id}-${seed.key}`;
    if (seed.key === PICKED_KEY && juryMatch) {
      return {
        id: contactId,
        name: `${juryMatch.firstName} ${juryMatch.lastName}`,
        title: "",
        email: "",
        phone: "",
        linkedin: "",
        juryId: juryMatch.id,
      };
    }
    const first = seed.firstName.toLowerCase();
    const last = seed.lastName.toLowerCase();
    return {
      id: contactId,
      name: `${seed.firstName} ${seed.lastName}`,
      title: seed.title,
      email: `${first}.${last}@${domain}`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      phone: `+33 6 ${String(10 + seed.key.length)} ${String(20 + seed.firstName.length)} ${String(30 + seed.lastName.length)} ${String(40 + seed.seniority)}`,
      linkedin: `linkedin.com/in/${first}-${last}`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    };
  });

  const contactByKey = new Map(ORG.map((seed, i) => [seed.key, contacts[i]]));
  const picked = contactByKey.get(PICKED_KEY);
  if (!picked) throw new Error("demo org must contain the picked contact");

  const relationships = ORG.map((seed, index) => ({
    id: `${id}-rel-${index}`,
    contactId: contacts[index].id,
    kind:
      seed.key === PICKED_KEY
        ? ("decision_maker" as const)
        : seed.seniority <= 2
          ? ("champion" as const)
          : ("signal_source" as const),
    signalId: signals[index % signals.length]?.id,
  }));

  const prospect: Prospect = { id, companyName, signals, contacts, relationships };

  // Graph nodes — jury-substituted picked contact shows "Decision maker".
  function toNode(seed: OrgSeed, status: PersonStatus, sublabel?: string): PersonNode {
    const contact = contactByKey.get(seed.key);
    return {
      id: contact ? contact.id : `${id}-${seed.key}`,
      name: contact?.name ?? `${seed.firstName} ${seed.lastName}`,
      title: contact && contact.juryId ? "Decision maker" : seed.title,
      status,
      seniority: seed.seniority,
      reportsTo: seed.reportsTo ? `${id}-${seed.reportsTo}` : undefined,
      sublabel,
    };
  }

  const pickedSeed = ORG.find((s) => s.key === PICKED_KEY);
  const pickedNode = pickedSeed ? toNode(pickedSeed, "picked") : undefined;
  const angle = ANGLE_BY_SIGNAL[signals[0]?.kind ?? "hiring"];
  const enrichedEmail =
    picked.email ||
    `${picked.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${domain}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const frames: DemoFrame[] = [
    { delay: 350, log: `Sillage · tracking ${companyName}` },
    ...signals.map((signal) => ({
      delay: 900,
      log: `Sillage · signal — ${signal.label}`,
    })),
    ...ORG.map((seed, i) => ({
      delay: i === 0 ? 750 : 420,
      log: `Sillage · found ${contactByKey.get(seed.key)?.name} — ${
        contactByKey.get(seed.key)?.juryId ? "Decision maker" : seed.title
      }`,
      people: ORG.slice(0, i + 1).map((s) => toNode(s, "active")),
    })),
    {
      delay: 1600,
      log: `Claude · picked ${picked.name} (${pickedNode?.title ?? "CRO"}) — angle: ${angle}`,
      people: ORG.map((s) =>
        toNode(s, s.key === PICKED_KEY ? "picked" : "dim"),
      ),
    },
    {
      delay: 1500,
      log: "FullEnrich · email + mobile verified ✓",
      people: ORG.map((s) =>
        s.key === PICKED_KEY
          ? toNode(s, "enriched", enrichedEmail)
          : toNode(s, "dim"),
      ),
    },
  ];

  return { prospect, frames };
}

const KIND_MAP: Record<string, SignalKind> = {
  job_change: "job_change",
  hiring: "hiring",
  funding: "funding",
  competitor_engagement: "competitor_engagement",
};
const toKind = (k: string): SignalKind => KIND_MAP[k] ?? "hiring";

/**
 * Same staged story as buildDemoRun, but from a REAL pre-baked jury run
 * (real Sillage org + FullEnrich contact). The picked node is the jury member
 * and carries juryId so the drawer routes into the real /reachout pipeline.
 */
export function buildRealRun(run: JuryRun): DemoRun {
  const id = run.slug || slugify(run.companyName) || "prospect";
  const cid = (k: string) => `${id}-${k}`;
  const people = run.people;

  const signals: Signal[] = run.signals.map((s, i) => ({
    id: `${id}-signal-${i}`,
    kind: toKind(s.kind),
    label: s.label,
  }));

  const contacts: Contact[] = people.map((p) => ({
    id: cid(p.key),
    name: p.name,
    title: p.juryId ? "Decision maker" : p.title,
    email: p.email ?? "",
    phone: p.phone ?? "",
    linkedin: "",
    ...(p.juryId ? { juryId: run.juryId } : {}),
  }));

  const relationships = people.map((p, i) => ({
    id: `${id}-rel-${i}`,
    contactId: cid(p.key),
    kind:
      p.key === run.pickedKey
        ? ("decision_maker" as const)
        : p.seniority <= 2
          ? ("champion" as const)
          : ("signal_source" as const),
    signalId: signals[i % Math.max(1, signals.length)]?.id,
  }));

  const prospect: Prospect = {
    id,
    companyName: run.companyName,
    signals,
    contacts,
    relationships,
  };

  const toNode = (p: CachePerson, status: PersonStatus, sublabel?: string): PersonNode => ({
    id: cid(p.key),
    name: p.name,
    title: p.juryId ? "Decision maker" : p.title,
    status,
    seniority: p.seniority as Seniority,
    reportsTo: p.reportsTo ? cid(p.reportsTo) : undefined,
    sublabel,
  });

  const picked = people.find((p) => p.key === run.pickedKey) ?? people[0];

  const frames: DemoFrame[] = [
    { delay: 350, log: `Sillage · tracking ${run.companyName}` },
    ...signals.map((s) => ({ delay: 900, log: `Sillage · signal — ${s.label}` })),
    ...people.map((p, i) => ({
      delay: i === 0 ? 750 : 420,
      log: `Sillage · found ${p.name} — ${p.juryId ? "Decision maker" : p.title || "team"}`,
      people: people.slice(0, i + 1).map((q) => toNode(q, "active")),
    })),
    {
      delay: 1600,
      log: `Claude · picked ${picked.name} (${picked.title || "Decision maker"}) — angle: ${run.signals[0]?.label ?? "high intent"}`,
      people: people.map((p) => toNode(p, p.key === run.pickedKey ? "picked" : "dim")),
    },
    {
      delay: 1500,
      log: `FullEnrich · ${picked.email ? `${picked.email} verified ✓` : "contact verified ✓"}`,
      people: people.map((p) =>
        p.key === run.pickedKey ? toNode(p, "enriched", picked.email ?? undefined) : toNode(p, "dim"),
      ),
    },
  ];

  return { prospect, frames };
}
