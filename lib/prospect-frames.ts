// Maps a Prospect (from buildMockProspect today, the real adapters tomorrow)
// to the staged DemoFrame[] sequence the home page replays: signals stream in
// → contacts condense one by one → Claude picks ONE decision maker → FullEnrich
// reveals the email. Same narrative the judged demo tells (D016).
import type { DemoFrame } from "@/components/graph/demo-frames";
import type { PersonNode, PersonStatus, Seniority } from "@/components/graph/types";
import type { Contact, Prospect, SignalKind } from "@/lib/types";

const ANGLE_BY_SIGNAL: Record<SignalKind, string> = {
  job_change: "new sales leadership needs quick wins",
  hiring: "rebuild the SDR engine",
  funding: "post-funding growth push",
  competitor_engagement: "competitive displacement window",
};

function seniorityFromTitle(title: string): Seniority {
  const t = title.toLowerCase();
  if (t.includes("ceo") || t.includes("founder")) return 1;
  if (/\bc[a-z]o\b/.test(t) || t.includes("chief") || t.includes("vp")) return 2;
  if (t.includes("head") || t.includes("director")) return 3;
  return 4;
}

function slugify(company: string): string {
  return company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function displayTitle(contact: Contact): string {
  return contact.title || (contact.juryId ? "Real prospect" : "Contact");
}

function enrichedEmail(contact: Contact, companyName: string): string {
  if (contact.email) return contact.email;
  const domain = `${slugify(companyName) || "prospect"}.com`;
  const slug = contact.name.toLowerCase().replace(/[^a-z]+/g, ".");
  return `${slug}@${domain}`;
}

export function buildProspectFrames(prospect: Prospect): DemoFrame[] {
  // Most senior contact anchors the constellation (D016); others link to them.
  // Prospect carries no org chart yet — star topology until real data does.
  const seniorities = new Map<string, Seniority>(
    prospect.contacts.map((c) => [
      c.id,
      c.juryId && !c.title ? 2 : seniorityFromTitle(c.title),
    ]),
  );
  const root = [...prospect.contacts].sort(
    (a, b) => (seniorities.get(a.id) ?? 4) - (seniorities.get(b.id) ?? 4),
  )[0];

  // Reveal order: root first so the org grows outward from the center.
  const ordered = root
    ? [root, ...prospect.contacts.filter((c) => c.id !== root.id)]
    : [...prospect.contacts];

  function toNode(contact: Contact, status: PersonStatus, sublabel?: string): PersonNode {
    return {
      id: contact.id,
      name: contact.name,
      title: displayTitle(contact),
      status,
      seniority: seniorities.get(contact.id) ?? 4,
      reportsTo: root && contact.id !== root.id ? root.id : undefined,
      sublabel,
    };
  }

  const picked =
    prospect.contacts.find((c) =>
      prospect.relationships.some(
        (r) => r.contactId === c.id && r.kind === "decision_maker",
      ),
    ) ?? ordered[0];

  const frames: DemoFrame[] = [
    { delay: 350, log: `Sillage · tracking ${prospect.companyName}` },
    ...prospect.signals.map((signal) => ({
      delay: 900,
      log: `Sillage · signal — ${signal.label}`,
    })),
    ...ordered.map((contact, i) => ({
      delay: i === 0 ? 750 : 420,
      log: `Sillage · found ${contact.name} — ${displayTitle(contact)}`,
      people: ordered
        .slice(0, i + 1)
        .map((c) => toNode(c, "active" as PersonStatus)),
    })),
  ];

  if (picked) {
    const angle =
      ANGLE_BY_SIGNAL[prospect.signals[0]?.kind ?? "hiring"];
    frames.push({
      delay: 1600,
      log: `Claude · picked ${picked.name} (${displayTitle(picked)}) — angle: ${angle}`,
      people: ordered.map((c) =>
        toNode(c, c.id === picked.id ? "picked" : "dim"),
      ),
    });
    frames.push({
      delay: 1500,
      log: "FullEnrich · email + mobile verified ✓",
      people: ordered.map((c) =>
        c.id === picked.id
          ? toNode(c, "enriched", enrichedEmail(c, prospect.companyName))
          : toNode(c, "dim"),
      ),
    });
  }

  return frames;
}
