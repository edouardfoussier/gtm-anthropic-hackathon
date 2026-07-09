/**
 * CLI entry: pick a jury member and run the full pipeline to an mp4.
 *
 *   npm run generate                 # first member in engine/data/jury.sample.json
 *   npm run generate -- <id>         # member by id
 *   npm run generate -- ./path.json  # a single member object or an array (first used)
 */
import "./env.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ENGINE_DIR } from "./env.js";
import { JuryMemberSchema } from "./types.js";
import type { JuryMember } from "./types.js";
import { runPipeline } from "./pipeline.js";

const DEFAULT_DATA = path.join(ENGINE_DIR, "data", "jury.json");

async function loadMembers(source: string): Promise<JuryMember[]> {
  const raw: unknown = JSON.parse(await readFile(source, "utf8"));
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((m) => JuryMemberSchema.parse(m));
}

async function resolveMember(arg: string | undefined): Promise<JuryMember> {
  if (arg && (arg.endsWith(".json") || arg.includes("/"))) {
    if (!existsSync(arg)) throw new Error(`file not found: ${arg}`);
    const members = await loadMembers(arg);
    const first = members[0];
    if (!first) throw new Error(`no jury member in ${arg}`);
    return first;
  }
  const members = await loadMembers(DEFAULT_DATA);
  if (arg) {
    const found = members.find((m) => m.id === arg);
    if (!found) {
      throw new Error(`no jury member with id "${arg}" in ${DEFAULT_DATA}`);
    }
    return found;
  }
  const first = members[0];
  if (!first) throw new Error(`no jury members in ${DEFAULT_DATA}`);
  return first;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const jury = await resolveMember(arg);
  console.error(`▶ AutoDeck: generating for ${jury.firstName} ${jury.lastName} @ ${jury.company}\n`);

  const result = await runPipeline(jury, (e) => {
    console.error(`  · ${e.step}${e.detail ? ` — ${e.detail}` : ""}`);
  });

  console.log(
    JSON.stringify(
      {
        id: result.id,
        mp4: result.mp4,
        poster: result.poster,
        gif: result.gif,
        durationSeconds: result.durationSeconds,
        voDurations: result.voDurations,
        used: { llm: result.llmUsed, tts: result.ttsUsed, avatar: result.avatarUsed },
        deck: result.deck,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
