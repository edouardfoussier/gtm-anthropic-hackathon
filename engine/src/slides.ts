/**
 * Slide renderer. Draws each of the four beats to a 1920x1080 PNG with
 * @napi-rs/canvas — a native binding, no browser, deterministic and instant.
 * Light premium theme, one electric-blue accent. Text is left-aligned and width-
 * capped so it never collides with the avatar PIP that lands bottom-right.
 */
import "./env.js";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { VIDEO_W, VIDEO_H } from "./ffmpeg.js";
import type { Deck, JuryMember, Slide, SlideKind } from "./types.js";

const ACCENT = "#2563EB";
const INK = "#0F172A";
const MUTE = "#475569";
const FAINT = "#94A3B8";
const PAD = 150;
/** Keep text clear of the bottom-right avatar PIP zone. */
const TEXT_MAX_W = 1320;
const FONT = '"Helvetica Neue", "Helvetica", "Arial"';

function kicker(kind: SlideKind, j: JuryMember): string {
  switch (kind) {
    case "intro":
      return `FOR ${j.company.toUpperCase()}`;
    case "problem":
      return "THE PROBLEM";
    case "solution":
      return "THE SOLUTION";
    case "cta":
      return "LET'S TALK";
  }
}

function wrap(ctx: SKRSContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const lines = wrap(ctx, text, maxW);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

function drawDiamond(ctx: SKRSContext2D, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderSlide(slide: Slide, j: JuryMember): Buffer {
  const canvas = createCanvas(VIDEO_W, VIDEO_H);
  const ctx = canvas.getContext("2d");

  // Background: soft light gradient + faint accent glow top-left.
  const bg = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
  bg.addColorStop(0, "#FFFFFF");
  bg.addColorStop(1, "#EEF2FF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  const glow = ctx.createRadialGradient(340, 210, 40, 340, 210, 720);
  glow.addColorStop(0, "rgba(37,99,235,0.14)");
  glow.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Brand mark: drawn diamond + wordmark (avoids missing-glyph tofu).
  drawDiamond(ctx, PAD + 15, 116, 26);
  ctx.fillStyle = ACCENT;
  ctx.font = `600 38px ${FONT}`;
  ctx.fillText("AutoDeck", PAD + 44, 130);

  // Kicker.
  ctx.fillStyle = ACCENT;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(spaced(kicker(slide.kind, j)), PAD, 396);

  // Headline.
  ctx.fillStyle = INK;
  ctx.font = `800 104px ${FONT}`;
  const afterHead = drawWrapped(ctx, slide.headline, PAD, 500, TEXT_MAX_W, 118);

  // Subtext.
  ctx.fillStyle = MUTE;
  ctx.font = `400 46px ${FONT}`;
  const afterSub = drawWrapped(ctx, slide.subtext, PAD, afterHead + 44, TEXT_MAX_W, 62);

  // CTA slide gets an accent pill.
  if (slide.kind === "cta") {
    const label = "Be called back";
    ctx.font = `700 40px ${FONT}`;
    const ph = 96;
    const py = afterSub + 40;
    const iconR = 13;
    const gap = 26;
    const tw = ctx.measureText(label).width;
    const padX = 52;
    const pw = padX + iconR * 2 + gap + tw + padX;
    ctx.fillStyle = ACCENT;
    roundedRect(ctx, PAD, py, pw, ph, ph / 2);
    ctx.fill();
    // Small phone dot as the call-back cue.
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(PAD + padX + iconR, py + ph / 2, iconR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(label, PAD + padX + iconR * 2 + gap, py + ph / 2 + 14);
  }

  // Footer.
  ctx.fillStyle = FAINT;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText("AutoDeck · Agentic GTM Hackathon", PAD, VIDEO_H - 90);

  return canvas.toBuffer("image/png");
}

/** Insert thin spaces between characters for a tracked, editorial kicker. */
function spaced(s: string): string {
  return s.split("").join(" ");
}

export async function renderSlides(
  deck: Deck,
  jury: JuryMember,
  outDir: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    if (!slide) continue;
    const out = path.join(outDir, `slide-${i}-${slide.kind}.png`);
    await writeFile(out, renderSlide(slide, jury));
    paths.push(out);
  }
  return paths;
}
