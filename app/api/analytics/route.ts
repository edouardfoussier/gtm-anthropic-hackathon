import { NextResponse } from "next/server";
import { computeStats } from "@/lib/analytics";

// Always fresh — the dashboard polls this for live view counts.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const stats = await computeStats(Date.now());
  return NextResponse.json({ stats, generatedAt: new Date().toISOString() });
}
