import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";

/**
 * Append-only event log ("views", "callbacks", "emails") backing the dashboard.
 *
 * Uses Upstash Redis when configured — REQUIRED on serverless/Vercel, where the
 * filesystem is ephemeral and not shared across invocations, so file-based events
 * would silently vanish. Falls back to a local JSONL file for local dev and a
 * single-box (VM) deploy where the filesystem persists.
 */
export interface StoredEvent {
  at: string;
  [key: string]: unknown;
}

const EVENTS_DIR = path.join(process.cwd(), "data", "events");

// Support both Upstash-native and Vercel-Marketplace env var names.
function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let client: Redis | null = null;
function getRedis(): Redis | null {
  if (client) return client;
  const config = redisConfig();
  if (!config) return null;
  client = new Redis(config);
  return client;
}

function key(stream: string): string {
  return `autodeck:events:${stream}`;
}

export async function appendEvent(
  stream: string,
  event: Record<string, unknown>,
): Promise<void> {
  const stored: StoredEvent = { at: new Date().toISOString(), ...event };
  const redis = getRedis();
  if (redis) {
    await redis.rpush(key(stream), stored);
    return;
  }
  await mkdir(EVENTS_DIR, { recursive: true });
  await appendFile(
    path.join(EVENTS_DIR, `${stream}.jsonl`),
    JSON.stringify(stored) + "\n",
    "utf8",
  );
}

export async function readEvents(stream: string): Promise<StoredEvent[]> {
  const redis = getRedis();
  if (redis) {
    return redis.lrange<StoredEvent>(key(stream), 0, -1);
  }
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
