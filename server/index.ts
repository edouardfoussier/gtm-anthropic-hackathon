/**
 * Standalone AutoDeck video-engine API.
 *
 * Runs the exact same `runPipeline` the CLI uses, but as a long-lived HTTP
 * service on a real machine (a GCE VM) that has ffmpeg + a writable filesystem.
 * The Next.js app forwards generation requests here when ENGINE_API_URL is set;
 * serverless/Workers cannot host this (no ffmpeg, no persistent disk).
 *
 * Zero extra dependencies on purpose: only node:http, so `npx tsx server/index.ts`
 * boots with nothing beyond what the engine already needs. Job state is in-memory
 * (single-process demo box); a restart drops history, which is fine for the hack.
 *
 *   GET  /health            → { ok: true }
 *   POST /generate          → { jobId }              (202, fire-and-forget)
 *   GET  /jobs/:jobId        → Job JSON | 404
 *   GET  /videos/:file       → streams engine/out/<stem>/<file> | 404
 */
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../engine/src/pipeline.js";
import type { ProgressEvent } from "../engine/src/pipeline.js";
import { JuryMemberSchema } from "../engine/src/types.js";
import type { JuryMember, PipelineResult } from "../engine/src/types.js";
import { ENGINE_DIR, OUT_DIR } from "../engine/src/env.js";

const PORT = Number(process.env.PORT) || 8787;
const JURY_DATA = path.join(ENGINE_DIR, "data", "jury.json");

/** Content types we are willing to stream out of the engine's out/ dir. */
const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

type JobStatus = "running" | "done" | "error";

interface JobStep {
  step: string;
  detail: string;
  at: string;
}

/** Mirrors lib/jobs.ts `Job` so the frontend poller sees an identical shape. */
interface Job {
  jobId: string;
  prospectId: string;
  status: JobStatus;
  steps: JobStep[];
  deck?: unknown;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

const jobs = new Map<string, Job>();

function logEvent(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
}

/** Same lookup as engine/src/cli.ts: parse jury.json, find the member by id. */
async function resolveJuryMember(prospectId: string): Promise<JuryMember> {
  const raw: unknown = JSON.parse(await readFile(JURY_DATA, "utf8"));
  const arr = Array.isArray(raw) ? raw : [raw];
  const members = arr.map((m) => JuryMemberSchema.parse(m));
  const found = members.find((m) => m.id === prospectId);
  if (!found) throw new Error(`no jury member with id "${prospectId}" in ${JURY_DATA}`);
  return found;
}

async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "bad json" });
    return;
  }
  if (typeof body !== "object" || body === null) {
    sendJson(res, 400, { error: "bad body" });
    return;
  }

  const record = body as Record<string, unknown>;
  const prospectId = typeof record.prospectId === "string" ? record.prospectId.trim() : "";
  if (!prospectId) {
    sendJson(res, 400, { error: "missing prospectId" });
    return;
  }
  const voiceId = typeof record.voiceId === "string" ? record.voiceId.trim() : "";

  let jury: JuryMember;
  try {
    jury = await resolveJuryMember(prospectId);
  } catch (err) {
    sendJson(res, 404, { error: err instanceof Error ? err.message : String(err) });
    return;
  }

  // Cloned-voice selection is a process-global env read inside the pipeline's TTS
  // step. Single-box demo, so overwriting it per request is acceptable; concurrent
  // jobs with different voices are not supported.
  if (voiceId) process.env.GRADIUM_VOICE_ID = voiceId;

  const jobId = `${prospectId}-${Date.now().toString(36)}`;
  const job: Job = {
    jobId,
    prospectId,
    status: "running",
    steps: [],
    createdAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);

  const onProgress = (e: ProgressEvent): void => {
    job.steps.push({ step: e.step, detail: e.detail ?? "", at: new Date().toISOString() });
  };

  const startedAt = Date.now();
  logEvent("job_start", { job_id: jobId, prospect_id: prospectId });

  // Fire-and-forget: the pipeline runs for minutes; the client polls /jobs/:jobId.
  runPipeline(jury, onProgress)
    .then((result: PipelineResult) => {
      job.status = "done";
      job.deck = result.deck;
      job.videoUrl = `/videos/${result.id}.mp4`;
      logEvent("job_done", { job_id: jobId, duration_ms: Date.now() - startedAt });
    })
    .catch((err: unknown) => {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
      logEvent("job_error", { job_id: jobId, duration_ms: Date.now() - startedAt, error: job.error });
    });

  sendJson(res, 202, { jobId });
}

async function handleVideo(res: ServerResponse, requested: string): Promise<void> {
  const file = path.basename(requested);
  const ext = path.extname(file).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  const stem = path.basename(file, ext);
  const filePath = path.resolve(OUT_DIR, stem, file);
  // Defense in depth: the resolved path must stay inside OUT_DIR.
  if (filePath !== path.join(OUT_DIR, stem, file)) {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": String(info.size) });
    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) sendJson(res, 500, { error: "read error" });
      else res.destroy();
    });
    stream.pipe(res);
  } catch {
    // Diagnostic: surface the exact path we tried so a 404 on an existing file is debuggable.
    logEvent("video_miss", { requested, file_path: filePath, out_dir: OUT_DIR });
    sendJson(res, 404, { error: "not found" });
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  if (method === "POST" && pathname === "/generate") {
    await handleGenerate(req, res);
    return;
  }
  if (method === "GET" && pathname.startsWith("/jobs/")) {
    const jobId = decodeURIComponent(pathname.slice("/jobs/".length));
    const job = jobs.get(jobId);
    if (!job) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    sendJson(res, 200, job);
    return;
  }
  if (method === "GET" && pathname.startsWith("/videos/")) {
    await handleVideo(res, decodeURIComponent(pathname.slice("/videos/".length)));
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

const server = createServer((req, res) => {
  void route(req, res).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logEvent("request_error", { error: message });
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.destroy();
  });
});

server.listen(PORT, () => {
  logEvent("server_start", { port: PORT, out_dir: OUT_DIR });
});
