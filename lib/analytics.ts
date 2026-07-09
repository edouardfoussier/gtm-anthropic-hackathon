import { existsSync } from "node:fs";
import path from "node:path";
import { readEvents } from "./events";
import { getAllProspects } from "./prospects";

/**
 * Aggregates the append-only event logs into per-prospect stats for the
 * dashboard. Pure over its inputs; `nowMs` is passed in (from the route) so the
 * "watching now" window is testable and cache-safe.
 */
export interface ProspectStats {
  id: string;
  firstName: string;
  company: string;
  sent: boolean;
  opened: boolean;
  viewers: number;
  plays: number;
  watchedSeconds: number;
  lastActivity: string | null;
  watchingNow: boolean;
  callbackRequested: boolean;
  callbackWhen: string | null;
}

/** A prospect is "watching now" if we saw an event within this window. */
const WATCHING_WINDOW_MS = 15_000;

function videoExists(id: string): boolean {
  return existsSync(path.join(process.cwd(), "public", "videos", `${id}.mp4`));
}

export async function computeStats(nowMs: number): Promise<ProspectStats[]> {
  const [prospects, views, callbacks] = await Promise.all([
    getAllProspects(),
    readEvents("views"),
    readEvents("callbacks"),
  ]);

  const byId = new Map<string, ProspectStats>();
  for (const p of prospects) {
    byId.set(p.id, {
      id: p.id,
      firstName: p.firstName,
      company: p.company,
      sent: videoExists(p.id),
      opened: false,
      viewers: 0,
      plays: 0,
      watchedSeconds: 0,
      lastActivity: null,
      watchingNow: false,
      callbackRequested: false,
      callbackWhen: null,
    });
  }

  const viewersById = new Map<string, Set<string>>();
  for (const v of views) {
    const id = String(v.prospectId ?? "");
    const s = byId.get(id);
    if (!s) continue;
    s.opened = true;
    if (v.event === "play") s.plays += 1;
    const ct = typeof v.currentTime === "number" ? v.currentTime : 0;
    if (ct > s.watchedSeconds) s.watchedSeconds = ct;
    if (!s.lastActivity || v.at > s.lastActivity) s.lastActivity = v.at;
    const set = viewersById.get(id) ?? new Set<string>();
    set.add(String(v.viewer ?? ""));
    viewersById.set(id, set);
  }
  for (const [id, set] of viewersById) {
    const s = byId.get(id);
    if (s) s.viewers = set.size;
  }

  for (const s of byId.values()) {
    if (s.lastActivity && nowMs - Date.parse(s.lastActivity) < WATCHING_WINDOW_MS) {
      s.watchingNow = true;
    }
  }

  for (const c of callbacks) {
    const id = String(c.prospectId ?? "");
    const s = byId.get(id);
    if (!s) continue;
    s.callbackRequested = true;
    if (typeof c.when === "string") s.callbackWhen = c.when;
  }

  return [...byId.values()].sort((a, b) => {
    if (a.watchingNow !== b.watchingNow) return a.watchingNow ? -1 : 1;
    if (a.sent !== b.sent) return a.sent ? -1 : 1;
    return (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "");
  });
}
