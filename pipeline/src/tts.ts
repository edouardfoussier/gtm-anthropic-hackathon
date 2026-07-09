/**
 * Gradium TTS client — ported from Diffender's gradium.ts. Cloned voice id comes
 * from GRADIUM_VOICE_ID. `ttsToFile(text, outPath)` writes a WAV; on a rejected
 * voice id it discovers a usable voice from the account list and retries once.
 * Throws if no key — the pipeline decides whether to fall back to silence.
 */
import "./env.js";
import { writeFile } from "node:fs/promises";

const GRADIUM_BASE = "https://api.gradium.ai";
const TTS_URL = `${GRADIUM_BASE}/api/post/speech/tts`;
const VOICES_URL = `${GRADIUM_BASE}/api/voices/`;
const FLAGSHIP_VOICE = "5gI6AfyZkgLWq5aL";

export function hasGradium(): boolean {
  return Boolean(process.env.GRADIUM_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.GRADIUM_API_KEY?.trim();
  if (!key) throw new Error("GRADIUM_API_KEY missing");
  return key;
}

function configuredVoiceId(): string {
  return process.env.GRADIUM_VOICE_ID?.trim() || FLAGSHIP_VOICE;
}

async function ttsOnce(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      output_format: "wav",
      only_audio: true,
      model_name: "default",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gradium TTS ${res.status}: ${body.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function pickEnglishVoiceId(): Promise<string> {
  const res = await fetch(VOICES_URL, { headers: { "x-api-key": apiKey() } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gradium voices ${res.status}: ${body.slice(0, 400)}`);
  }
  const data: unknown = await res.json();
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { voices?: unknown[] })?.voices)
      ? (data as { voices: unknown[] }).voices
      : Array.isArray((data as { data?: unknown[] })?.data)
        ? (data as { data: unknown[] }).data
        : [];
  const idOf = (v: unknown): string | undefined => {
    const o = v as { uid?: string; voice_id?: string; id?: string };
    return o?.uid ?? o?.voice_id ?? o?.id;
  };
  const isEnglish = (v: unknown): boolean => {
    const o = v as { language?: string; lang?: string; name?: string };
    const lang = String(o?.language ?? o?.lang ?? "").toLowerCase();
    const name = String(o?.name ?? "").toLowerCase();
    return lang.startsWith("en") || /english|\ben\b|emma/.test(name);
  };
  const english = list.find((v) => isEnglish(v) && idOf(v));
  const chosen = idOf(english) ?? list.map(idOf).find(Boolean);
  if (!chosen) throw new Error("Gradium voices: no usable voice id in list");
  return chosen;
}

export async function ttsToFile(text: string, outPath: string): Promise<void> {
  let buf: Buffer;
  try {
    buf = await ttsOnce(text, configuredVoiceId());
  } catch {
    const voiceId = await pickEnglishVoiceId();
    buf = await ttsOnce(text, voiceId);
  }
  await writeFile(outPath, buf);
}
