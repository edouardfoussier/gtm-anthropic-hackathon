"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQueue } from "@/components/queue/queue-context";
import { cn } from "@/lib/utils";
import type { Contact, Prospect } from "@/lib/types";

const RELATIONSHIP_LABEL: Record<string, string> = {
  signal_source: "Signal source",
  champion: "Champion",
  decision_maker: "Decision maker",
};

interface ContactDrawerProps {
  prospect: Prospect;
  contactId: string | null;
  onClose: () => void;
}

export function ContactDrawer({
  prospect,
  contactId,
  onClose,
}: ContactDrawerProps) {
  const { enqueue, items } = useQueue();
  const contact = prospect.contacts.find((c) => c.id === contactId);
  const relationship = prospect.relationships.find(
    (r) => r.contactId === contactId,
  );
  const signal = prospect.signals.find((s) => s.id === relationship?.signalId);

  const alreadyQueued = contact
    ? items.some((item) => item.contact.id === contact.id)
    : false;

  function handleContact(target: Contact) {
    enqueue(prospect.companyName, target);
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-80 z-40 flex w-full max-w-sm flex-col gap-6 border-l border-border bg-card p-6 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.15)] transition-transform duration-300",
        contact ? "translate-x-0" : "translate-x-full",
      )}
    >
      {contact ? (
        <>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-orange">
                {contact.juryId
                  ? "Real prospect"
                  : relationship
                    ? RELATIONSHIP_LABEL[relationship.kind]
                    : "Contact"}
              </span>
              <h3 className="font-display text-2xl uppercase leading-none tracking-tight">
                {contact.name}
              </h3>
              <span className="text-sm text-muted-foreground">
                {contact.title ? `${contact.title} · ` : ""}
                {prospect.companyName}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          {signal ? (
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Signal
              </span>
              <p className="text-sm">{signal.label}</p>
            </div>
          ) : null}

          {!contact.juryId ? (
            <dl className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Email
                </dt>
                <dd>{contact.email}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Phone
                </dt>
                <dd>{contact.phone}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  LinkedIn
                </dt>
                <dd>{contact.linkedin}</dd>
              </div>
            </dl>
          ) : null}

          {contact.juryId ? (
            <Link
              href={`/reachout/${contact.juryId}`}
              className={cn(buttonVariants({ size: "lg" }), "mt-auto")}
            >
              Build the pitch
              <ArrowRight />
            </Link>
          ) : (
            <Button
              size="lg"
              className="mt-auto"
              disabled={alreadyQueued}
              onClick={() => handleContact(contact)}
            >
              {alreadyQueued ? "Queued" : "Contact"}
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}
