import { NextResponse } from "next/server";
import { getJuryRun } from "@/lib/jury-cache";

export const dynamic = "force-dynamic";

/**
 * Agentic-layer seam for the landing graph. Given a company name, returns the
 * pre-baked run (real Sillage org + FullEnrich contact) when it's a cached jury
 * company, so the graph animates REAL data. A miss returns { hit: false } and the
 * client falls back to the scripted demo run.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const company = new URL(req.url).searchParams.get("company")?.trim() ?? "";
  if (!company) {
    return NextResponse.json({ hit: false, error: "missing company" }, { status: 400 });
  }
  const run = getJuryRun(company);
  return NextResponse.json(run ? { hit: true, run } : { hit: false });
}
