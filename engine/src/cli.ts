/**
 * CLI entry: pick a jury member and run the full pipeline to an mp4.
 *
 *   npm run generate                 # first member in engine/data/jury.sample.json
 *   npm run generate -- <id>         # member by id
 *   npm run generate -- ./path.json  # a single member object or an array (first used)
 */
import "./env.js";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ENGINE_DIR, ROOT } from "./env.js";
import { JuryMemberSchema } from "./types.js";
import type { JuryMember } from "./types.js";
import { runPipeline } from "./pipeline.js";
import type { ProgressEvent } from "./pipeline.js";

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

/**
 * Job-file mode (set via JOB_FILE): the process is a detached worker spawned by
 * POST /api/generate. It streams progress into the shared JSON file and, on
 * success, publishes the video into public/videos so the web app can serve it.
 */
type JobStatus = "running" | "done" | "error";

interface JobStepRecord {
  step: string;
  detail: string;
  at: string;
}

interface JobRecord {
  jobId: string;
  prospectId: string;
  status: JobStatus;
  steps: JobStepRecord[];
  deck?: unknown;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

async function readJobRecord(file: string): Promise<JobRecord> {
  return JSON.parse(await readFile(file, "utf8")) as JobRecord;
}

async function appendJobStep(file: string, e: ProgressEvent): Promise<void> {
  const job = await readJobRecord(file);
  job.steps.push({ step: e.step, detail: e.detail ?? "", at: new Date().toISOString() });
  await writeFile(file, JSON.stringify(job, null, 2), "utf8");
}

async function runJobMode(arg: string | undefined, jobFile: string): Promise<void> {
  // Serialize file writes: onProgress fires synchronously, so chain the async
  // read-modify-writes to avoid interleaved reads dropping steps.
  let stepChain: Promise<void> = Promise.resolve();
  const onProgress = (e: ProgressEvent): void => {
    stepChain = stepChain.then(() => appendJobStep(jobFile, e)).catch(() => {});
  };

  try {
    const jury = await resolveMember(arg);
    const result = await runPipeline(jury, onProgress);
    await stepChain;

    const publicVideos = path.join(ROOT, "public", "videos");
    await mkdir(publicVideos, { recursive: true });
    await copyFile(result.mp4, path.join(publicVideos, `${result.id}.mp4`));
    await copyFile(result.poster, path.join(publicVideos, `${result.id}.jpg`));

    const job = await readJobRecord(jobFile);
    job.status = "done";
    job.deck = result.deck;
    job.videoUrl = `/videos/${result.id}.mp4`;
    await writeFile(jobFile, JSON.stringify(job, null, 2), "utf8");
  } catch (err) {
    await stepChain.catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    try {
      const job = await readJobRecord(jobFile);
      job.status = "error";
      job.error = message;
      await writeFile(jobFile, JSON.stringify(job, null, 2), "utf8");
    } catch {
      /* job file unreadable — nothing more we can do */
    }
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const jobFile = process.env.JOB_FILE;
  if (jobFile) {
    await runJobMode(arg, jobFile);
    return;
  }

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
