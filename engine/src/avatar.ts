/**
 * fal.ai talking-head client — ported from Diffender's fal.ts (VEED Fabric 1.0 at
 * 480p). One image + one short VO wav → a lip-synced mp4. Because each slide's
 * narration is short, we generate one avatar PER slide IN PARALLEL, which stays
 * well under Fabric's ~30s audio cap and cuts wall-clock.
 *
 * PAID-CALL DISCIPLINE: a successful mp4 is cached by outPath; a failure is
 * cached as <out>.error.json. Re-runs never repeat a call that already
 * succeeded or failed. A failed / keyless slide simply degrades to slide-only
 * (no PIP) — the pipeline never blocks on the avatar.
 */
import "./env.js";
import { fal } from "@fal-ai/client";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { File } from "node:buffer";
import path from "node:path";

const MODEL = "veed/fabric-1.0";

export function hasFal(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

let configured = false;
function configureFal(): void {
  if (configured) return;
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY missing");
  fal.config({ credentials: key });
  configured = true;
}

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
}

async function uploadToFal(localPath: string): Promise<string> {
  const buf = await readFile(localPath);
  const file = new File([buf], path.basename(localPath), { type: mimeFor(localPath) });
  return fal.storage.upload(file as unknown as Blob);
}

function parseFalVideo(data: unknown): string {
  const d = data as { video?: { url?: string } };
  if (!d?.video?.url) {
    throw new Error(`fal ${MODEL} returned no video URL: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return d.video.url;
}

async function talkingHead(imagePath: string, audioPath: string, outPath: string): Promise<void> {
  configureFal();
  const imageUrl = await uploadToFal(imagePath);
  const audioUrl = await uploadToFal(audioPath);
  const result = await fal.subscribe(MODEL, {
    input: { image_url: imageUrl, audio_url: audioUrl, resolution: "480p" },
    logs: true,
    onQueueUpdate: (update) => {
      console.error(`[fal] ${path.basename(outPath)}: ${update.status}`);
    },
  });
  const videoUrl = parseFalVideo(result.data);
  const vRes = await fetch(videoUrl);
  if (!vRes.ok) throw new Error(`fal video download failed: ${vRes.status}`);
  await writeFile(outPath, Buffer.from(await vRes.arrayBuffer()));
}

/** One gated avatar call. Returns the mp4 path, or null if keyless / cached-fail / errored. */
async function gatedAvatar(
  imagePath: string,
  audioPath: string,
  outPath: string,
): Promise<string | null> {
  const errPath = outPath.replace(/\.mp4$/, ".error.json");
  if (existsSync(outPath)) return outPath;
  if (existsSync(errPath)) {
    console.error(`[fal] cached failure for ${path.basename(outPath)} — skipping`);
    return null;
  }
  try {
    await talkingHead(imagePath, audioPath, outPath);
    return outPath;
  } catch (err) {
    await writeFile(errPath, JSON.stringify({ message: String((err as Error).message ?? err) }));
    console.error(`[fal] FAILED ${path.basename(outPath)}: ${String((err as Error).message ?? err)}`);
    return null;
  }
}

export interface AvatarJob {
  audioPath: string;
  outPath: string;
}

/**
 * Generate one talking-head clip per job, in parallel. Each element of the
 * result aligns with the input jobs; null means "no avatar for this slide".
 */
export async function generateAvatars(
  imagePath: string,
  jobs: AvatarJob[],
): Promise<(string | null)[]> {
  if (!hasFal() || !existsSync(imagePath)) {
    if (!existsSync(imagePath)) console.error(`[fal] presenter photo missing: ${imagePath}`);
    return jobs.map(() => null);
  }
  return Promise.all(jobs.map((j) => gatedAvatar(imagePath, j.audioPath, j.outPath)));
}
