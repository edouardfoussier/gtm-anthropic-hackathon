// Sillage adapter — the "moment + people" source.
//
// Real Sillage is MCP-only (no REST API). The client lives in `@ai-sdk/mcp` (NOT in `ai@7`),
// via the native streamable-HTTP transport `{ type: 'http', url, headers }`. That package is
// not installed yet and access is handed at kickoff, so the real branch is a clearly-marked
// insertion point that falls back to the mock. Flipping to real = install `@ai-sdk/mcp`,
// implement the marked block, set SILLAGE_MCP_URL. The mock keeps the demo alive meanwhile.

import { sillageMode } from "./config";
import { mockDataset } from "./mocks";
import { PersonSchema, SignalSchema, type Person, type Signal } from "./types";
import { z } from "zod";

const PeopleArray = z.array(PersonSchema);
const SignalArray = z.array(SignalSchema);

export async function getPeople(company: string): Promise<Person[]> {
  if (sillageMode() === "real") {
    try {
      // TODO(sillage): connect @ai-sdk/mcp createMCPClient({ transport: { type: 'http',
      //   url: process.env.SILLAGE_MCP_URL, headers } }), call the people tool, then:
      //   return PeopleArray.parse(mapped);   // Zod-parse at the boundary before trusting.
      throw new Error("Sillage MCP not wired yet");
    } catch (err) {
      console.warn(`[sillage] real people fetch failed (${(err as Error).message}) — using mock`);
    }
  }
  return PeopleArray.parse(mockDataset(company).people);
}

export async function getSignals(company: string): Promise<Signal[]> {
  if (sillageMode() === "real") {
    try {
      // TODO(sillage): same client, call the signals tool, then SignalArray.parse(mapped).
      throw new Error("Sillage MCP not wired yet");
    } catch (err) {
      console.warn(`[sillage] real signal fetch failed (${(err as Error).message}) — using mock`);
    }
  }
  return SignalArray.parse(mockDataset(company).signals);
}
