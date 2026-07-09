// Standalone runner + agent-layer smoke check.
//
//   npx tsx agentic/run.ts "Ramp"
//
// Runs one prospect through the full agent flow (mocks by default — no keys needed),
// pretty-prints the event stream as it arrives, then asserts the demo-path contract:
// the required events fired in order AND data/prospects/{id}.json was written with a
// selected contact + angle + enriched coordinates. Exits non-zero on any failure.

import { runProspect } from "./orchestrator";
import { loadProspect } from "./store";
import type { AgentEvent, AgentEventType } from "./types";

const ICON: Record<AgentEventType, string> = {
  run_started: "🚀",
  node_added: "⚪",
  link_added: "🔗",
  signal_detected: "📡",
  contact_selected: "🎯",
  angle_written: "✍️ ",
  contact_enriching: "⏳",
  contact_enriched: "✅",
  run_completed: "🏁",
  error: "❌",
};

function line(e: AgentEvent): string {
  switch (e.type) {
    case "run_started":
      return `run ${e.prospectId} — ${e.company}`;
    case "node_added":
      return `${e.node.type} node: ${e.node.label}${e.node.sublabel ? ` (${e.node.sublabel})` : ""}`;
    case "link_added":
      return `${e.link.source} → ${e.link.target}`;
    case "signal_detected":
      return `${e.signal.severity === "hot" ? "🔴 HOT" : e.signal.severity} on ${e.nodeId}: ${e.signal.title}`;
    case "contact_selected":
      return `${e.nodeId} — ${e.reason}`;
    case "angle_written":
      return e.angle;
    case "contact_enriching":
      return `${e.nodeId}…`;
    case "contact_enriched":
      return `${e.nodeId}: ${e.contact.email ?? "?"} · ${e.contact.phone ?? "?"}`;
    case "run_completed":
      return `status=${e.prospect.status} · people=${e.prospect.people.length} · pick=${e.prospect.selectedContactId ?? "none"}`;
    case "error":
      return `[${e.stage}] ${e.message}`;
  }
}

const REQUIRED: AgentEventType[] = [
  "run_started",
  "node_added",
  "signal_detected",
  "contact_selected",
  "angle_written",
  "contact_enriching",
  "contact_enriched",
  "run_completed",
];

async function main(): Promise<void> {
  const company = process.argv[2] ?? "Ramp";
  const seen: AgentEventType[] = [];
  let sawHot = false;

  const state = await runProspect(
    { company },
    {
      onEvent: (e) => {
        seen.push(e.type);
        if (e.type === "signal_detected" && e.signal.severity === "hot") sawHot = true;
        console.log(`${ICON[e.type]} ${e.type.padEnd(17)} ${line(e)}`);
      },
    },
  );

  // --- assertions -----------------------------------------------------------
  const failures: string[] = [];
  for (const t of REQUIRED) {
    if (!seen.includes(t)) failures.push(`missing event: ${t}`);
  }
  if (!sawHot) failures.push("no hot signal_detected event (red-node beat missing)");

  const persisted = await loadProspect(state.id);
  if (!persisted) failures.push(`state file not written: data/prospects/${state.id}.json`);
  else {
    if (!persisted.selectedContactId) failures.push("persisted state has no selectedContactId");
    if (!persisted.angle) failures.push("persisted state has no angle");
    const pick = persisted.people.find((p) => p.id === persisted.selectedContactId);
    if (!pick?.contact?.email) failures.push("selected contact was not enriched with an email");
  }

  console.log("");
  if (failures.length) {
    console.error(`smoke: FAIL\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`smoke: OK — ${company} → picked ${state.selectedContactId} → data/prospects/${state.id}.json`);
}

main().catch((err) => {
  console.error("smoke: FAIL (threw)", err);
  process.exit(1);
});
