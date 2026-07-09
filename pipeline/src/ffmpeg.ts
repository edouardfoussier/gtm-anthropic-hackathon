/**
 * Thin wrappers around the local ffmpeg / ffprobe binaries plus the small helpers
 * every stage shares. All filtergraph conventions (concat FILTER, per-input
 * `setsar=1` + `yuv420p` normalization, the zoompan single-frame rule) are ported
 * from the proven Diffender assembly pipeline.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexecFile = promisify(execFile);

/** 64 MB is enough for ffmpeg's stderr chatter on a minute-long render. */
const MAX_BUFFER = 64 * 1024 * 1024;

export const VIDEO_W = 1920;
export const VIDEO_H = 1080;
export const FPS = 30;
/** Trailing pad (s) appended to every VO clip so cuts never clip the last word. */
export const TAIL = 0.4;
/** Neutral dark letterbox color for any padding. */
export const PAD_COLOR = "0x0a0a0f";

export async function ff(args: string[]): Promise<void> {
  await pexecFile("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
    maxBuffer: MAX_BUFFER,
  });
}

export async function probeDuration(input: string): Promise<number> {
  const { stdout } = await pexecFile("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    input,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

/** N seconds of silent mono WAV — the TTS fallback when Gradium is unavailable. */
export async function silentWav(secs: number, outWav: string): Promise<void> {
  await ff([
    "-y", "-f", "lavfi", "-t", secs.toFixed(3),
    "-i", "anullsrc=r=48000:cl=mono",
    "-ar", "48000", "-ac", "1",
    outWav,
  ]);
}

/** 480px-wide palette GIF preview (for quick sharing / X posts). */
export async function mp4ToGif(mp4: string, outGif: string): Promise<void> {
  await ff([
    "-y", "-i", mp4,
    "-vf",
    "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
    outGif,
  ]);
}

/** Single poster frame (jpg) grabbed a beat into the video. */
export async function posterFrame(mp4: string, outJpg: string, at = 0.8): Promise<void> {
  await ff([
    "-y", "-ss", at.toFixed(3), "-i", mp4,
    "-frames:v", "1", "-q:v", "3",
    outJpg,
  ]);
}
