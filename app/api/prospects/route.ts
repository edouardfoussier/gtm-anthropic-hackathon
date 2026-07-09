import { NextResponse } from "next/server";
import { getAllProspects } from "@/lib/prospects";

/**
 * Exposes the jury prospect list (company name + id) so the client-side
 * search flow can detect when a typed company matches a real prospect and
 * route into the real pipeline (/reachout/[id]) instead of the mock queue.
 */
export async function GET(): Promise<NextResponse> {
  const prospects = await getAllProspects();
  return NextResponse.json({ prospects });
}
