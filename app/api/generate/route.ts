import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { jobPath, writeJob } from "@/lib/jobs";

/**
 * Kicks off a personalized video generation. Writes a "running" job record, then
 * spawns the engine CLI DETACHED so it survives the client navigating away. The
 * engine reports progress back into the job file (JOB_FILE); the client polls
 * GET /api/generate/[jobId]. FAL_KEY is cleared → slides-only (no avatar), per
 * the current product decision.
 */
type Presenter = "tom" | "edouard" | "mathis";

/** Give up on the remote engine's fast 202 ack after this — it must not hang the route. */
const REMOTE_ACK_TIMEOUT_MS = 10_000;

function parsePresenter(value: unknown): Presenter {
  return value === "edouard" || value === "mathis" ? value : "tom";
}

/** Forward the generation request to a remote engine host and relay its `{ jobId }` ack. */
async function forwardToEngine(
  engineApiUrl: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_ACK_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${engineApiUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "engine error" }, { status: 502 });
    }
    const data: unknown = await upstream.json();
    const jobId =
      typeof data === "object" && data !== null && typeof (data as Record<string, unknown>).jobId === "string"
        ? ((data as Record<string, unknown>).jobId as string)
        : "";
    if (!jobId) {
      return NextResponse.json({ error: "engine error" }, { status: 502 });
    }
    return NextResponse.json({ jobId });
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const prospectId = typeof record.prospectId === "string" ? record.prospectId.trim() : "";
  if (!prospectId) {
    return NextResponse.json({ error: "missing prospectId" }, { status: 400 });
  }

  // Remote engine (e.g. a GCE VM running server/index.ts): the video pipeline
  // needs ffmpeg + a writable filesystem, which serverless/Workers cannot offer.
  // When ENGINE_API_URL is set, delegate generation to that host and relay its ack.
  // TODO: remote jobs are polled at `${ENGINE_API_URL}/jobs/{jobId}` and the video
  //       is served from `${ENGINE_API_URL}/videos/{id}.mp4` — the client poller
  //       must target the remote host, not the local job file, in this mode.
  const engineApiUrl = process.env.ENGINE_API_URL?.trim();
  if (engineApiUrl) {
    return forwardToEngine(engineApiUrl, record);
  }

  const presenter = parsePresenter(record.presenter);

  const jobId = `${prospectId}-${Date.now().toString(36)}`;
  await writeJob({
    jobId,
    prospectId,
    status: "running",
    steps: [],
    createdAt: new Date().toISOString(),
  });

  const voiceByPresenter: Record<Presenter, string> = {
    tom: process.env.GRADIUM_VOICE_ID ?? "",
    edouard: process.env.EDOUARD_VOICE_ID ?? "",
    mathis: process.env.MATHIS_VOICE_ID ?? "",
  };

  const child = spawn("npx", ["tsx", "engine/src/cli.ts", prospectId], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      JOB_FILE: jobPath(jobId),
      GRADIUM_VOICE_ID: voiceByPresenter[presenter] || (process.env.GRADIUM_VOICE_ID ?? ""),
      FAL_KEY: "",
      AUTODECK_PRESENTER: "",
    },
  });
  child.unref();

  return NextResponse.json({ jobId });
}
