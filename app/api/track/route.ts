import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { appendEvent } from "@/lib/events";

/**
 * View tracking for share pages. Stores coarse, privacy-preserving events
 * (salted-hash of IP+UA, never raw PII) so the dashboard can show opens and
 * watch progress.
 */
const SALT = process.env.TRACK_SALT ?? "autodeck-dev-salt";

function viewerHash(ip: string, ua: string): string {
  return createHash("sha256").update(`${SALT}:${ip}:${ua}`).digest("hex").slice(0, 16);
}

/** Internal traffic (our own dashboard/preview) carries autodeck_internal=1 so
 * our visits never inflate a prospect's view analytics. */
function isInternal(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((c) => c.trim() === "autodeck_internal=1");
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: { id?: string; event?: string; currentTime?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.id || !body.event) {
    return NextResponse.json({ ok: false, error: "missing id/event" }, { status: 400 });
  }

  if (isInternal(req.headers.get("cookie"))) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ua = req.headers.get("user-agent") ?? "";

  await appendEvent("views", {
    prospectId: body.id,
    event: body.event,
    currentTime: typeof body.currentTime === "number" ? body.currentTime : 0,
    viewer: viewerHash(ip, ua),
  });

  return NextResponse.json({ ok: true });
}
