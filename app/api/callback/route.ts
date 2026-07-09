import { NextResponse } from "next/server";
import { appendEvent } from "@/lib/events";
import { getProspect } from "@/lib/prospects";

/**
 * Records a "get contacted" request from a share page and, when the outbound
 * call service is configured, forwards it to the gtm-hack call-spike server
 * (Twilio ConversationRelay) to place the call. No call is placed unless
 * CALL_SPIKE_URL is set AND the phone is valid E.164 — so this is inert until
 * the voice service is deployed.
 */
const E164 = /^\+[1-9]\d{6,14}$/;
const CALL_TIMEOUT_MS = 10_000;

type CallOutcome = "placed" | "skipped" | "failed";

async function triggerOutboundCall(phone: string, prospectId: string): Promise<CallOutcome> {
  const base = process.env.CALL_SPIKE_URL?.trim();
  if (!base || !E164.test(phone)) return "skipped";
  const prospect = await getProspect(prospectId);
  try {
    const res = await fetch(`${base}/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: phone,
        name: prospect?.firstName ?? undefined,
        objective: `Call ${prospect?.firstName ?? "the prospect"} from ${prospect?.company ?? "their company"}. Simply ask what they think of AutoDeck and whether they have any question for the founders. Keep it short, warm, and conversational.`,
        context: `${prospect?.firstName ?? "A prospect"} at ${prospect?.company ?? "their company"} just watched the AutoDeck pitch video and asked to be called back now.`,
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    return res.ok ? "placed" : "failed";
  } catch {
    return "failed";
  }
}

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
  const call = await triggerOutboundCall(phone, body.prospectId);

  await appendEvent("callbacks", {
    prospectId: body.prospectId,
    when: body.when ?? null,
    phone: phone || null,
    phoneValid: E164.test(phone),
    status: call === "placed" ? "call_placed" : "requested",
    call,
  });

  return NextResponse.json({ ok: true, call });
}
