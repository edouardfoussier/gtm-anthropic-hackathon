import { getAllProspects } from "@/lib/prospects";

/**
 * CRM overlay on top of the raw prospect list: which accounts are hot, why, and
 * what pipeline stage they sit in. Keyed by prospect id so it merges cleanly
 * with getAllProspects(). Deel's signal is a REAL Sillage keyword-detection hit
 * (CEO Alex Bouaziz publicly hiring / $15M founder tournament); the rest seed a
 * believable pipeline for the demo.
 */
export interface LeadMeta {
  hot: boolean;
  signal: string;
  stage: string;
}

const DEFAULT_STAGE = "New";

export const LEAD_META: Record<string, LeadMeta> = {
  "ido-kissos": {
    hot: true,
    signal:
      "Deel is scaling GTM hard — CEO Alex Bouaziz is publicly hiring across sales and just launched a $15M founder tournament",
    stage: "Hot lead",
  },
  "elizabeth-coleon": {
    hot: true,
    signal: "Photoroom expanding its GTM motion — actively evaluating tooling",
    stage: "Hot lead",
  },
  "benjamin-douablin": { hot: false, signal: "", stage: "Contacted" },
  "deeni-fatiha": { hot: false, signal: "", stage: "Nurturing" },
  "constance-grisoni": { hot: false, signal: "", stage: "New" },
  "arnaud-weiss": { hot: false, signal: "", stage: "Contacted" },
  "vincent-gonnot": { hot: false, signal: "", stage: "Contacted" },
  "carole-offredo": { hot: false, signal: "", stage: "New" },
};

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  hot: boolean;
  signal: string;
  stage: string;
}

export async function getLeads(): Promise<Lead[]> {
  const prospects = await getAllProspects();

  const leads: Lead[] = prospects.map((prospect) => {
    const meta = LEAD_META[prospect.id];
    return {
      id: prospect.id,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      company: prospect.company,
      hot: meta?.hot ?? false,
      signal: meta?.signal ?? "",
      stage: meta?.stage ?? DEFAULT_STAGE,
    };
  });

  return leads.sort((a, b) => {
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    // Push nameless accounts to the bottom so the table reads clean.
    if (!a.company) return b.company ? 1 : 0;
    if (!b.company) return -1;
    return a.company.localeCompare(b.company);
  });
}
