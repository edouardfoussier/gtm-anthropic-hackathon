import { NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";

// Always fresh — the reach-out flow polls this for live pipeline progress.
export const dynamic = "force-dynamic";

const REMOTE_TIMEOUT_MS = 10_000;

/** Proxy the job record from a remote engine host, rewriting videoUrl to absolute. */
async function fetchRemoteJob(engineApiUrl: string, jobId: string): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const res = await fetch(`${engineApiUrl}/jobs/${encodeURIComponent(jobId)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "engine error" }, { status: 502 });
    }
    const job = (await res.json()) as Record<string, unknown>;
    // The engine returns videoUrl as a path (/videos/x.mp4); make it absolute so
    // the browser loads it from the engine host, not the app origin.
    if (typeof job.videoUrl === "string" && job.videoUrl.startsWith("/")) {
      job.videoUrl = `${engineApiUrl}${job.videoUrl}`;
    }
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const engineApiUrl = process.env.ENGINE_API_URL?.trim().replace(/\/+$/, "");
  if (engineApiUrl) {
    return fetchRemoteJob(engineApiUrl, jobId);
  }

  const job = await readJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
