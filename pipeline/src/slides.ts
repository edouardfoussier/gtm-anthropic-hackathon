/**
 * Slide renderer. Draws each of the four beats to a 1920x1080 PNG with
 * @napi-rs/canvas — native, no browser, deterministic. Light premium theme, one
 * electric-blue accent. Every slide shares a chrome (wordmark, kicker, headline,
 * subtext, footer with progress dots) plus one distinctive "hero" per beat:
 *   intro   → auto-generated meta badge
 *   problem → giant "45 min" stat
 *   solution→ three-step flow (signal → video → watching)
 *   cta     → call-back pill
 */
import "./env.js";
import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { VIDEO_W, VIDEO_H } from "./ffmpeg.js";
import { DATA_DIR } from "./env.js";
import type { Deck, JuryMember, Slide, SlideKind } from "./types.js";

const ACCENT = "#2563EB";
const ACCENT_SOFT = "#DBE4FF";
const INK = "#0F172A";
const MUTE = "#475569";
const FAINT = "#94A3B8";
const LINE = "#E2E8F0";
const PAD = 150;
const CONTENT_W = VIDEO_W - PAD * 2;
const FONT = '"Helvetica Neue", "Arial"';

/** Raster logo formats @napi-rs/canvas can decode (svg/avif are skipped). */
const LOGO_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Find data/<company>-logo.<ext> case/punctuation-insensitively. */
function findLogoFile(company: string): string | null {
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return null;
  let files: string[];
  try {
    files = readdirSync(DATA_DIR);
  } catch {
    return null;
  }
  for (const f of files) {
    if (!LOGO_EXTS.has(path.extname(f).toLowerCase())) continue;
    const norm = f.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm.includes("logo") && norm.includes(slug)) return path.join(DATA_DIR, f);
  }
  return null;
}

/** The target company's logo, decoded, or null (missing / unsupported format). */
export async function loadCompanyLogo(company: string): Promise<Image | null> {
  const file = findLogoFile(company);
  if (!file) return null;
  try {
    return await loadImage(file);
  } catch {
    return null;
  }
}

const KICKERS: Record<SlideKind, string> = {
  intro: "PERSONALIZED VIDEO PITCH",
  problem: "THE PROBLEM",
  solution: "THE SOLUTION",
  cta: "LET'S TALK",
};

/* ------------------------------- primitives ------------------------------- */

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function diamond(ctx: SKRSContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
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
  for (const line of wrap(ctx, text, maxW)) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

/* --------------------------------- chrome --------------------------------- */

function background(ctx: SKRSContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, VIDEO_W * 0.6, VIDEO_H);
  bg.addColorStop(0, "#FFFFFF");
  bg.addColorStop(1, "#EAF0FF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

  // Soft accent orb, top-right, for depth.
  const orb = ctx.createRadialGradient(VIDEO_W - 220, 180, 60, VIDEO_W - 220, 180, 900);
  orb.addColorStop(0, "rgba(37,99,235,0.16)");
  orb.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
}

function header(ctx: SKRSContext2D, jury: JuryMember, logo: Image | null): void {
  diamond(ctx, PAD + 15, 116, 26, ACCENT);
  ctx.fillStyle = ACCENT;
  ctx.font = `600 38px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("AutoDeck", PAD + 44, 130);

  const chipH = 66;
  const chipY = 85;

  // Top-right: the target company's logo in a white chip (co-brand).
  if (logo) {
    const logoH = 42;
    const logoW = Math.min(240, logoH * (logo.width / logo.height));
    const forLabel = "for";
    ctx.font = `600 27px ${FONT}`;
    const forW = ctx.measureText(forLabel).width;
    const padX = 34;
    const gap = 20;
    const chipW = padX + forW + gap + logoW + padX;
    const chipX = VIDEO_W - PAD - chipW;
    ctx.fillStyle = "#FFFFFF";
    roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = FAINT;
    ctx.textAlign = "left";
    ctx.fillText(forLabel, chipX + padX, chipY + chipH / 2 + 10);
    ctx.drawImage(logo, chipX + padX + forW + gap, chipY + (chipH - logoH) / 2, logoW, logoH);
    return;
  }

  // Fallback: "For {Company}" text chip.
  const label = `For ${jury.company}`;
  ctx.font = `600 30px ${FONT}`;
  const tw = ctx.measureText(label).width;
  const chipW = tw + 72;
  const chipX = VIDEO_W - PAD - chipW;
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.stroke();
  diamond(ctx, chipX + 30, chipY + chipH / 2, 14, ACCENT);
  ctx.fillStyle = INK;
  ctx.fillText(label, chipX + 48, chipY + chipH / 2 + 10);
}

function kicker(ctx: SKRSContext2D, kind: SlideKind, y: number): void {
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, y - 18, 54, 5);
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = ACCENT;
  ctx.textAlign = "left";
  ctx.fillText(letterspace(KICKERS[kind]), PAD + 74, y);
}

function footer(ctx: SKRSContext2D, index: number, total: number): void {
  ctx.fillStyle = FAINT;
  ctx.font = `500 27px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("AutoDeck · Agentic GTM Hackathon", PAD, VIDEO_H - 84);

  const r = 6;
  const gap = 26;
  const totalW = total * (r * 2) + (total - 1) * (gap - r * 2);
  let x = VIDEO_W - PAD - totalW + r;
  const y = VIDEO_H - 92;
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i === index ? ACCENT : LINE;
    ctx.fill();
    x += gap;
  }
}

function letterspace(s: string): string {
  return s.split("").join(" ");
}

/* ---------------------------------- heroes -------------------------------- */

function heroIntro(ctx: SKRSContext2D, y: number): void {
  const label = "Auto-generated in ~3 min · voiced automatically";
  ctx.font = `600 30px ${FONT}`;
  const tw = ctx.measureText(label).width;
  const h = 66;
  const w = tw + 96;
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, PAD, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, PAD, y, w, h, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PAD + 40, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.fillStyle = MUTE;
  ctx.fillText(label, PAD + 66, y + h / 2 + 11);
}

function heroStat(ctx: SKRSContext2D, y: number): void {
  ctx.textAlign = "left";
  ctx.fillStyle = ACCENT;
  ctx.font = `800 200px ${FONT}`;
  ctx.fillText("45", PAD, y + 168);
  const numW = ctx.measureText("45").width;
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText("min", PAD + numW + 22, y + 168);

  const capX = PAD + numW + 22;
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText("to hand-craft one", capX, y + 66);
  ctx.fillStyle = MUTE;
  ctx.font = `400 40px ${FONT}`;
  ctx.fillText("personalized video pitch.", capX, y + 116);
}

function stepCard(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  n: string,
  title: string,
  sub: string,
): void {
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, x, y, w, h, 28);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, x, y, w, h, 28);
  ctx.stroke();

  // number badge
  ctx.fillStyle = ACCENT_SOFT;
  ctx.beginPath();
  ctx.arc(x + 52, y + 56, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.font = `700 34px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(n, x + 52, y + 68);

  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(title, x + 40, y + 138);
  ctx.fillStyle = MUTE;
  ctx.font = `400 29px ${FONT}`;
  for (const [i, line] of wrap(ctx, sub, w - 80).slice(0, 2).entries()) {
    ctx.fillText(line, x + 40, y + 182 + i * 36);
  }
}

function arrow(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 16, y);
  ctx.lineTo(x + 10, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 9);
  ctx.lineTo(x + 12, y);
  ctx.lineTo(x + 2, y + 9);
  ctx.stroke();
}

function heroSteps(ctx: SKRSContext2D, y: number): void {
  const steps: Array<[string, string, string]> = [
    ["1", "Signal fires", "A champion moves, a team hires"],
    ["2", "Video is built", "Claude writes, cloned voice narrates"],
    ["3", "They're watching", "Live ping the second they hit play"],
  ];
  const gapArrow = 66;
  const cardW = (CONTENT_W - gapArrow * 2) / 3;
  const cardH = 232;
  let x = PAD;
  for (const [i, [n, t, s]] of steps.entries()) {
    stepCard(ctx, x, y, cardW, cardH, n, t, s);
    if (i < steps.length - 1) arrow(ctx, x + cardW + gapArrow / 2, y + cardH / 2);
    x += cardW + gapArrow;
  }
}

function heroCta(ctx: SKRSContext2D, y: number): void {
  const label = "Be called back";
  ctx.font = `700 42px ${FONT}`;
  const h = 100;
  const iconR = 14;
  const padX = 54;
  const gap = 28;
  const tw = ctx.measureText(label).width;
  const w = padX + iconR * 2 + gap + tw + padX;
  ctx.fillStyle = ACCENT;
  roundedRect(ctx, PAD, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(PAD + padX + iconR, y + h / 2, iconR, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillText(label, PAD + padX + iconR * 2 + gap, y + h / 2 + 15);
}

/* --------------------------------- render --------------------------------- */

function renderSlide(
  slide: Slide,
  jury: JuryMember,
  index: number,
  total: number,
  logo: Image | null,
): Buffer {
  const canvas = createCanvas(VIDEO_W, VIDEO_H);
  const ctx = canvas.getContext("2d");

  background(ctx);
  header(ctx, jury, logo);
  ctx.textBaseline = "alphabetic";

  kicker(ctx, slide.kind, 348);

  // Headline — fixed anchor, capped to 2 lines (shrink font if it would overflow).
  const headMaxW = slide.kind === "solution" ? CONTENT_W : 1380;
  ctx.font = `800 100px ${FONT}`;
  let headSize = 100;
  if (wrap(ctx, slide.headline, headMaxW).length > 2) {
    headSize = 78;
    ctx.font = `800 ${headSize}px ${FONT}`;
  }
  ctx.fillStyle = INK;
  drawWrapped(ctx, slide.headline, PAD, 460, headMaxW, Math.round(headSize * 1.12));

  // Subtext only where the hero doesn't already carry the message.
  if (slide.kind === "intro" || slide.kind === "cta") {
    ctx.fillStyle = MUTE;
    ctx.font = `400 44px ${FONT}`;
    drawWrapped(ctx, slide.subtext, PAD, 692, 1380, 60);
  }

  // Hero band — fixed vertical anchors, always clear of the footer.
  switch (slide.kind) {
    case "intro":
      heroIntro(ctx, 838);
      break;
    case "problem":
      heroStat(ctx, 700);
      break;
    case "solution":
      heroSteps(ctx, 690);
      break;
    case "cta":
      heroCta(ctx, 812);
      break;
  }

  footer(ctx, index, total);
  return canvas.toBuffer("image/png");
}

export async function renderSlides(
  deck: Deck,
  jury: JuryMember,
  outDir: string,
): Promise<string[]> {
  const paths: string[] = [];
  const total = deck.slides.length;
  const logo = await loadCompanyLogo(jury.company);
  for (let i = 0; i < total; i++) {
    const slide = deck.slides[i];
    if (!slide) continue;
    const out = path.join(outDir, `slide-${i}-${slide.kind}.png`);
    await writeFile(out, renderSlide(slide, jury, i, total, logo));
    paths.push(out);
  }
  return paths;
}
