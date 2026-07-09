/**
 * Orchestrator: a jury member → a narrated, avatar-presented pitch video on disk.
 *
 *   1. Claude writes the four-beat personalized deck (mock fallback if keyless).
 *   2. Canvas renders each beat to a PNG.
 *   3. Gradium narrates each slide in the cloned voice (silent fallback).
 *   4. fal.ai renders one talking-head per slide, in parallel (slide-only fallback).
 *   5. ffmpeg assembles slides + avatar PIP + master VO into the final mp4.
 */
import "./env.js";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { OUT_DIR, CACHE_DIR, presenterPhoto } from "./env.js";
import { generateDeck } from "./llm.js";
import { renderSlides } from "./slides.js";
import { hasGradium, ttsToFile } from "./tts.js";
import { generateAvatars } from "./avatar.js";
import { assembleVideo } from "./assemble.js";
import { silentWav, mp4ToGif, posterFrame } from "./ffmpeg.js";
import type { JuryMember, PipelineResult } from "./types.js";

/** Silent-fallback duration when TTS is unavailable: ~2.7 words/second. */
const WORDS_PER_SEC = 2.7;

export interface ProgressEvent {
  step: string;
  detail?: string;
}
type OnProgress = (e: ProgressEvent) => void;

export async function runPipeline(
  jury: JuryMember,
  onProgress: OnProgress = () => {},
): Promise<PipelineResult> {
  const id = jury.id;
  const outDir = path.join(OUT_DIR, id);
  const slidesDir = path.join(outDir, "slides");
  const audioDir = path.join(outDir, "audio");
  const avatarDir = path.join(CACHE_DIR, "avatar", id);
  const workDir = path.join(outDir, "work");
  for (const d of [slidesDir, audioDir, avatarDir, workDir]) {
    await mkdir(d, { recursive: true });
  }

  onProgress({ step: "deck", detail: `writing pitch for ${jury.firstName} @ ${jury.company}` });
  const { deck, llmUsed } = await generateDeck(jury);

  onProgress({ step: "slides", detail: "rendering 4 slides" });
  const slidePngs = await renderSlides(deck, jury, slidesDir);

  onProgress({ step: "tts", detail: hasGradium() ? "cloned-voice narration" : "silent fallback" });
  const voWavs: string[] = [];
  let ttsUsed = hasGradium();
  for (let i = 0; i < deck.slides.length; i++) {
    const line = deck.slides[i]!.voiceover;
    const wav = path.join(audioDir, `vo-${i}.wav`);
    if (hasGradium()) {
      try {
        await ttsToFile(line, wav);
      } catch (err) {
        ttsUsed = false;
        onProgress({ step: "tts", detail: `TTS failed, silent fallback: ${String((err as Error).message)}` });
        await silentWav(line.trim().split(/\s+/).length / WORDS_PER_SEC, wav);
      }
    } else {
      await silentWav(line.trim().split(/\s+/).length / WORDS_PER_SEC, wav);
    }
    voWavs.push(wav);
  }

  onProgress({ step: "avatar", detail: "talking-head per slide (parallel)" });
  const avatarJobs = voWavs.map((audioPath, i) => ({
    audioPath,
    outPath: path.join(avatarDir, `avatar-${i}.mp4`),
  }));
  const avatars = await generateAvatars(presenterPhoto(), avatarJobs);
  const avatarUsed = avatars.some((a) => a !== null);

  onProgress({ step: "assemble", detail: "slides + avatar PIP + master VO" });
  const mp4 = path.join(outDir, `${id}.mp4`);
  const { durationSeconds, voDurations } = await assembleVideo({
    segments: slidePngs.map((slidePng, i) => ({
      slidePng,
      avatarMp4: avatars[i] ?? null,
      voWav: voWavs[i]!,
    })),
    workDir,
    outMp4: mp4,
  });

  const poster = path.join(outDir, `${id}.jpg`);
  const gif = path.join(outDir, `${id}.gif`);
  await posterFrame(mp4, poster);
  await mp4ToGif(mp4, gif);
  await rm(workDir, { recursive: true, force: true });

  onProgress({ step: "done", detail: `${durationSeconds.toFixed(1)}s → ${mp4}` });
  return {
    id,
    juryMember: jury,
    deck,
    mp4,
    poster,
    gif,
    durationSeconds: Number(durationSeconds.toFixed(3)),
    voDurations: voDurations.map((d) => Number(d.toFixed(3))),
    avatarUsed,
    ttsUsed,
    llmUsed,
  };
}
