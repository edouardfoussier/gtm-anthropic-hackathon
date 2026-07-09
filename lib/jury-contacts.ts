import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * PII overlay for jury members (emails + phones from FullEnrich).
 *
 * The repo is PUBLIC, so this data is NEVER committed. It's read from:
 *   1. process.env.JURY_CONTACTS_JSON  — a JSON string, set in Vercel for production.
 *   2. data/jury-contacts.json         — a git-ignored local file for dev.
 *   3. {} otherwise                    — no contact; callers fall back gracefully.
 */
export interface JuryContact {
  email?: string;
  phone?: string;
}
type ContactMap = Record<string, JuryContact>;

let cache: ContactMap | null = null;

function load(): ContactMap {
  if (cache) return cache;
  const env = process.env.JURY_CONTACTS_JSON;
  if (env) {
    try {
      cache = JSON.parse(env) as ContactMap;
      return cache;
    } catch {
      // fall through to the local file
    }
  }
  try {
    const raw = readFileSync(path.join(process.cwd(), "data", "jury-contacts.json"), "utf8");
    cache = JSON.parse(raw) as ContactMap;
  } catch {
    cache = {};
  }
  return cache;
}

export function getJuryContact(id: string): JuryContact {
  return load()[id] ?? {};
}
