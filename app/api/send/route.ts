import { NextResponse } from "next/server";
import { appendEvent } from "@/lib/events";
import { getProspect } from "@/lib/prospects";
import { getJuryContact } from "@/lib/jury-contacts";
import { sendPitchEmail } from "@/lib/email";

/**
 * Sends the branded AutoDeck pitch email for a prospect. The video is linked to
 * the /v/[id] share page (never attached) and the poster is served from the app
 * origin. Inert until RESEND_API_KEY is set — sendPitchEmail then returns
 * { skipped: true } instead of calling the provider.
 *
 * Default recipient: with no explicit `to`, route the send to the address inside
 * EMAIL_FROM (so you email yourself a test) and fall back to Resend's always-
 * deliverable test inbox when the domain isn't configured yet.
 */
const DEFAULT_APP_URL = "http://localhost:3000";
const RESEND_TEST_INBOX = "delivered@resend.dev";

function defaultRecipient(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) return RESEND_TEST_INBOX;
  const match = from.match(/<([^>]+)>/);
  const address = (match ? match[1] : from).trim();
  return address.includes("@") ? address : RESEND_TEST_INBOX;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: { prospectId?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.prospectId) {
    return NextResponse.json({ ok: false, error: "missing prospectId" }, { status: 400 });
  }

  const prospect = await getProspect(body.prospectId);
  if (!prospect) {
    return NextResponse.json({ ok: false, error: "prospect not found" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? DEFAULT_APP_URL;
  const shareUrl = `${appUrl}/v/${prospect.id}`;
  // posterUrl is already absolute when served from a remote engine host.
  const posterUrl = prospect.posterUrl.startsWith("http")
    ? prospect.posterUrl
    : `${appUrl}${prospect.posterUrl}`;
  // The prospect's real email is PII (git-ignored overlay). Double-gated so tests never
  // hit a judge's inbox: use it only when the caller passes an explicit `to`, or when
  // ALLOW_PROSPECT_EMAIL=1 is set (for the live demo). Otherwise fall back to self/test.
  const prospectEmail =
    process.env.ALLOW_PROSPECT_EMAIL === "1" ? getJuryContact(prospect.id).email : undefined;
  const to = body.to ?? prospectEmail ?? defaultRecipient();

  const result = await sendPitchEmail({
    to,
    firstName: prospect.firstName,
    company: prospect.company,
    senderName: prospect.sender.name,
    shareUrl,
    posterUrl,
  });

  await appendEvent("emails", {
    prospectId: prospect.id,
    to,
    sent: result.sent,
    skipped: result.skipped ?? false,
    id: result.id ?? null,
    error: result.error ?? null,
  });

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    skipped: result.skipped ?? false,
    id: result.id,
  });
}
