// Mode + tuning knobs. An adapter runs `real` only when its key/URL is present; otherwise
// `mock`. This is the mocks-first guarantee (AGENTS.md): the whole layer runs with zero keys.

export type Mode = "real" | "mock";

export function sillageMode(): Mode {
  return process.env.SILLAGE_MCP_URL ? "real" : "mock";
}

export function fullenrichMode(): Mode {
  return process.env.FULLENRICH_API_KEY ? "real" : "mock";
}

export function llmMode(): Mode {
  return process.env.ANTHROPIC_API_KEY ? "real" : "mock";
}

/** Model id is passed through to Anthropic unchecked — keep it as config, not a constant. */
export const MODEL = process.env.AUTODECK_MODEL ?? "claude-sonnet-5";

/** Where per-prospect state + logs are written. Default = repo-root data/ (the lane contract). */
export const DATA_DIR = process.env.AUTODECK_DATA_DIR ?? "data";

/** Every external call is time-boxed to this many ms, then falls back to a mock. */
export const TIMEOUT_MS = Number(process.env.AUTODECK_TIMEOUT_MS ?? 8000);
