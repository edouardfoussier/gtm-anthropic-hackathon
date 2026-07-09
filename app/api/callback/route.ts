import { NextResponse } from "next/server";
import { appendEvent } from "@/lib/events";

/**
 * Records a "get contacted" request from a share page. Wiring the actual
 * outbound call is a separate step: POST to the gtm-hack call-spike server
 * (Twilio ConversationRelay) at CALL_SPIKE_URL once available. Until then we
 * only record the request so the dashboard shows who asked to be called and when.
 */
const E164 = /^\+[1-9]\d{6,14}$/;

export async function POST(req: Request): Promise<NextResponse> {
  let body: { prospectId?: string; when?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body.prospectId) {
    return NextResponse.json({ ok: false, error: "missing prospectId" }, { status: 400 });
  }

  const phone = body.phone?.replace(/\s+/g, "") ?? "";

  await appendEvent("callbacks", {
    prospectId: body.prospectId,
    when: body.when ?? null,
    phone: phone || null,
    phoneValid: E164.test(phone),
    status: "requested",
  });

  // TODO(callback): when CALL_SPIKE_URL is set and phone is E.164, forward to the
  // call-spike /call endpoint to place the outbound Twilio call.

  return NextResponse.json({ ok: true });
}
