/**
 * Video assembly. Per slide: a static card (subtle fade) with the avatar composited
 * as a rounded bottom-right PIP; the card dwells for its voiceover + a short tail.
 * Segments are concatenated with the concat FILTER (re-encode, per-input
 * `setsar=1` + `yuv420p` normalization), then a master VO track — each clip padded
 * with the same tail so audio and video stay frame-aligned — is muxed over the top.
 *
 * Conventions ported verbatim from Diffender's assembly pipeline, incl. the
 * deliberate choice NOT to use `-shortest` at mux time (it truncates the outro).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  ff,
  probeDuration,
  FPS,
  TAIL,
  VIDEO_W,
  VIDEO_H,
  PAD_COLOR,
} from "./ffmpeg.js";

const PIP_W = 384; // 20% of 1920
const PIP_MARGIN = 40;
const PIP_RADIUS = 28;

/** Rounded-rect alpha mask applied to the already-scaled avatar stream. */
const ROUNDED =
  `format=yuva420p,geq=lum='p(X,Y)':a='if(gt(abs(W/2-X),W/2-${PIP_RADIUS})*gt(abs(H/2-Y),H/2-${PIP_RADIUS}),` +
  `if(lte(hypot(W/2-${PIP_RADIUS}-abs(W/2-X),H/2-${PIP_RADIUS}-abs(H/2-Y)),${PIP_RADIUS}),255,0),255)'`;
const PIP_POS = `x=main_w-overlay_w-${PIP_MARGIN}:y=main_h-overlay_h-${PIP_MARGIN}`;

const FIT = `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=decrease,pad=${VIDEO_W}:${VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=${PAD_COLOR}`;

function fades(dwell: number): { fadeDur: number; fadeOutStart: number } {
  const fadeDur = Math.min(0.4, dwell / 4);
  return { fadeDur, fadeOutStart: Math.max(0, dwell - fadeDur) };
}

/** Subtle Ken-Burns zoom (1.0 → KEN_BURNS_ZOOM) over the light theme. */
const KEN_BURNS_ZOOM = 1.06;

/** Build one slide segment (video only) of `dwell` seconds. */
async function slideSegment(
  slidePng: string,
  avatarMp4: string | null,
  dwell: number,
  outMp4: string,
): Promise<void> {
  const { fadeDur, fadeOutStart } = fades(dwell);
  // Fade through WHITE (not black): a black dip flickers on a light theme.
  const fade =
    `fade=t=in:st=0:d=${fadeDur.toFixed(3)}:color=white,` +
    `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDur.toFixed(3)}:color=white`;

  if (!avatarMp4) {
    // Ken-Burns: feed the still as ONE frame (no -loop/-t); zoompan's `d` drives
    // the exact frame count — a looped input makes zoompan emit d frames PER input
    // frame and hang.
    const frames = Math.max(1, Math.round(dwell * FPS));
    const zStep = ((KEN_BURNS_ZOOM - 1) / Math.max(1, frames - 1)).toFixed(6);
    const vf =
      `zoompan=z='min(zoom+${zStep},${KEN_BURNS_ZOOM})':` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
      `d=${frames}:s=${VIDEO_W}x${VIDEO_H}:fps=${FPS},${fade},setsar=1,format=yuv420p`;
    await ff([
      "-y", "-i", slidePng,
      "-vf", vf, "-r", String(FPS),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
      outMp4,
    ]);
    return;
  }

  // Slide background + rounded avatar PIP; fade the composited frame so both fade together.
  const filter =
    `[0:v]${FIT},fps=${FPS},setsar=1,format=yuv420p[bg];` +
    `[1:v]scale=${PIP_W}:-2,${ROUNDED},setpts=PTS-STARTPTS[av];` +
    `[bg][av]overlay=${PIP_POS}:format=auto,${fade},format=yuv420p[outv]`;
  await ff([
    "-y", "-loop", "1", "-t", dwell.toFixed(3), "-i", slidePng, "-i", avatarMp4,
    "-filter_complex", filter, "-map", "[outv]", "-t", dwell.toFixed(3), "-r", String(FPS),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
    outMp4,
  ]);
}

/** Concat normalized segments (video only) via the concat filter. */
async function concatSegments(segs: string[], outMp4: string): Promise<void> {
  const inputs: string[] = [];
  for (const s of segs) inputs.push("-i", s);
  const norm = (i: number) =>
    `[${i}:v]${FIT},fps=${FPS},setsar=1,format=yuv420p[v${i}]`;
  const chains = segs.map((_, i) => norm(i)).join(";");
  const labels = segs.map((_, i) => `[v${i}]`).join("");
  const filter = `${chains};${labels}concat=n=${segs.length}:v=1:a=0[outv]`;
  await ff([
    "-y", ...inputs,
    "-filter_complex", filter, "-map", "[outv]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-movflags", "+faststart",
    outMp4,
  ]);
}

/** Master VO wav: each clip + TAIL of trailing silence so it aligns with the visuals. */
async function buildMasterAudio(wavs: string[], work: string, outWav: string): Promise<void> {
  const padded: string[] = [];
  for (let i = 0; i < wavs.length; i++) {
    const p = path.join(work, `a_pad_${i}.wav`);
    await ff([
      "-y", "-i", wavs[i]!,
      "-af", `aresample=48000,apad=pad_dur=${TAIL}`,
      "-ar", "48000", "-ac", "1",
      p,
    ]);
    padded.push(p);
  }
  const inputs: string[] = [];
  for (const p of padded) inputs.push("-i", p);
  const labels = padded.map((_, i) => `[${i}:a]`).join("");
  await ff([
    "-y", ...inputs,
    "-filter_complex", `${labels}concat=n=${padded.length}:v=0:a=1[outa]`,
    "-map", "[outa]", "-ar", "48000", "-ac", "1",
    outWav,
  ]);
}

/** Mux master audio over the concatenated video. No `-shortest` (it clips the outro). */
async function muxAV(video: string, audio: string, outMp4: string): Promise<void> {
  await ff([
    "-y", "-i", video, "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    outMp4,
  ]);
}

export interface SegmentInput {
  slidePng: string;
  avatarMp4: string | null;
  voWav: string;
}

export interface AssembleResult {
  durationSeconds: number;
  voDurations: number[];
}

export async function assembleVideo(opts: {
  segments: SegmentInput[];
  workDir: string;
  outMp4: string;
}): Promise<AssembleResult> {
  const { segments, workDir, outMp4 } = opts;
  await mkdir(workDir, { recursive: true });

  const voDurations: number[] = [];
  for (const s of segments) voDurations.push(await probeDuration(s.voWav));
  const dwell = voDurations.map((d) => d + TAIL);

  const segMp4s: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const segOut = path.join(workDir, `seg-${i}.mp4`);
    await slideSegment(seg.slidePng, seg.avatarMp4, dwell[i]!, segOut);
    segMp4s.push(segOut);
  }

  const concatMp4 = path.join(workDir, "concat.mp4");
  await concatSegments(segMp4s, concatMp4);

  const masterWav = path.join(workDir, "master.wav");
  await buildMasterAudio(
    segments.map((s) => s.voWav),
    workDir,
    masterWav,
  );

  await muxAV(concatMp4, masterWav, outMp4);
  const durationSeconds = await probeDuration(outMp4);
  return { durationSeconds, voDurations };
}
