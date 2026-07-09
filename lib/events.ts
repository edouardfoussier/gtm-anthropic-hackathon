import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Append-only JSONL event log under data/events/. One file per stream
 * ("views", "callbacks"). This is the source the dashboard reads — no DB in a
 * one-day hack.
 */
const EVENTS_DIR = path.join(process.cwd(), "data", "events");

export interface StoredEvent {
  at: string;
  [key: string]: unknown;
}

export async function appendEvent(
  stream: string,
  event: Record<string, unknown>,
): Promise<void> {
  await mkdir(EVENTS_DIR, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n";
  await appendFile(path.join(EVENTS_DIR, `${stream}.jsonl`), line, "utf8");
}

export async function readEvents(stream: string): Promise<StoredEvent[]> {
  try {
    const raw = await readFile(path.join(EVENTS_DIR, `${stream}.jsonl`), "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as StoredEvent);
  } catch {
    return [];
  }
}
