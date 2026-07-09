"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Get contacted" CTA: prospect picks a time and we record a callback request.
 * On submit it POSTs to /api/callback (which will, once wired, trigger the
 * Twilio voice agent). Purely the request side here — the call is out of scope
 * for this component.
 */
type Status = "idle" | "sending" | "done" | "error";

export function CallbackForm({
  prospectId,
  senderName,
  defaultPhone = "",
}: {
  prospectId: string;
  senderName: string;
  defaultPhone?: string;
}) {
  const [when, setWhen] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospectId, when, phone }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="text-accent-orange">✓</span> Booked — {senderName} will call you
        {when ? ` around ${new Date(when).toLocaleString()}` : " shortly"}.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        When should we call?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="flex-1 border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+33 6 …"
          className="flex-1 border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </div>
      <Button type="submit" size="lg" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Get contacted"}
      </Button>
      {status === "error" && (
        <p className="text-sm text-destructive">Something went wrong — try again.</p>
      )}
    </form>
  );
}
