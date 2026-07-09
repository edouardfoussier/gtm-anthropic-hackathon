import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Pre-baked per-company agentic runs (real Sillage org + FullEnrich contact),
 * assembled by scripts/build-jury-cache.py. Lets the landing graph render REAL
 * data instantly for a jury company (live Sillage would take ~25 min).
 *
 * Contains real people/contacts, so it is NEVER committed (git-ignored under
 * data/jury-*). Read from JURY_CACHE_JSON env (Vercel) → local file → {}.
 */
export interface CachePerson {
  key: string;
  name: string;
  title: string;
  seniority: number;
  reportsTo: string | null;
  juryId: string | null;
  email: string | null;
  phone: string | null;
}
export interface CacheSignal {
  kind: string;
  label: string;
  hot?: boolean;
}
export interface JuryRun {
  slug: string;
  companyName: string;
  companyDomain: string;
  juryId: string;
  juryName: string;
  signals: CacheSignal[];
  pickedKey: string;
  people: CachePerson[];
}
type Cache = Record<string, JuryRun>;

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

let cache: Cache | null = null;

function load(): Cache {
  if (cache) return cache;
  const env = process.env.JURY_CACHE_JSON;
  if (env) {
    try {
      cache = JSON.parse(env) as Cache;
      return cache;
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = readFileSync(path.join(process.cwd(), "data", "jury-cache.json"), "utf8");
    cache = JSON.parse(raw) as Cache;
  } catch {
    cache = {};
  }
  return cache;
}

/** Look up a pre-baked run by (fuzzy) company name. Null when not a cached jury company. */
export function getJuryRun(company: string): JuryRun | null {
  return load()[normKey(company)] ?? null;
}
