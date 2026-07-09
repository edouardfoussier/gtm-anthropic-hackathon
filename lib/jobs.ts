import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File-backed job store for the video-generation pipeline. One JSON file per
 * job under data/jobs/. The API route writes the initial record and the engine
 * (spawned detached) reads-modifies-writes the same file as it makes progress —
 * so no DB and no shared memory is needed across the two processes.
 */
export type JobStatus = "running" | "done" | "error";

export interface JobStep {
  step: string;
  detail: string;
  at: string;
}

export interface Job {
  jobId: string;
  prospectId: string;
  status: JobStatus;
  steps: JobStep[];
  /** The generated deck (engine `Deck`). Unknown here — parsed at the UI boundary. */
  deck?: unknown;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

/** Absolute path to a job's JSON file. Handed to the engine via the JOB_FILE env var. */
export function jobPath(jobId: string): string {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

export async function writeJob(job: Job): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true });
  await writeFile(jobPath(job.jobId), JSON.stringify(job, null, 2), "utf8");
}

export async function readJob(jobId: string): Promise<Job | null> {
  try {
    const raw = await readFile(jobPath(jobId), "utf8");
    return JSON.parse(raw) as Job;
  } catch {
    return null;
  }
}
