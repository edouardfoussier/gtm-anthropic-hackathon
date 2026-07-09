// FullEnrich adapter — turns a person into real contact coordinates.
//
// Real path = v2 REST: POST the bulk enrich request, then poll until the async waterfall
// finishes. It is time-boxed and every failure/timeout falls back to a deterministic mock, so
// the UI never hangs and the demo never dies. NOTE: the exact request/response field names
// below are best-effort and MUST be verified against docs.fullenrich.com (index: /llms.txt)
// when the API key lands — the defensive Zod parse + mock fallback make a mismatch safe.

import { fullenrichMode, TIMEOUT_MS } from "./config";
import { ContactSchema, type Contact, type Person } from "./types";
import { withTimeout } from "./util";
import { z } from "zod";

const BASE = "https://app.fullenrich.com/api/v2/contact/enrich/bulk";

function domainFor(company: string): string {
  const bare = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${bare || "company"}.com`;
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "there", last: parts.slice(1).join(" ") || parts[0] || "" };
}

function digits(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const n = h % 9_000_000 + 1_000_000; // 7 digits
  const s = String(n);
  return `+1 415 ${s.slice(0, 3)} ${s.slice(3)}`;
}

/** Deterministic, realistic-looking contact — the fallback and the mock-mode result. */
export function mockContact(person: Person): Contact {
  const { first, last } = splitName(person.name);
  const domain = domainFor(person.company);
  const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const slug = `${first}-${last}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return {
    email: `${handle}@${domain}`,
    phone: digits(person.id),
    linkedin: `https://www.linkedin.com/in/${slug}`,
    title: person.title,
    confidence: 0.8,
  };
}

// Permissive views of the v2 responses — we only pull what we need and tolerate extra fields.
const StartResponse = z.object({ enrichment_id: z.string() }).passthrough();
const PollResponse = z
  .object({
    status: z.string().optional(),
    datas: z
      .array(
        z
          .object({
            contact: z
              .object({
                emails: z.array(z.object({ email: z.string() }).passthrough()).optional(),
                phones: z.array(z.object({ number: z.string() }).passthrough()).optional(),
                linkedin_url: z.string().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

async function enrichReal(person: Person): Promise<Contact> {
  const key = process.env.FULLENRICH_API_KEY!;
  const { first, last } = splitName(person.name);
  const start = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `autodeck-${person.id}`,
      datas: [
        {
          firstname: first,
          lastname: last,
          company_name: person.company,
          domain: domainFor(person.company),
          enrich_fields: ["contact.emails", "contact.phones"],
        },
      ],
    }),
  });
  if (!start.ok) throw new Error(`enrich start ${start.status}`);
  const { enrichment_id } = StartResponse.parse(await start.json());

  // Poll until done or we run out of time budget.
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${BASE}/${enrichment_id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) continue;
    const poll = PollResponse.parse(await res.json());
    const status = (poll.status ?? "").toUpperCase();
    if (status && status !== "FINISHED" && status !== "DONE" && status !== "SUCCESS") continue;
    const c = poll.datas?.[0]?.contact;
    const contact: Contact = {
      email: c?.emails?.[0]?.email,
      phone: c?.phones?.[0]?.number,
      linkedin: c?.linkedin_url,
      title: person.title,
    };
    // If the waterfall found nothing usable, mock is better than an empty card on stage.
    if (!contact.email && !contact.phone) throw new Error("enrich returned no coordinates");
    return ContactSchema.parse(contact);
  }
  throw new Error("enrich poll timed out");
}

export async function enrichContact(person: Person): Promise<Contact> {
  if (fullenrichMode() === "real") {
    try {
      return await withTimeout(enrichReal(person), TIMEOUT_MS + 2000, "fullenrich");
    } catch (err) {
      console.warn(`[fullenrich] real enrich failed (${(err as Error).message}) — using mock`);
    }
  }
  return mockContact(person);
}
