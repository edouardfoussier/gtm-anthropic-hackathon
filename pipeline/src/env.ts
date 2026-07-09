/**
 * Zero-dependency env loader. Reads .env.local (then .env) from the repo root so
 * the pipeline picks up keys regardless of how it is launched (npx tsx, spawn
 * from a future API route, etc.). Import for side effects before reading env.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
/** repo root = pipeline/src → ../../ */
export const ROOT = path.resolve(SRC_DIR, "..", "..");
export const PIPELINE_DIR = path.join(ROOT, "pipeline");
export const OUT_DIR = path.join(PIPELINE_DIR, "out");
export const CACHE_DIR = path.join(PIPELINE_DIR, ".cache");
export const ASSETS_DIR = path.join(PIPELINE_DIR, "assets");
/** Shared brand assets (company logos, team photos) live in the repo-root data/. */
export const DATA_DIR = path.join(ROOT, "data");

for (const name of [".env.local", ".env"]) {
  const p = path.join(ROOT, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const key = m[1];
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

export function presenterPhoto(): string {
  return (
    process.env.AUTODECK_PRESENTER?.trim() ||
    path.join(ASSETS_DIR, "presenter.jpg")
  );
}
