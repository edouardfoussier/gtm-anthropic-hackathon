// Memory — three consumers, per the locked decision:
//   1. per-prospect state JSON   data/prospects/{id}.json        (pipeline + UI rehydrate)
//   2. append-only decision log  data/prospects/{id}.events.jsonl (debug / replay / AI-depth)
//   3. global seen-companies cache data/seen.json                 (dedupe + reuse across runs)

import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config";
import type { AgentEvent, ProspectState } from "./types";

const root = path.resolve(process.cwd(), DATA_DIR);
const prospectsDir = path.join(root, "prospects");
const seenFile = path.join(root, "seen.json");

/** Stable, filesystem-safe id from a company name. Deterministic → reproducible demo runs. */
export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || "prospect";
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveProspect(state: ProspectState): Promise<void> {
  await ensureDir(prospectsDir);
  const file = path.join(prospectsDir, `${state.id}.json`);
  await fs.writeFile(file, JSON.stringify(state, null, 2), "utf8");
}

export async function loadProspect(id: string): Promise<ProspectState | null> {
  try {
    const raw = await fs.readFile(path.join(prospectsDir, `${id}.json`), "utf8");
    return JSON.parse(raw) as ProspectState;
  } catch {
    return null;
  }
}

export async function appendEvent(id: string, event: AgentEvent): Promise<void> {
  await ensureDir(prospectsDir);
  const file = path.join(prospectsDir, `${id}.events.jsonl`);
  await fs.appendFile(file, JSON.stringify(event) + "\n", "utf8");
}

export interface SeenEntry {
  slug: string;
  company: string;
  lastRunAt: string; // ISO
  runs: number;
}

export async function getSeen(): Promise<SeenEntry[]> {
  try {
    const raw = await fs.readFile(seenFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SeenEntry[]) : [];
  } catch {
    return [];
  }
}

export async function markSeen(company: string, at: string): Promise<void> {
  await ensureDir(root);
  const slug = slugify(company);
  const entries = await getSeen();
  const existing = entries.find((e) => e.slug === slug);
  if (existing) {
    existing.company = company;
    existing.lastRunAt = at;
    existing.runs += 1;
  } else {
    entries.push({ slug, company, lastRunAt: at, runs: 1 });
  }
  await fs.writeFile(seenFile, JSON.stringify(entries, null, 2), "utf8");
}
