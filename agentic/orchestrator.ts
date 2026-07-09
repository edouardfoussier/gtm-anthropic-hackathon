// The agent core. Deterministic v0 (AGENTS.md D002): a staged, Sillage-first sequence with a
// single Claude structured-output call to rank people, pick the best contact, and write the
// outreach angle. Transport-agnostic — it emits typed events through `onEvent` and returns +
// persists a ProspectState. The UI and the video pipeline plug into those two seams later.
//
// Everything degrades: no ANTHROPIC_API_KEY → deterministic scored pick; any adapter failure
// → mock (handled inside the adapters). The run never throws and never hangs.

import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { llmMode, MODEL, TIMEOUT_MS } from "./config";
import { getPeople, getSignals } from "./sillage";
import { enrichContact } from "./fullenrich";
import { appendEvent, markSeen, saveProspect, slugify } from "./store";
import { withTimeout, nowIso } from "./util";
import {
  PickSchema,
  type AgentEvent,
  type GraphNode,
  type Person,
  type Pick,
  type ProspectState,
  type Severity,
  type Signal,
} from "./types";

export interface RunInput {
  company: string;
}

export interface RunOptions {
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

const SEVERITY_SCORE: Record<Severity, number> = { hot: 3, warm: 2, cold: 1 };

function scorePerson(p: Person): number {
  const signalScore = p.signals.reduce((sum, s) => sum + SEVERITY_SCORE[s.severity], 0);
  return signalScore * 10 + (p.seniority ?? 0);
}

/** Deterministic pick used when the LLM is unavailable or returns something invalid. */
function fallbackPick(people: Person[]): Pick {
  const best = [...people].sort((a, b) => scorePerson(b) - scorePerson(a))[0];
  const topSignal = [...best.signals].sort((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])[0];
  const angle = topSignal
    ? `Lead with the "${topSignal.title}" signal — reach ${best.name} (${best.title}) while it's fresh and tie it to how AutoDeck compresses their outbound motion.`
    : `Reach ${best.name} (${best.title}) with a concise, personalized pitch on accelerating their pipeline.`;
  return {
    selectedPersonId: best.id,
    reason: topSignal
      ? `Highest-intent contact: ${best.title} carrying a ${topSignal.severity} signal (${topSignal.title}).`
      : `Most senior relevant contact: ${best.title}.`,
    angle,
  };
}

async function llmPick(company: string, people: Person[]): Promise<Pick> {
  const roster = people
    .map((p) => {
      const sigs = p.signals.length
        ? p.signals.map((s) => `[${s.severity}] ${s.title}`).join("; ")
        : "no signals";
      return `- id=${p.id} | ${p.name}, ${p.title} | signals: ${sigs}`;
    })
    .join("\n");

  const prompt = [
    `You are AutoDeck's GTM strategist. Company: ${company}.`,
    `Candidate contacts and their intent signals:`,
    roster,
    ``,
    `Pick the single best person to send a personalized video pitch deck to right now.`,
    `Favor whoever combines seniority with the hottest, most actionable intent signal.`,
    `selectedPersonId MUST be one of the ids above.`,
    `Write "reason" in one sentence, and "angle" as a crisp, personalized outreach hook (<=2 sentences).`,
  ].join("\n");

  const { output } = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: PickSchema }),
    prompt,
  });
  return output;
}

async function pickContact(company: string, people: Person[]): Promise<Pick> {
  if (llmMode() === "real") {
    try {
      const pick = await withTimeout(llmPick(company, people), TIMEOUT_MS, "claude-pick");
      if (people.some((p) => p.id === pick.selectedPersonId)) return pick;
      console.warn("[orchestrator] LLM picked an unknown id — using deterministic fallback");
    } catch (err) {
      console.warn(`[orchestrator] LLM pick failed (${(err as Error).message}) — using deterministic fallback`);
    }
  }
  return fallbackPick(people);
}

export async function runProspect(input: RunInput, opts: RunOptions = {}): Promise<ProspectState> {
  const company = input.company.trim();
  const id = slugify(company);
  const createdAt = nowIso();

  const state: ProspectState = {
    id,
    company,
    createdAt,
    status: "running",
    people: [],
    nodes: [],
    links: [],
  };

  const emit = async (event: AgentEvent): Promise<void> => {
    try {
      opts.onEvent?.(event);
    } catch {
      /* a consumer callback must never break the run */
    }
    try {
      await appendEvent(id, event);
    } catch {
      /* log-append best-effort */
    }
  };

  const node = (nodeId: string): GraphNode | undefined => state.nodes.find((n) => n.id === nodeId);
  const abort = (): boolean => opts.signal?.aborted ?? false;

  await emit({ type: "run_started", ts: nowIso(), prospectId: id, company });

  try {
    // Company node.
    const companyNode: GraphNode = { id, type: "company", label: company, status: "default", meta: { signals: [] } };
    state.nodes.push(companyNode);
    await emit({ type: "node_added", ts: nowIso(), node: companyNode });

    // Sillage-first: people AND signals up front.
    const [people, signals] = await Promise.all([getPeople(company), getSignals(company)]);

    if (people.length === 0) {
      state.status = "error";
      state.error = "no people surfaced for this company";
      await emit({ type: "error", ts: nowIso(), stage: "sillage", message: state.error });
      await emit({ type: "run_completed", ts: nowIso(), prospect: state });
      await saveProspect(state);
      return state;
    }

    // Person nodes + links.
    for (const person of people) {
      state.people.push(person);
      const personNode: GraphNode = {
        id: person.id,
        type: "person",
        label: person.name,
        sublabel: person.title,
        status: "default",
      };
      state.nodes.push(personNode);
      await emit({ type: "node_added", ts: nowIso(), node: personNode });
      const link = { id: `${id}->${person.id}`, source: id, target: person.id, kind: "works_at" as const };
      state.links.push(link);
      await emit({ type: "link_added", ts: nowIso(), link });
    }

    // Attach signals → red node the moment a hot one lands.
    for (const signal of signals) {
      const target = signal.personId ? state.people.find((p) => p.id === signal.personId) : undefined;
      const nodeId = target ? target.id : id;
      if (target) {
        target.signals.push(signal);
      } else {
        (companyNode.meta!.signals as Signal[]).push(signal);
      }
      if (signal.severity === "hot") {
        const n = node(nodeId);
        if (n) n.status = "hot";
      }
      await emit({ type: "signal_detected", ts: nowIso(), nodeId, signal });
      if (abort()) throw new Error("aborted");
    }

    // Claude: rank → pick → angle.
    const pick = await pickContact(company, state.people);
    state.selectedContactId = pick.selectedPersonId;
    state.reason = pick.reason;
    state.angle = pick.angle;
    const selectedNode = node(pick.selectedPersonId);
    if (selectedNode) {
      const hadHotSignal = selectedNode.status === "hot";
      selectedNode.status = "selected";
      selectedNode.meta = { ...selectedNode.meta, hadHotSignal };
    }
    await emit({ type: "contact_selected", ts: nowIso(), nodeId: pick.selectedPersonId, reason: pick.reason });
    await emit({ type: "angle_written", ts: nowIso(), angle: pick.angle });

    // FullEnrich: enrich the pick.
    const selectedPerson = state.people.find((p) => p.id === pick.selectedPersonId)!;
    selectedPerson.enrichment = "enriching";
    await emit({ type: "contact_enriching", ts: nowIso(), nodeId: selectedPerson.id });
    const contact = await enrichContact(selectedPerson);
    selectedPerson.contact = contact;
    selectedPerson.enrichment = "done";
    if (selectedNode) selectedNode.meta = { ...selectedNode.meta, enriched: true, contact };
    await emit({ type: "contact_enriched", ts: nowIso(), nodeId: selectedPerson.id, contact });

    state.status = "done";
    await emit({ type: "run_completed", ts: nowIso(), prospect: state });
    await saveProspect(state);
    await markSeen(company, createdAt);
    return state;
  } catch (err) {
    state.status = "error";
    state.error = (err as Error).message;
    await emit({ type: "error", ts: nowIso(), stage: "run", message: state.error });
    await emit({ type: "run_completed", ts: nowIso(), prospect: state });
    await saveProspect(state);
    return state;
  }
}
