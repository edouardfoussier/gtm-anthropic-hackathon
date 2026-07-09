import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Prospect record backing a /v/[id] share page. Reads the generated jury list
 * (pipeline/data/jury.json) and points at the video hosted in public/videos.
 */
export interface Sender {
  name: string;
  role: string;
  email: string;
}

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  /** From FullEnrich when available; empty string means "let the prospect fill it". */
  phone: string;
  videoUrl: string;
  posterUrl: string;
  sender: Sender;
}

/** The seller whose cloned voice narrates the videos. */
const SENDER: Sender = {
  name: "Tom",
  role: "Co-founder · AutoDeck",
  email: "tom@getautodeck.com",
};

const JURY_PATH = path.join(process.cwd(), "engine", "data", "jury.json");

interface JuryRecord {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title?: string;
  phone?: string;
  linkedin?: string;
}

export interface ProspectSummary {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
}

export async function getAllProspects(): Promise<ProspectSummary[]> {
  try {
    const raw = await readFile(JURY_PATH, "utf8");
    const records = JSON.parse(raw) as JuryRecord[];
    return records.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      company: r.company,
    }));
  } catch {
    return [];
  }
}

export async function getProspect(id: string): Promise<Prospect | null> {
  let raw: string;
  try {
    raw = await readFile(JURY_PATH, "utf8");
  } catch {
    return null;
  }
  const records = JSON.parse(raw) as JuryRecord[];
  const rec = records.find((r) => r.id === id);
  if (!rec) return null;
  return {
    id: rec.id,
    firstName: rec.firstName,
    lastName: rec.lastName,
    company: rec.company,
    title: rec.title ?? "",
    phone: rec.phone ?? "",
    videoUrl: `/videos/${rec.id}.mp4`,
    posterUrl: `/videos/${rec.id}.jpg`,
    sender: SENDER,
  };
}
