import { NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";

// Always fresh — the reach-out flow polls this for live pipeline progress.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;
  const job = await readJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
