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

function parsePresenter(value: unknown): Presenter {
  return value === "edouard" || value === "mathis" ? value : "tom";
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
